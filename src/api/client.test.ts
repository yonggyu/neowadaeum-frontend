import { describe, expect, it } from 'vitest'

import { ApiError } from './client'

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
