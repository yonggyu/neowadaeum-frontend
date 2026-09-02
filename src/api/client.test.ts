import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, request, setAccessToken } from './client'

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
