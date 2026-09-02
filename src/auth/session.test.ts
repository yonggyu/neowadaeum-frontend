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

  it('토큰이_없으면_GET_me_를_부르지_않는다 — 물어보지 못한 것과 거절당한 것은 다른 사실이다', async () => {
    const fetchMock = mockFetch(errorResponse(401, 'UNAUTHENTICATED'))

    expect(await restoreSession()).toEqual({ kind: 'anonymous', reason: 'no_token' })
    expect(fetchMock).not.toHaveBeenCalled()
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
