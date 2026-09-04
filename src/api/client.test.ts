import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ApiError,
  hasAccessToken,
  renewAccessToken,
  request,
  setAccessToken,
  toApiError,
} from './client'
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

/**
 * `401` 을 만난 자리 — 재발급 한 번, 재시도 한 번 (ADR-0008, backend #278).
 *
 * 여기서 못박는 것이 셋이다: **재발급 자체의 401 로 다시 재발급하지 않는다**(무한 루프) ·
 * **동시에 여러 요청이 401 을 받아도 재발급은 한 번만 나간다** · **재발급이 안 되면 토큰을
 * 버리고 서버가 준 401 을 그대로 올린다.**
 */
describe('request — 401 과 재발급', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setAccessToken(null)
  })

  /** 서버가 CSRF 쿠키를 구워 두었다 — 재발급을 부를 수 있는 상태다. */
  function withCsrfCookie() {
    vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=csrf-1' })
  }

  function json(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  function unauthenticated(): Response {
    return json(401, { error: 'UNAUTHENTICATED', message: '로그인이 필요해요.', details: {} })
  }

  function renewed(): Response {
    // 계약의 `TokenResponse` 는 셋이다 — `refreshToken` 이 본문에 없다 (ADR-0008).
    return json(200, { accessToken: 'fresh', tokenType: 'Bearer', expiresIn: 1800 })
  }

  /**
   * 경로별로 답한다. **재발급이 몇 번 나갔는지를 세는 것**이 이 테스트들의 핵심이다 —
   * 재발급 경로의 응답은 `refresh`, 나머지는 요청 순서대로 `others` 에서 꺼내 준다.
   */
  type Respond = () => Response

  function route(refresh: Respond, others: [Respond, ...Respond[]]) {
    let served = 0
    const refreshCalls = { count: 0 }
    const fetchMock = vi.fn((url: string) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls.count += 1
        return Promise.resolve(refresh())
      }
      // 준비한 것보다 더 부르면 마지막 응답을 되풀이한다 — 호출 횟수 자체는 아래에서 센다.
      const next = others.at(Math.min(served, others.length - 1)) ?? others[0]
      served += 1
      return Promise.resolve(next())
    })
    vi.stubGlobal('fetch', fetchMock)
    return { fetchMock, refreshCalls }
  }

  it('401_이면_재발급하고_한_번_다시_부른다 — 새로고침 뒤에도 화면이 이어진다', async () => {
    withCsrfCookie()
    setAccessToken('expired')
    const { refreshCalls } = route(renewed, [unauthenticated, () => json(200, { sections: [] })])

    await expect(request('/library')).resolves.toEqual({ sections: [] })

    expect(refreshCalls.count).toBe(1)
    expect(hasAccessToken()).toBe(true)
  })

  it('재발급이_안_되면_익명으로_떨어진다 — 서버가 준 401 을 그대로 올린다 (F-4)', async () => {
    withCsrfCookie()
    setAccessToken('expired')
    const { refreshCalls } = route(unauthenticated, [unauthenticated])

    const error = (await request('/library').catch((thrown: unknown) => thrown)) as ApiError

    expect(error.status).toBe(401)
    // 문구를 프론트가 짓지 않는다 — 재발급이 실패했다는 말을 여기서 지어내지 않는다.
    expect(error.message).toBe('로그인이 필요해요.')
    expect(hasAccessToken()).toBe(false)
    expect(refreshCalls.count).toBe(1)
  })

  it('재발급_자체의_401_로_다시_재발급하지_않는다 — 그 자리가 무한 루프다', async () => {
    withCsrfCookie()
    const { refreshCalls } = route(unauthenticated, [unauthenticated])

    await expect(renewAccessToken()).resolves.toBe(false)

    expect(refreshCalls.count).toBe(1)
  })

  it('재시도도_401_이면_거기서_멈춘다 — 재발급을 두 번 부르지 않는다', async () => {
    withCsrfCookie()
    setAccessToken('expired')
    const { fetchMock, refreshCalls } = route(renewed, [unauthenticated])

    await expect(request('/library')).rejects.toBeInstanceOf(ApiError)

    expect(refreshCalls.count).toBe(1)
    // 원 요청 두 번 + 재발급 한 번. 여기서 더 늘면 루프가 생긴 것이다.
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(hasAccessToken()).toBe(false)
  })

  it('동시에_401_을_받아도_재발급은_한_번이다 — in-flight 를 공유한다', async () => {
    withCsrfCookie()
    setAccessToken('expired')
    const seen = new Map<string, number>()
    const refreshCalls = { count: 0 }
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.endsWith('/auth/refresh')) {
          refreshCalls.count += 1
          return Promise.resolve(renewed())
        }
        const attempt = (seen.get(url) ?? 0) + 1
        seen.set(url, attempt)
        // 경로마다 첫 번째만 401 이다 — 셋이 동시에 재발급을 부르는 상황이 이것이다.
        return Promise.resolve(attempt === 1 ? unauthenticated() : json(200, { ok: true }))
      }),
    )

    await Promise.all([request('/library'), request('/me'), request('/sessions/1')])

    expect(refreshCalls.count).toBe(1)
  })

  it('CSRF_토큰이_없으면_재발급을_부르지_않는다 — 계약이 403 으로 답할 요청이다', async () => {
    setAccessToken('expired')
    const { fetchMock, refreshCalls } = route(unauthenticated, [unauthenticated])

    await expect(request('/library')).rejects.toBeInstanceOf(ApiError)

    expect(refreshCalls.count).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('F3_액세스토큰은_저장소에_가지_않는다 — 재발급이 생겨도 그대로다', async () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('sessionStorage', storage)
    withCsrfCookie()
    route(renewed, [() => json(200, {})])

    await expect(renewAccessToken()).resolves.toBe(true)

    expect(storage.setItem).not.toHaveBeenCalled()
    expect(storage.getItem).not.toHaveBeenCalled()
  })
})
