import { describe, expect, it } from 'vitest'

import { ApiError } from '../../api/client'
import { canSubmitCode, CODE_LENGTH, failureMessage, normalizeCode } from './twoFactor'

describe('normalizeCode', () => {
  it('계약이_받는_모양으로만_좁힌다 — TotpCodeRequest.code 는 ^[0-9]{6}$ 다', () => {
    expect(normalizeCode('123 456')).toBe('123456')
    expect(normalizeCode('12-34-56')).toBe('123456')
    expect(normalizeCode('1234567')).toBe('123456')
    expect(normalizeCode('abc')).toBe('')
    expect(normalizeCode('123456').length).toBe(CODE_LENGTH)
  })
})

describe('같은_코드는_두_번_보내지_않는다', () => {
  it('방금_보낸_여섯_자리는_다시_보낼_수_없다 — 한 스텝 동안 같은 코드가 유효하다', () => {
    expect(canSubmitCode('123456', { lastSubmitted: '123456', pending: false })).toBe(false)
  })

  it('새로_읽어_넣은_코드는_보낼_수_있다', () => {
    expect(canSubmitCode('654321', { lastSubmitted: '123456', pending: false })).toBe(true)
  })

  it('여섯_자리가_아니면_보내지_않는다', () => {
    expect(canSubmitCode('12345', { lastSubmitted: null, pending: false })).toBe(false)
    expect(canSubmitCode('', { lastSubmitted: null, pending: false })).toBe(false)
  })

  it('보내는_중에는_다시_보내지_않는다 — 재시도가 같은 코드를 자동으로 다시 보내면 안 된다', () => {
    expect(canSubmitCode('123456', { lastSubmitted: null, pending: true })).toBe(false)
  })
})

describe('S6_403_을_구분해_말하지_않는다', () => {
  /**
   * 계약: 등록 없음 · 확정 전 · 코드 불일치 · 재사용이 **전부 `403` 하나**다. 구분해 알리면
   * 그것이 곧 단서다. 화면이 그것을 되돌리지 않는다는 것을 이 셋이 지킨다.
   */
  it('서버가_준_문장을_그대로_낸다 (F-4)', () => {
    const failure = new ApiError(403, 'FORBIDDEN', '인증에 실패했어요.', {})

    expect(failureMessage(failure)).toBe('인증에 실패했어요.')
  })

  it('다른_403_이_와도_화면이_문구를_만들지_않는다', () => {
    const first = new ApiError(403, 'FORBIDDEN', '접근 권한이 없어요.', {})
    const second = new ApiError(403, 'FORBIDDEN', '인증에 실패했어요.', {})

    // 두 문장이 다른 것은 서버가 다르게 말했기 때문이다. 화면이 고른 결과가 아니다.
    expect(failureMessage(first)).toBe('접근 권한이 없어요.')
    expect(failureMessage(second)).toBe('인증에 실패했어요.')
  })

  it('status_로도_error_코드로도_details_로도_가르지_않는다', () => {
    const forbidden = new ApiError(403, 'FORBIDDEN', '같은 문장.', { hint: 'not_enrolled' })
    const invalid = new ApiError(400, 'VALIDATION_ERROR', '같은 문장.', {})

    // 같은 message 면 같은 결과다 — 어느 단계에서 어긋났는지가 화면에 드러나지 않는다.
    expect(failureMessage(forbidden)).toBe(failureMessage(invalid))
  })

  it('계약_밖_응답도_client_가_붙인_문장을_그대로_쓴다', () => {
    const offline = new ApiError(502, 'UNKNOWN', '요청이 실패했어요 (HTTP 502)', {})

    expect(failureMessage(offline)).toBe('요청이 실패했어요 (HTTP 502)')
  })
})
