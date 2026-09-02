import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, setAccessToken } from '../client'
import {
  clearAdminStepUp,
  confirmAdminTotp,
  enrollAdminTotp,
  hasAdminStepUp,
  listReviewQueue,
  setAdminStepUp,
  verifyAdminTotp,
} from './admin'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce(response)
  }
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function headersOf(fetchMock: ReturnType<typeof stubFetch>, call = 0): Record<string, string> {
  return (fetchMock.mock.calls[call]?.[1]?.headers ?? {}) as Record<string, string>
}

/**
 * 스토리지에 무엇이 쓰였는지 지켜보는 가짜.
 *
 * 테스트 환경은 node 라 `localStorage` 가 아예 없다 — "안 썼다" 를 그대로 두면 API 가 없어서
 * 통과하는 초록이 되고, 나중에 jsdom 이 들어오는 순간 조용히 의미를 잃는다. 실제로 쓸 수 있는
 * 자리를 만들어 두고 **한 번도 불리지 않았다는 것**을 확인한다.
 */
function watchStorage() {
  const writes: string[] = []
  const store: Storage = {
    length: 0,
    clear: () => {},
    key: () => null,
    getItem: () => null,
    removeItem: () => {},
    setItem: (key: string) => {
      writes.push(key)
    },
  }
  vi.stubGlobal('localStorage', store)
  vi.stubGlobal('sessionStorage', store)
  return writes
}

const STEP_UP = { stepUpToken: 'promotion-value', expiresIn: 300 }

beforeEach(() => {
  clearAdminStepUp()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  clearAdminStepUp()
  setAccessToken(null)
})

describe('F3_승격은_스토리지에_가지_않는다', () => {
  it('verify_가_준_승격은_메모리에만_남는다 — localStorage · sessionStorage 에 쓰지 않는다', async () => {
    const writes = watchStorage()
    stubFetch(json(STEP_UP))

    await verifyAdminTotp('123456')

    expect(hasAdminStepUp()).toBe(true)
    expect(writes).toEqual([])
  })

  it('confirm_이_준_승격도_같다', async () => {
    const writes = watchStorage()
    stubFetch(json(STEP_UP))

    await confirmAdminTotp('123456')

    expect(hasAdminStepUp()).toBe(true)
    expect(writes).toEqual([])
  })

  it('enroll_의_비밀은_어디에도_보관되지_않는다 — 돌려주기만 한다', async () => {
    // 계약: 비밀이 나가는 유일한 응답이며 이후로는 어떤 경로로도 다시 볼 수 없다.
    const writes = watchStorage()
    stubFetch(json({ secret: 'ONCE-ONLY', otpauthUri: 'otpauth://totp/x?secret=ONCE-ONLY' }))

    const enrollment = await enrollAdminTotp()

    expect(enrollment.secret).toBe('ONCE-ONLY')
    expect(writes).toEqual([])
    // 등록은 승격을 만들지 않는다 — 확정이 만든다.
    expect(hasAdminStepUp()).toBe(false)
  })

  it('승격_값을_읽어_갈_수_있는_export_가_없다 — 로그·URL 로 새는 길을 만들지 않는다', async () => {
    stubFetch(json(STEP_UP))
    await verifyAdminTotp('123456')

    const module: Record<string, unknown> = await import('./admin')
    const leaked = Object.entries(module).filter(
      ([, value]) => typeof value === 'string' && value === STEP_UP.stepUpToken,
    )

    expect(leaked).toEqual([])
    // 문을 열 수 있는가만 답한다.
    expect(hasAdminStepUp()).toBe(true)
  })
})

describe('X-Admin-Step-Up (계약 parameters/AdminStepUp)', () => {
  it('관리자_경로에_승격을_붙인다', async () => {
    stubFetch(json(STEP_UP), json([]))
    await verifyAdminTotp('123456')

    await listReviewQueue()

    expect(headersOf(vi.mocked(fetch), 1)['X-Admin-Step-Up']).toBe(STEP_UP.stepUpToken)
  })

  it('Authorization_자리를_건드리지_않는다 — 누구인가와 방금 통과했는가는 다른 질문이다', async () => {
    setAccessToken('who-i-am')
    stubFetch(json(STEP_UP), json([]))
    await verifyAdminTotp('123456')

    await listReviewQueue()

    const headers = headersOf(vi.mocked(fetch), 1)
    expect(headers['Authorization']).toBe('Bearer who-i-am')
    expect(headers['X-Admin-Step-Up']).toBe(STEP_UP.stepUpToken)
  })

  it('승격이_없으면_헤더를_붙이지_않는다 — 프론트가 미리 막고 문구를 짓지 않는다 (F-4)', async () => {
    const fetchMock = stubFetch(json([]))

    await listReviewQueue()

    expect(headersOf(fetchMock)['X-Admin-Step-Up']).toBeUndefined()
  })

  it('confirm_과_verify_에는_붙이지_않는다 — 계약에 그 파라미터가 없다', async () => {
    const fetchMock = stubFetch(json(STEP_UP))

    await verifyAdminTotp('123456')

    expect(headersOf(fetchMock)['X-Admin-Step-Up']).toBeUndefined()
  })

  it('만료된_승격은_없는_것으로_답하고_붙지_않는다 — expiresIn 은 서버가 준 값이다', async () => {
    vi.useFakeTimers()
    stubFetch(json(STEP_UP), json([]))
    await verifyAdminTotp('123456')
    expect(hasAdminStepUp()).toBe(true)

    vi.advanceTimersByTime((STEP_UP.expiresIn + 1) * 1000)

    expect(hasAdminStepUp()).toBe(false)
    await listReviewQueue()
    expect(headersOf(vi.mocked(fetch), 1)['X-Admin-Step-Up']).toBeUndefined()
  })
})

describe('S6_403_을_구분해_다루지_않는다', () => {
  it('403_이어도_승격을_버리지_않는다 — 역할·IP·2FA 중 무엇이 어긋났는지 계약이 알려 주지 않는다', async () => {
    stubFetch(
      json(STEP_UP),
      json({ error: 'FORBIDDEN', message: '권한이 없어요.', details: {} }, 403),
    )
    await verifyAdminTotp('123456')

    await listReviewQueue().catch(() => undefined)

    // 403 을 만료로 읽으면 프론트가 서버가 하지 않은 판단을 하게 된다.
    expect(hasAdminStepUp()).toBe(true)
  })

  it('verify_의_403_은_서버의_message_그대로_올라온다', async () => {
    stubFetch(json({ error: 'FORBIDDEN', message: '인증에 실패했어요.', details: {} }, 403))

    const failure = await verifyAdminTotp('123456').catch((cause: unknown) => cause)

    expect(failure).toBeInstanceOf(ApiError)
    expect((failure as ApiError).message).toBe('인증에 실패했어요.')
    expect(hasAdminStepUp()).toBe(false)
  })
})

describe('setAdminStepUp', () => {
  it('null_은_승격을_버린다', () => {
    setAdminStepUp(STEP_UP)
    expect(hasAdminStepUp()).toBe(true)

    setAdminStepUp(null)

    expect(hasAdminStepUp()).toBe(false)
  })
})
