import { describe, expect, it } from 'vitest'

import type { AdminSessionListItem } from '../../api/endpoints/admin'
import {
  filterChipLabel,
  hiddenTestCount,
  loadedCountLabel,
  MISSING_TITLE,
  normalizeStoryId,
  SESSION_BADGE_LABEL,
  SESSION_STATUS_LABEL,
  sessionBadges,
  sessionTitleLabel,
  turnChapterCompact,
  turnChapterVerbose,
  visibleSessions,
} from './sessionList'

const STORY_ID = '00000000-0000-4000-8000-000000000001'

function session(overrides: Partial<AdminSessionListItem> = {}): AdminSessionListItem {
  return {
    sessionId: '00000000-0000-4000-8000-0000000000a1',
    storyId: STORY_ID,
    storyVersionId: '00000000-0000-4000-8000-0000000000b1',
    storyTitle: '더미 작품',
    status: 'active',
    turnNo: 18,
    chapterNo: 3,
    testSession: false,
    deletedAt: null,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-04T00:00:00Z',
    ...overrides,
  }
}

describe('F6_이_목록에는_사람이_없다', () => {
  it('계약이 준 필드에 플레이어 식별자가 없다 — 화면이 그 자리를 만들지 않는다', () => {
    // 픽스처가 곧 계약의 `required` 전부다. `playerRef` 를 더하면 타입이 막는다 (F-2).
    expect(Object.keys(session())).not.toContain('playerRef')
  })

  it('좁히는 값은 작품 하나뿐이고, 공백만 붙어 온 것은 좁히지 않은 것과 같다', () => {
    expect(normalizeStoryId(`  ${STORY_ID}\n`)).toBe(STORY_ID)
    expect(normalizeStoryId('   ')).toBe('')
  })

  it('형식은 프론트가 판정하지 않는다 — 서버가 답하고 그 문장이 화면에 온다 (F-4)', () => {
    expect(normalizeStoryId('작품-아님')).toBe('작품-아님')
  })
})

describe('없는_이름을_지어내지_않는다', () => {
  it('제목이 null 이면 없다고 적는다 — 식별자를 대신 넣지 않는다', () => {
    expect(sessionTitleLabel(null)).toBe(MISSING_TITLE)
    expect(sessionTitleLabel(null)).not.toContain(STORY_ID)
    expect(sessionTitleLabel('여름의 끝에서')).toBe('여름의 끝에서')
  })

  it('좁힌 칩도 이름을 받은 세션에서만 이름을 가져온다', () => {
    expect(filterChipLabel([session({ storyTitle: '돌아온 캠퍼스' })])).toBe('돌아온 캠퍼스')
    expect(filterChipLabel([session({ storyTitle: null })])).not.toContain(STORY_ID)
    expect(filterChipLabel([])).not.toContain(STORY_ID)
  })

  it('전체 건수를 지어내지 않는다 — 계약이 담지 않았다', () => {
    expect(loadedCountLabel(24, false)).toBe('24건')
    expect(loadedCountLabel(20, true)).toContain('더 있음')
    expect(loadedCountLabel(0, false)).toBe('0건')
  })
})

describe('실제_플레이와_섞어_그리지_않는다', () => {
  it('미리보기 세션과 지워진 세션은 그 사실을 달고 나온다', () => {
    expect(sessionBadges(session())).toEqual([])
    expect(sessionBadges(session({ testSession: true }))).toEqual(['test'])
    expect(sessionBadges(session({ deletedAt: '2026-09-03T00:00:00Z' }))).toEqual(['deleted'])
    expect(
      sessionBadges(session({ testSession: true, deletedAt: '2026-09-03T00:00:00Z' })),
    ).toEqual(['test', 'deleted'])
  })

  it('표시 문구가 둘 다 있다 — 배지를 그릴 자리는 계약의 두 필드가 정한다', () => {
    expect(SESSION_BADGE_LABEL.test).toBe('테스트')
    expect(SESSION_BADGE_LABEL.deleted).toBe('지워짐')
  })

  it('계약의 상태 넷에 전부 이름이 있다 — 화면에서만 비는 상태가 없다', () => {
    expect(Object.keys(SESSION_STATUS_LABEL)).toEqual([
      'active',
      'completed',
      'abandoned',
      'expired',
    ])
  })
})

describe('테스트_세션_토글은_받아_온_쪽_안에서만_접는다', () => {
  const items = [session({ sessionId: 'a' }), session({ sessionId: 'b', testSession: true })]

  it('포함하면 서버가 준 것을 그대로 둔다', () => {
    expect(visibleSessions(items, true)).toHaveLength(2)
    expect(hiddenTestCount(items, true)).toBe(0)
  })

  it('접으면 미리보기만 빠지고, 몇 건을 접었는지 함께 말한다', () => {
    expect(visibleSessions(items, false).map((item) => item.sessionId)).toEqual(['a'])
    expect(hiddenTestCount(items, false)).toBe(1)
  })

  it('지워진 세션은 접히지 않는다 — 계약이 보이기로 한 것이고 토글의 축이 아니다', () => {
    const deleted = [session({ sessionId: 'c', deletedAt: '2026-09-03T00:00:00Z' })]
    expect(visibleSessions(deleted, false)).toHaveLength(1)
  })
})

describe('턴과_챕터', () => {
  it('표에는 헤더가 있고 카드에는 없다 — 카드 쪽이 무엇의 숫자인지 말한다', () => {
    expect(turnChapterCompact(session())).toBe('18 / 3')
    expect(turnChapterVerbose(session())).toBe('턴 18 · 챕터 3')
  })
})
