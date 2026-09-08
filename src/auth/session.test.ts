import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hasAccessToken, setAccessToken } from '../api/client'
import type { MeResponse } from '../api/endpoints/me'
import { restoreSession } from './session'

const ACCOUNT: MeResponse = { displayName: null, role: 'user', status: 'active' }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** 계약의 오류 한 형태 (`{ error, message, details }`). `details` 는 `null` 이 되지 않는다. */
function errorResponse(status: number, error: string): Response {
  return jsonResponse(status, { error, message: '로그인이 필요해요.', details: {} })
}

function mockFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('restoreSession', () => {
  beforeEach(() => {
    setAccessToken(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setAccessToken(null)
  })

  it('토큰이_없고_재발급도_못_하면_GET_me_를_부르지_않는다 — 물어보지 못한 것과 거절당한 것은 다른 사실이다', async () => {
    // CSRF 쿠키가 없다 — 재발급은 성립하지 않는 요청이므로 나가지 않는다 (ADR-0008).
    const fetchMock = mockFetch(errorResponse(401, 'UNAUTHENTICATED'))

    expect(await restoreSession()).toEqual({ kind: 'anonymous', reason: 'no_token' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('토큰이_없으면_먼저_재발급한다 — 새로고침 뒤에도 로그인이 유지되는 자리가 여기다', async () => {
    vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=csrf-1' })
    const paths: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        paths.push(new URL(url).pathname)
        return Promise.resolve(
          url.endsWith('/auth/refresh')
            ? jsonResponse(200, { accessToken: 'fresh', tokenType: 'Bearer', expiresIn: 1800 })
            : jsonResponse(200, ACCOUNT),
        )
      }),
    )

    expect(await restoreSession()).toEqual({ kind: 'authenticated', account: ACCOUNT })
    // **순서가 요구사항이다** — 재발급이 `GET /me` 앞에 있고, 상태 셋은 그대로다 (#24 · #85).
    expect(paths).toEqual(['/api/v1/auth/refresh', '/api/v1/me'])
    expect(hasAccessToken()).toBe(true)
  })

  it('재발급이_거절되면_익명이다 — 쿠키가 없거나 만료됐다는 사실을 화면에 지어내 붙이지 않는다', async () => {
    vi.stubGlobal('document', { cookie: 'XSRF-TOKEN=csrf-1' })
    const fetchMock = mockFetch(errorResponse(401, 'UNAUTHENTICATED'))

    expect(await restoreSession()).toEqual({ kind: 'anonymous', reason: 'no_token' })
    // 재발급 한 번뿐이다 — 그 401 로 다시 재발급하지 않는다.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(hasAccessToken()).toBe(false)
  })

  it('200 이면 로그인됨이다 — 로그인 여부는 본문이 아니라 상태 코드가 답한다', async () => {
    setAccessToken('access-token')
    mockFetch(jsonResponse(200, ACCOUNT))

    expect(await restoreSession()).toEqual({ kind: 'authenticated', account: ACCOUNT })
  })

  it('401 이면 익명이고 토큰을 버린다 — 401 처리는 request 한곳에 있다', async () => {
    setAccessToken('expired-token')
    mockFetch(errorResponse(401, 'UNAUTHENTICATED'))

    expect(await restoreSession()).toEqual({ kind: 'anonymous', reason: 'rejected' })
    expect(hasAccessToken()).toBe(false)
  })

  it('서버가 답하지 못하면 unreachable 이다 — 토큰이 틀렸다는 뜻이 아니므로 버리지 않는다', async () => {
    setAccessToken('access-token')
    mockFetch(new TypeError('network error'))

    expect(await restoreSession()).toEqual({ kind: 'anonymous', reason: 'unreachable' })
    expect(hasAccessToken()).toBe(true)
  })

  it('F3_토큰을_스토리지에_두지_않는다 — 로그인부터 복원까지 저장소를 건드리지 않는다', async () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('sessionStorage', storage)
    setAccessToken('access-token')
    mockFetch(jsonResponse(200, ACCOUNT))

    await restoreSession()

    expect(storage.setItem).not.toHaveBeenCalled()
    expect(storage.getItem).not.toHaveBeenCalled()
  })

  it('F6_playerRef_와_이메일은_계정에 없다 — 계약이 주지 않는다 (§13-7, I-3)', () => {
    // @ts-expect-error 계약의 MeResponse 에 playerRef 가 없다. 이 줄이 컴파일되면 계약이 바뀐 것이다.
    expect(ACCOUNT.playerRef).toBeUndefined()
    // @ts-expect-error 이메일도 같다. 화면이 그리지 못하는 것이 아니라 받지 않는다.
    expect(ACCOUNT.email).toBeUndefined()
  })
})
