import { describe, expect, it } from 'vitest'

import type { ManuscriptEnding, ReasonCount, ReviewHistoryEntry } from '../../api/endpoints/admin'
import { REPORT_REASONS } from '../report/report'
import {
  AUTO_CHECK_VERDICT_LABEL,
  authorLabel,
  DEFAULT_DETAIL_PANEL,
  endingBadges,
  hasNote,
  HISTORY_REASON_LABEL,
  HISTORY_STAGE_LABEL,
  HISTORY_VERDICT_LABEL,
  panelInStatus,
  panelsFor,
  reasonCountsForDisplay,
  REPORT_REASON_LABEL,
  REPORT_STATUS_LABEL,
  reportTargetLabel,
} from './reviewDetail'
import { REJECT_REASON_LABEL } from './reviewQueue'

/**
 * 테스트 데이터에 **실제로 걸릴 법한 문자열을 넣지 않는다** (S-11 — 이 레포는 공개다).
 * 전부 무해한 더미다.
 */
function ending(overrides: Partial<ManuscriptEnding> = {}): ManuscriptEnding {
  return {
    endingNo: 1,
    label: '더미 엔딩',
    epilogueText: '더미 에필로그',
    secret: false,
    defaultEnding: false,
    ...overrides,
  }
}

function historyEntry(overrides: Partial<ReviewHistoryEntry> = {}): ReviewHistoryEntry {
  return {
    stage: 'human',
    verdict: 'reject',
    reasons: [],
    reviewedAt: '2026-09-01T00:00:00Z',
    note: null,
    ...overrides,
  }
}

describe('F6_작성자는_표시명_하나뿐이다', () => {
  it('표시명이_없으면_없다고만_적는다 — 서버가 이름을 지어내지 않으므로 화면도 짓지 않는다', () => {
    // 계약 `ReviewManuscript` 에 `playerRef` 가 아예 없다 (backend I-3). 이 함수가 받는
    // 값도 표시명 하나뿐이라, 식별자를 대신 넣을 자리가 코드에 없다.
    expect(authorLabel(null)).toBe('표시명 없음')
  })

  it('표시명이_있으면_그대로_적는다', () => {
    expect(authorLabel('더미 작성자')).toBe('더미 작성자')
  })
})

describe('R14_5_감사가_걸린_문은_필요할_때만_연다', () => {
  it('신고_면은_suspended_에서만_열린다 — 신고가 없는 작품에 열람 기록만 남기지 않는다', () => {
    expect(panelsFor('suspended')).toContain('reports')
    expect(panelsFor('in_review')).not.toContain('reports')
    expect(panelsFor('approved')).not.toContain('reports')
  })

  it('지난_판정은_어디서나_열린다 — 감사를 남기지 않고 세 갈래 모두에서 판정에 쓰인다', () => {
    for (const status of ['in_review', 'suspended', 'approved'] as const) {
      expect(panelsFor(status)).toContain('history')
      expect(panelsFor(status)).toContain('manuscript')
    }
  })

  it('열려_있던_면이_사라지면_기본으로_돌아간다 — 빈 패널을 열어 두지 않는다', () => {
    expect(panelInStatus('reports', 'in_review')).toBe(DEFAULT_DETAIL_PANEL)
    expect(panelInStatus('reports', 'suspended')).toBe('reports')
    expect(panelInStatus('history', 'in_review')).toBe('history')
  })
})

