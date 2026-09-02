import { describe, expect, it } from 'vitest'

import { REPORT_REASONS, reportRequest, storyTarget, turnTarget } from './report'

const STORY_ID = '11111111-2222-3333-4444-555555555555'
const SESSION_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

describe('reportRequest', () => {
  it('F2_계약이_정한_필드만_보낸다 — reportId·alreadyReported 를 만들지 않는다 (5d)', () => {
    const body = reportRequest(storyTarget(STORY_ID, '봄이 오기 전에'), 'ip_violation', '')

    // toEqual 이 아니라 키 전체를 본다 — 계약에 없는 필드가 하나라도 붙으면 여기서 걸린다.
    expect(body).toEqual({
      targetType: 'story',
      targetId: STORY_ID,
      reason: 'ip_violation',
      detail: null,
    })
  })

  it('장면_신고는_targetType_turn_이고_sessionId_turnNo_를_함께_보낸다 (§13-41)', () => {
    // 작품 신고와 **다른 요청**이다. 하나로 합치면 서버가 둘을 구분할 근거가 사라진다.
    const body = reportRequest(turnTarget(SESSION_ID, 12, 4), 'inappropriate', '내용 설명')

    expect(body).toEqual({
      targetType: 'turn',
      targetId: SESSION_ID,
      sessionId: SESSION_ID,
      turnNo: 12,
      reason: 'inappropriate',
      detail: '내용 설명',
    })
  })

  it('공백만_남은_상세는_null_로_보낸다 — 읽을 것이 없는 상세를 있는 것으로 세지 않는다', () => {
    const body = reportRequest(storyTarget(STORY_ID, '제목'), 'other', '   \n ')

    expect(body.detail).toBeNull()
  })

  it('사유는_계약의_enum_4종이다 — 화면이 값을 짓지 않는다', () => {
    expect(REPORT_REASONS.map((reason) => reason.value)).toEqual([
      'inappropriate',
      'ip_violation',
      'real_person',
      'other',
    ])
  })
})

describe('ReportTarget', () => {
  it('무엇을_신고하는지_이름과_부제로_보인다 (5d)', () => {
    // 결과가 다른 두 신고이므로 사용자가 고른 것이 무엇인지 화면에 남아 있어야 한다.
    expect(turnTarget(SESSION_ID, 12, 4).label).toBe('이 장면')
    expect(turnTarget(SESSION_ID, 12, 4).hint).toContain('Ch.4')
    expect(storyTarget(STORY_ID, '봄이 오기 전에').label).toBe('이 작품')
    expect(storyTarget(STORY_ID, '봄이 오기 전에').hint).toContain('봄이 오기 전에')
  })

  it('S11_대상_설명에_정지_임계나_그_동작을_적지_않는다', () => {
    const text = [...Object.values(turnTarget(SESSION_ID, 12, 4)), ...Object.values(storyTarget(STORY_ID, '제목'))]
      .filter((value) => typeof value === 'string')
      .join(' ')

    for (const forbidden of ['정지', '임계', '누적', '자동']) {
      expect(text).not.toContain(forbidden)
    }
  })
})
