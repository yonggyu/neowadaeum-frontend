import { describe, expect, it } from 'vitest'

import { isPreviewOver, previewTurnLabel } from './preview'

/**
 * R8.13 은 미리보기를 *"3턴 후 자동 종료"* 로 적지만, 정정본 §13-36 은 그 값을
 * `play_session.turn_limit` 에 두기로 정했다 — `is_test_session` 인 세션이 미리보기만이
 * 아니기 때문이다. 그러므로 **3 은 이 코드 어디에도 없어야 한다.**
 */
describe('미리보기 상한 — turnLimit 은 세션이 준 값이다 (§13-36)', () => {
  it('상한이_3_이_아니어도_그_값으로_끝난다', () => {
    expect(isPreviewOver(3, 7)).toBe(false)
    expect(isPreviewOver(6, 7)).toBe(false)
    expect(isPreviewOver(7, 7)).toBe(true)
  })

  it('상한이_3_일_때도_같은_규칙_하나로_판정한다', () => {
    expect(isPreviewOver(2, 3)).toBe(false)
    expect(isPreviewOver(3, 3)).toBe(true)
  })

  /** 상한을 넘겨 버린 세션(관리자 디버그 등)도 끝난 것으로 읽는다 — `===` 로 재지 않는 이유다. */
  it('상한을_넘긴_턴도_끝난_것이다', () => {
    expect(isPreviewOver(9, 3)).toBe(true)
  })

  it('표시도_받은_상한을_그대로_쓴다', () => {
    expect(previewTurnLabel(1, 5)).toBe('TURN 1 / 5')
    expect(previewTurnLabel(1, 3)).toBe('TURN 1 / 3')
  })
})
