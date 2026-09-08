import { describe, expect, it } from 'vitest'

import {
  APPEAL_REASON_MAX,
  canSubmitAppeal,
  STORY_APPEAL_NOTICE,
  STORY_DELETE_NOTICE,
} from './storyActions'

/**
 * 탈퇴 문구(`accountSettings.test.ts`)가 세운 방식 그대로다 — **문구가 결과를 단정하지
 * 않는지를 금지어로 붙잡는다.** 그쪽이 막는 것은 파기 배치 전에 "즉시 삭제" 라고 말하는 것이고,
 * 여기서 막는 것은 기록이 남는데 "완전히 삭제" 라고 말하는 것이다.
 */
describe('작품 삭제 문구 (계약 deleteStory, 정정본 §13-58)', () => {
  const text = STORY_DELETE_NOTICE.join('\n')

  it('F4_삭제_문구가_결과를_단정하지_않는다', () => {
    // 계약: 세션 · 턴 · 스냅샷 · 도달률 · 신고 · 검수 이력은 **남는다.** 지워지는 것은
    // 목록 · 상세 · 이어하기다. "완전히" · "영구" 는 그 사실과 어긋난다.
    for (const forbidden of ['완전히', '영구', '즉시', '파기', '모두 삭제', '흔적']) {
      expect(text, forbidden).not.toContain(forbidden)
    }
  })

  it('무엇이_남는지를_말한다 — 남는_것을_숨기면_사용자가_지웠다고_믿는다', () => {
    expect(STORY_DELETE_NOTICE.some((line) => line.includes('남습니다'))).toBe(true)
  })

  it('되돌릴_수_없다는_사실은_단정한다 — 복구_경로가_계약에_없다', () => {
    expect(STORY_DELETE_NOTICE.some((line) => line.includes('되돌릴 수 없습니다'))).toBe(true)
  })

  it('B56_다시_내면_새_작품이_된다고_말한다 — 재제출이_아니다', () => {
    expect(STORY_DELETE_NOTICE.some((line) => line.includes('새 작품'))).toBe(true)
  })

  it('F6_문구에_회원_식별정보를_끼워_넣을_자리가_없다', () => {
    // 상수이고 값을 받지 않는다 — `player_ref` · 이메일이 들어갈 틈이 없다.
    expect(text).not.toMatch(/@|ref|Ref/)
  })
})

describe('재검토 요청 문구 (계약 appealStorySuspension, 정정본 §13-59)', () => {
  const text = STORY_APPEAL_NOTICE.join('\n')

  /**
   * **이 요청은 작품의 상태를 바꾸지 않는다** (I-8). 정지된 작품은 이미 인간 검수 큐에 있고,
   * 화면이 상태가 달라진 것처럼 말하면 작성자가 검수 결과를 되돌리는 것처럼 보인다.
   */
  it('I8_요청이_상태를_바꾼다고_말하지_않는다', () => {
    for (const forbidden of ['재검토 중', '검수 중으로', '복구됩니다', '해제', '되돌']) {
      expect(text, forbidden).not.toContain(forbidden)
    }
  })

  it('상태가_그대로라는_것을_말한다', () => {
    expect(STORY_APPEAL_NOTICE.some((line) => line.includes('달라지지는 않습니다'))).toBe(true)
  })

  it('순서를_앞당기지_않는다고_말한다 — 요청은_공짜다', () => {
    expect(STORY_APPEAL_NOTICE.some((line) => line.includes('차례가 앞당겨지지는'))).toBe(true)
  })

  it('사유는_필수이고_상한은_계약의_값이다', () => {
    expect(APPEAL_REASON_MAX).toBe(500)
    expect(canSubmitAppeal('')).toBe(false)
    expect(canSubmitAppeal('   ')).toBe(false)
    expect(canSubmitAppeal('한 줄')).toBe(true)
    expect(canSubmitAppeal('가'.repeat(APPEAL_REASON_MAX))).toBe(true)
    expect(canSubmitAppeal('가'.repeat(APPEAL_REASON_MAX + 1))).toBe(false)
  })
})
