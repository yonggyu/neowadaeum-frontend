import { describe, expect, it } from 'vitest'

import type { LibrarySection, StoryCard } from '../../api/endpoints/library'
import { appendPage, canLoadMore, genreSectionKey, orderSections } from './sections'

const story = (storyId: string): StoryCard => ({
  storyId,
  title: storyId,
  coverImage: null,
  genres: [],
  shortDescription: '',
  isNew: false,
  authorType: 'official',
  // 계약이 `authorDisplayName` 을 required 로 만들었다 (백엔드 #258). 공식 작품에는
  // 작성자가 없으므로 `null` 이다 — 값을 지어내지 않는다 (F-6).
  authorDisplayName: null,
})

const section = (
  sectionKey: string,
  stories: StoryCard[],
  rest: Partial<LibrarySection> = {},
): LibrarySection => ({
  sectionKey,
  sectionTitle: sectionKey,
  hasMore: false,
  stories,
  // 계약이 required 로 만들었다 (백엔드 #289) — Footer 를 그리는 화면의 응답은 문구를 싣는다
  noticeText: 'AI 가 만든 이야기입니다.',
  ...rest,
})

describe('orderSections — 스크롤 순서 고정 (3g · R13.1)', () => {
  it('커뮤니티를 언제나 마지막에 둔다', () => {
    const ordered = orderSections([
      section('community', []),
      section('recommended', []),
      section('genre:romance', []),
    ])

    expect(ordered.map((s) => s.sectionKey)).toEqual([
      'recommended',
      'genre:romance',
      'community',
    ])
  })

  it('공식 섹션끼리는 서버가 준 순서를 바꾸지 않는다', () => {
    const ordered = orderSections([
      section('genre:fantasy', []),
      section('recommended', []),
      section('genre:romance', []),
    ])

    expect(ordered.map((s) => s.sectionKey)).toEqual([
      'genre:fantasy',
      'recommended',
      'genre:romance',
    ])
  })

  it('입력 배열을 제자리에서 고치지 않는다', () => {
    const input = [section('community', []), section('recommended', [])]
    orderSections(input)
    expect(input.map((s) => s.sectionKey)).toEqual(['community', 'recommended'])
  })
})

describe('appendPage — 커서 페이지네이션 누적', () => {
  it('다음 쪽을 교체하지 않고 이어 붙인다', () => {
    const merged = appendPage(
      section('recommended', [story('a'), story('b')], { hasMore: true, nextCursor: 'c1' }),
      section('recommended', [story('c')], { hasMore: false, nextCursor: null }),
    )

    expect(merged.stories.map((s) => s.storyId)).toEqual(['a', 'b', 'c'])
  })

  it('커서와 hasMore 는 마지막 쪽의 값을 쓴다', () => {
    const merged = appendPage(
      section('recommended', [story('a')], { hasMore: true, nextCursor: 'c1' }),
      section('recommended', [story('b')], { hasMore: true, nextCursor: 'c2' }),
    )

    expect(merged.nextCursor).toBe('c2')
    expect(merged.hasMore).toBe(true)
  })

  it('쪽 경계에서 같은 작품이 두 번 와도 한 번만 남긴다', () => {
    const merged = appendPage(
      section('recommended', [story('a'), story('b')], { hasMore: true, nextCursor: 'c1' }),
      section('recommended', [story('b'), story('c')]),
    )

    expect(merged.stories.map((s) => s.storyId)).toEqual(['a', 'b', 'c'])
  })
})

describe('canLoadMore — 커서가 없으면 다음 쪽을 부를 수 없다', () => {
  it('hasMore 이고 커서가 있으면 참이다', () => {
    expect(canLoadMore(section('recommended', [], { hasMore: true, nextCursor: 'c1' }))).toBe(true)
  })

  it('hasMore 라도 커서가 null 이면 거짓이다', () => {
    expect(canLoadMore(section('recommended', [], { hasMore: true, nextCursor: null }))).toBe(false)
  })

  it('커서가 있어도 hasMore 가 거짓이면 거짓이다', () => {
    expect(canLoadMore(section('recommended', [], { hasMore: false, nextCursor: 'c1' }))).toBe(
      false,
    )
  })
})

describe('genreSectionKey — 계약의 `genre:<key>` 형식', () => {
  it('장르 id 앞에 접두어를 붙인다', () => {
    expect(genreSectionKey('romance')).toBe('genre:romance')
  })
})