describe('§13-62_신고는_집계와_목록까지다', () => {
  it('많은_사유부터_그리고_동률은_신고_화면의_순서다', () => {
    const counts: ReasonCount[] = [
      { reason: 'other', count: 2 },
      { reason: 'real_person', count: 5 },
      { reason: 'inappropriate', count: 2 },
    ]

    expect(reasonCountsForDisplay(counts).map((each) => each.reason)).toEqual([
      'real_person',
      'inappropriate',
      'other',
    ])
  })

  it('서버가_준_배열을_흐트러뜨리지_않는다', () => {
    const counts: ReasonCount[] = [
      { reason: 'other', count: 1 },
      { reason: 'inappropriate', count: 9 },
    ]

    reasonCountsForDisplay(counts)

    expect(counts.map((each) => each.reason)).toEqual(['other', 'inappropriate'])
  })

  it('사유_문구는_신고_화면과_같다 — 이용자가 고른 이름과 검수자가 읽는 이름이 갈라지지 않는다', () => {
    for (const reason of REPORT_REASONS) {
      expect(REPORT_REASON_LABEL[reason.value]).toBe(reason.label)
    }
  })

  it('대상_턴이_null_인_것은_정상이다 — 작품 신고에는 턴이 없다', () => {
    // 계약이 *"키를 생략하지 않는다"* 고 적었으므로 키 존재 여부로 분기하지 않는다.
    expect(reportTargetLabel(null)).toBe('작품 전체')
    expect(reportTargetLabel(3)).toBe('3번째 장면')
  })

  it('처리_상태는_계약의_넷_그대로다', () => {
    expect(Object.keys(REPORT_STATUS_LABEL).sort()).toEqual([
      'actioned',
      'dismissed',
      'open',
      'reviewing',
    ])
  })
})

describe('R8_7_사유는_카테고리_이름까지다', () => {
  it('이력의_사유_문구가_판정_화면과_같다 — 같은 카테고리가 화면마다 다른 이름을 갖지 않는다', () => {
    expect(HISTORY_REASON_LABEL.minor_sexual).toBe(REJECT_REASON_LABEL.MINOR_SEXUAL)
    expect(HISTORY_REASON_LABEL.hate_speech).toBe(REJECT_REASON_LABEL.HATE_SPEECH)
    expect(Object.keys(HISTORY_REASON_LABEL)).toHaveLength(
      Object.keys(REJECT_REASON_LABEL).length,
    )
  })

  it('문구가_카테고리_이름을_넘지_않는다 — 어디가 왜 걸렸는지를 덧붙이면 우회 사전이 된다 (S-11)', () => {
    for (const label of Object.values(HISTORY_REASON_LABEL)) {
      expect(Object.values(REJECT_REASON_LABEL)).toContain(label)
    }
  })
})

describe('§13-63_자동과_사람을_섞지_않는다', () => {
  it('단계를_구분해_적는다 — 자동 통과는 사람이 본 것이 아니다 (R8.6)', () => {
    expect(HISTORY_STAGE_LABEL.auto).not.toBe(HISTORY_STAGE_LABEL.human)
  })

  it('보류는_아무것도_바꾸지_않았다는_기록이다', () => {
    expect(HISTORY_VERDICT_LABEL.hold).toBe('보류')
  })

  it('note_는_비어_있으면_그리지_않는다 — 자동 판정에는 사람이 없어 null 이다', () => {
    expect(hasNote(historyEntry({ stage: 'auto', verdict: 'pass', note: null }))).toBe(false)
    expect(hasNote(historyEntry({ note: '   ' }))).toBe(false)
    expect(hasNote(historyEntry({ note: '두 번째 검수자와 확인 필요' }))).toBe(true)
  })
})

describe('§13-42_자동_검수의_hold_는_사람이_봐야_한다는_표식이다', () => {
  it('보류를_판단이_끝난_것처럼_적지_않는다', () => {
    expect(AUTO_CHECK_VERDICT_LABEL.hold).toBe('사람이 봐야 함')
  })
})

describe('엔딩 표식', () => {
  it('계약의_boolean_둘만_읽는다 — 조건식은 계약에 없고 화면이 추측하지 않는다', () => {
    expect(endingBadges(ending())).toEqual([])
    expect(endingBadges(ending({ secret: true }))).toEqual(['숨은 엔딩'])
    expect(endingBadges(ending({ secret: true, defaultEnding: true }))).toEqual([
      '숨은 엔딩',
      '기본 엔딩',
    ])
  })
})
