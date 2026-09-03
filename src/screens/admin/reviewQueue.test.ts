import { describe, expect, it } from 'vitest'

import type { ReviewQueueItem } from '../../api/endpoints/admin'
import {
  buildVerdict,
  canDecide,
  isTextEntry,
  itemsInTab,
  moveSelection,
  needsConfirmation,
  NOTE_MAX_LENGTH,
  QUEUE_TABS,
  REJECT_REASON_LABEL,
  REJECT_REASONS,
  shortcutFor,
  verdictLabel,
  type RejectReason,
} from './reviewQueue'

/**
 * 테스트 데이터에 **실제로 걸릴 법한 문자열을 넣지 않는다** (S-11 — 이 레포는 공개다).
 * 걸리는 표현이 픽스처에 남으면 그 파일이 곧 우회 사전이 된다. 전부 무해한 더미다.
 */
const NOTE = '내부 메모 — 두 번째 검수자와 확인 필요'

function queueItem(overrides: Partial<ReviewQueueItem> = {}): ReviewQueueItem {
  return {
    storyId: '00000000-0000-4000-8000-000000000001',
    title: '더미 작품',
    reviewStatus: 'in_review',
    queuedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

describe('R8_7_반려_사유는_카테고리를_넘지_않는다', () => {
  it('reasons 에는 계약의 카테고리만 실린다', () => {
    const body = buildVerdict({
      verdict: 'REJECT',
      reasons: ['IP_REPLICATION', 'REAL_PERSON_HARM'],
      note: NOTE,
    })

    expect(body.reasons).toEqual(['IP_REPLICATION', 'REAL_PERSON_HARM'])
    for (const reason of body.reasons ?? []) {
      expect(REJECT_REASONS).toContain(reason)
    }
  })

  it('검수자가 적은 note 는 reasons 로 새지 않는다 — 작성자에게 가는 것은 reasons 뿐이다', () => {
    const body = buildVerdict({ verdict: 'REJECT', reasons: ['HATE_SPEECH'], note: NOTE })

    expect(JSON.stringify(body.reasons)).not.toContain(NOTE)
    expect(body.note).toBe(NOTE)
  })

  it('통과·보류에는 reasons 가 실리지 않는다 — 승인 통보에 반려 사유가 함께 가면 안 된다', () => {
    const reasons: RejectReason[] = ['RATING_EXCEEDED']

    expect(buildVerdict({ verdict: 'PASS', reasons, note: '' }).reasons).toBeUndefined()
    expect(buildVerdict({ verdict: 'HOLD', reasons, note: '' }).reasons).toBeUndefined()
  })

  it('note 는 계약의 상한에서 잘리고, 비면 아예 실리지 않는다', () => {
    const long = 'x'.repeat(NOTE_MAX_LENGTH + 40)

    expect(buildVerdict({ verdict: 'HOLD', reasons: [], note: long }).note).toHaveLength(
      NOTE_MAX_LENGTH,
    )
    expect(buildVerdict({ verdict: 'HOLD', reasons: [], note: '   ' }).note).toBeUndefined()
  })

  it('고를 수 있는 사유가 계약의 카테고리 전부다 — 화면에서만 빠진 사유가 없다', () => {
    expect(REJECT_REASONS).toEqual(Object.keys(REJECT_REASON_LABEL))
    expect(REJECT_REASONS).toHaveLength(7)
  })

  it('사유 없는 반려는 보낼 수 없다 — 작성자가 고칠 자리를 알 수 없다', () => {
    expect(canDecide({ verdict: 'REJECT', reasons: [], pending: false })).toBe(false)
    expect(canDecide({ verdict: 'REJECT', reasons: ['MINOR_SEXUAL'], pending: false })).toBe(true)
    expect(canDecide({ verdict: 'PASS', reasons: [], pending: false })).toBe(true)
    expect(canDecide({ verdict: 'PASS', reasons: [], pending: true })).toBe(false)
  })
})

describe('단축키는_입력_중에_발동하지_않는다', () => {
  it('글자를 넣는 자리에서는 A·R·H·J·K 가 전부 아무것도 아니다', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      for (const key of ['a', 'r', 'h', 'j', 'k']) {
        expect(shortcutFor({ key, target: { tagName } })).toBeNull()
      }
    }
  })

  it('contenteditable 도 글자를 넣는 자리다', () => {
    expect(isTextEntry({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(isTextEntry({ tagName: 'DIV' })).toBe(false)
    expect(isTextEntry(null)).toBe(false)
  })

  it('사유 메모를 쓰다 A 를 눌러도 승인이 되지 않는다 — 되돌릴 수 없는 동작이다', () => {
    expect(shortcutFor({ key: 'a', target: { tagName: 'textarea' } })).toBeNull()
  })

  it('수식 키가 눌려 있으면 우리 것이 아니다 — Cmd+R 은 새로고침이지 반려가 아니다', () => {
    expect(shortcutFor({ key: 'r', metaKey: true, target: null })).toBeNull()
    expect(shortcutFor({ key: 'r', ctrlKey: true, target: null })).toBeNull()
    expect(shortcutFor({ key: 'a', altKey: true, target: null })).toBeNull()
  })

  it('그 밖의 자리에서는 3h 가 적은 다섯이 그대로 동작한다', () => {
    expect(shortcutFor({ key: 'a', target: { tagName: 'BUTTON' } })).toBe('PASS')
    expect(shortcutFor({ key: 'R', target: null })).toBe('REJECT')
    expect(shortcutFor({ key: 'h', target: { tagName: 'BODY' } })).toBe('HOLD')
    expect(shortcutFor({ key: 'j', target: null })).toBe('next')
    expect(shortcutFor({ key: 'k', target: null })).toBe('previous')
    expect(shortcutFor({ key: 'z', target: null })).toBeNull()
  })
})

describe('되돌릴_수_없는_판정_앞에_확인이_있다', () => {
  it('통과와 반려는 확인을 묻고, 보류는 묻지 않는다', () => {
    expect(needsConfirmation('PASS')).toBe(true)
    expect(needsConfirmation('REJECT')).toBe(true)
    expect(needsConfirmation('HOLD')).toBe(false)
  })
})

describe('큐는_계약의_reviewStatus_로만_갈린다', () => {
  it('탭 셋이 계약의 세 상태 그대로다', () => {
    expect(QUEUE_TABS).toEqual(['in_review', 'suspended', 'approved'])
  })

  it('탭은 서버가 준 순서를 흐트러뜨리지 않는다 — 오래 기다린 것부터다', () => {
    const queue = [
      queueItem({ storyId: 'a', reviewStatus: 'in_review' }),
      queueItem({ storyId: 'b', reviewStatus: 'suspended' }),
      queueItem({ storyId: 'c', reviewStatus: 'in_review' }),
    ]

    expect(itemsInTab(queue, 'in_review').map((item) => item.storyId)).toEqual(['a', 'c'])
    expect(itemsInTab(queue, 'suspended').map((item) => item.storyId)).toEqual(['b'])
    expect(itemsInTab(queue, 'approved')).toEqual([])
  })

  it('통과가 무엇을 하는지는 작품이 어디서 왔는지가 정한다 (§13-42)', () => {
    expect(verdictLabel('in_review', 'PASS')).toContain('공개')
    expect(verdictLabel('suspended', 'PASS')).not.toContain('공개')
    expect(verdictLabel('approved', 'PASS')).not.toContain('공개')
    expect(verdictLabel('suspended', 'REJECT')).toBe('반려')
  })
})

describe('J_K_이동', () => {
  it('끝에서 멈춘다 — 감싸 돌면 같은 작품을 두 번 판정하게 된다', () => {
    expect(moveSelection(3, 0, 'previous')).toBe(0)
    expect(moveSelection(3, 2, 'next')).toBe(2)
    expect(moveSelection(3, 1, 'next')).toBe(2)
    expect(moveSelection(3, 1, 'previous')).toBe(0)
  })

  it('빈 큐에서는 아무 데도 가지 않는다', () => {
    expect(moveSelection(0, 0, 'next')).toBe(0)
  })
})
