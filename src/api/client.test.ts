import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, request, setAccessToken, toApiError } from './client'
import { UNREACHABLE_MESSAGE } from './errors'

/**
 * 스캐폴드가 실제로 돈다는 것을 세우는 최소 테스트.
 *
 * 여기서 계약 호출을 흉내 내지 않는다 — 목업으로 만든 초록은 아무것도 보장하지 않는다.
 * 실제 호출의 검증은 백엔드와 붙는 시점에 통합 테스트로 세운다.
 */
describe('ApiError', () => {
  it('오류 코드와 추적 ID 를 함께 나른다 — 제보 하나로 서버 로그를 찾을 수 있어야 한다', () => {
    const error = new ApiError(409, 'TURN_CONFLICT', '진행 상태가 최신이 아니에요.', {}, 'req-1')

    expect(error.status).toBe(409)
    expect(error.errorCode).toBe('TURN_CONFLICT')
    expect(error.requestId).toBe('req-1')
    expect(error).toBeInstanceOf(Error)
  })

  it('details 는 항상 객체다 — 계약이 null 을 주지 않으므로 화면이 존재 여부를 묻지 않는다', () => {
    const error = new ApiError(429, 'RETRY_COOLDOWN', '잠시 후 다시 시도해 주세요.', {
      retryAfterSeconds: 30,
    })

    expect(error.details).toEqual({ retryAfterSeconds: 30 })
  })
})

/**
 * 본문이 없는 응답.
 *
 * `202` 를 상태 코드로 판단하지 않는다는 것이 핵심이다 — 계약 안에서 이미 두 가지로 쓰인다.
 */
describe('request — 빈 본문', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setAccessToken(null)
  })

  function respondWith(response: Response) {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response)))
  }

  it('202 에 본문이 없으면 파싱하지 않는다 — createReport 가 그렇다 (§13-12)', async () => {
    respondWith(new Response(null, { status: 202 }))

    await expect(request('/reports', { method: 'POST', body: {} })).resolves.toBeUndefined()
  })

  it('202 에 본문이 있으면 읽는다 — submitDraft 는 ReviewStatusResponse 를 담는다', async () => {
    respondWith(
      new Response(JSON.stringify({ status: 'pending' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(
      request('/authoring/drafts/1/submit', { method: 'POST', body: {} }),
    ).resolves.toEqual({ status: 'pending' })
  })

  it('204 는 본문이 없다 — deleteSession 이 그렇다', async () => {
    respondWith(new Response(null, { status: 204 }))

    await expect(request('/sessions/1', { method: 'DELETE' })).resolves.toBeUndefined()
  })
})

/**
 * 응답이 아예 오지 않은 실패 (#42).
 *
 * 지금은 이 경로가 예외가 아니라 **개발 중 기본값**이다 — OAuth 앱이 없어 백엔드에 닿는
 * 화면이 없다.
 */
describe('request — 서버에 닿지 못한 경우', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setAccessToken(null)
  })

  function failWith(cause: unknown) {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(cause)))
  }

  it('응답이_없는_실패도_계약_밖으로_다룬다 — 브라우저의 Failed to fetch 를 화면에 두지 않는다', async () => {
    failWith(new TypeError('Failed to fetch'))

    const error = await request('/landing').catch((thrown: unknown) => thrown)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).message).toBe(UNREACHABLE_MESSAGE)
  })

  it('계약 코드를 빌리지 않는다 — 서버가 하지 않은 말을 화면이 하게 된다', async () => {
    failWith(new TypeError('Failed to fetch'))

    const error = (await request('/landing').catch((thrown: unknown) => thrown)) as ApiError

    // 응답이 없었으므로 적을 HTTP 상태도 없다. 0 을 실제 상태로 오해할 자리가 없다.
    expect(error.errorCode).toBe('UNKNOWN')
    expect(error.status).toBe(0)
    expect(error.requestId).toBeUndefined()
  })

  it('AbortError_는_오류가_아니다 — 화면 이동마다 오류가 뜨면 안 된다', async () => {
    const aborted = new DOMException('The operation was aborted.', 'AbortError')
    failWith(aborted)

    const error = await request('/landing').catch((thrown: unknown) => thrown)

    expect(error).toBe(aborted)
    expect(error).not.toBeInstanceOf(ApiError)
  })
})

/**
 * `request()` 가 화면에 주는 약속 — **거절하는 값은 `ApiError` 아니면 취소뿐이다.**
 *
 * 이것이 성립해야 화면이 각자 폴백을 두지 않는다. 성립하지 않던 자리가 하나 있었다:
 * 성공 응답의 본문이 파싱되지 않으면 브라우저의 `SyntaxError` 가 그대로 새어 나갔고,
 * 그것을 화면 쪽 폴백들이 가리고 있었다 (#63).
 */
describe('request — 계약 밖으로 새지 않는다', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setAccessToken(null)
  })

  it('성공_응답의_본문이_깨져도_ApiError_다 — SyntaxError 를 화면에 두지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response('{"sections":', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    )

    const error = (await request('/landing').catch((thrown: unknown) => thrown)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.errorCode).toBe('UNKNOWN')
    expect(error.message).toBe(UNREACHABLE_MESSAGE)
  })
})

/**
 * 화면이 `unknown` 을 좁히는 자리 하나 (#63).
 *
 * 문구를 여기서 짓지 않는다는 것이 요점이다 — `usePlaySession` 이 자기 문구를 들고 있었고,
 * 그 문구는 위의 약속 때문에 한 번도 화면에 뜨지 못했다.
 */
describe('toApiError', () => {
  it('ApiError_는_그대로_통과시킨다 — 서버 message 를 다시 짓지 않는다 (F-4)', () => {
    const original = new ApiError(423, 'STORY_SUSPENDED', '공개가 중지된 작품이에요.', {})

    expect(toApiError(original)).toBe(original)
  })
})
