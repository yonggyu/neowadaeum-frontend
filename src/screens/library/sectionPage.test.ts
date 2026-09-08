import { describe, expect, it } from 'vitest'

import { ApiError } from '../../api/client'
import type { LibrarySection, StoryCard } from '../../api/endpoints/library'
import { storyCardMeta } from './author'
import { isMissingSection, toCursorPage } from './sectionPage'

const story = (storyId: string, rest: Partial<StoryCard> = {}): StoryCard => ({
  storyId,
  title: storyId,
  coverImage: null,
  genres: [],
  shortDescription: '',
  isNew: false,
  authorType: 'user',
  authorDisplayName: null,
  ...rest,
})

const section = (rest: Partial<LibrarySection> = {}): LibrarySection => ({
  sectionKey: 'community',
  sectionTitle: '커뮤니티 작품',
  hasMore: false,
  stories: [],
  // 계약이 required 로 만들었다 (백엔드 #289) — Footer 를 그리는 화면의 응답은 문구를 싣는다
  noticeText: 'AI 가 만든 이야기입니다.',
  ...rest,
})

describe('toCursorPage — 섹션 응답을 커서 쪽으로 (F-2)', () => {
  it('F2_계약이_준_필드만_옮긴다', () => {
    const page = toCursorPage(
      section({ stories: [story('a'), story('b')], hasMore: true, nextCursor: 'c1' }),
    )

    expect(page.items.map((s) => s.storyId)).toEqual(['a', 'b'])
    expect(page.nextCursor).toBe('c1')
    expect(page.hasMore).toBe(true)
  })

  it('백엔드289_고지문을_자기_응답에서_실어_나른다', () => {
    // 이 화면이 처음 섰을 때 `LibrarySection` 에는 `noticeText` 가 없었고, 그래서 Footer 를
    // 그리지 않았다. 계약이 채운 지금 **여기서 끊기면** 화면은 다시 문구를 잃고, 그때 가장
    // 쉬운 복구가 `/landing` 재호출 — PR #36 이 걷어낸 그 우회다. 그 길을 막는 테스트다.
    const page = toCursorPage(section({ noticeText: 'AI 가 만든 이야기입니다.' }))

    expect(page.noticeText).toBe('AI 가 만든 이야기입니다.')
  })

  it('R11_1_문구의_기본값을_프론트가_만들지_않는다', () => {
    // 서버가 빈 문자열을 주면 빈 문자열이다. 여기서 폴백을 끼우면 프론트가 고지를 지어낸 것이 된다.
    expect(toCursorPage(section({ noticeText: '' })).noticeText).toBe('')
  })

  it('커서가_없으면_더_보기를_열지_않는다', () => {
    // `hasMore` 만 믿으면 커서 없이 첫 쪽을 무한히 다시 가져온다.
    expect(toCursorPage(section({ hasMore: true })).hasMore).toBe(false)
    expect(toCursorPage(section({ hasMore: true, nextCursor: null })).hasMore).toBe(false)
    expect(toCursorPage(section({ hasMore: true, nextCursor: '' })).hasMore).toBe(false)
  })

  it('nextCursor_가_없으면_null_로_준다', () => {
    // 계약이 optional 로 두었다. `undefined` 를 그대로 흘리면 훅의 커서가 두 모양이 된다.
    expect(toCursorPage(section()).nextCursor).toBeNull()
  })
})

describe('isMissingSection — 없는 섹션 키만 갈라낸다 (F-4)', () => {
  it('F4_NOT_FOUND_만_없는_섹션으로_본다', () => {
    expect(isMissingSection(new ApiError(404, 'NOT_FOUND', '섹션을 찾을 수 없어요.', {}))).toBe(true)
  })

  it('다른_실패는_재시도할_수_있는_실패로_남긴다', () => {
    expect(isMissingSection(new ApiError(401, 'UNAUTHENTICATED', '로그인이 필요해요.', {}))).toBe(
      false,
    )
    expect(isMissingSection(new ApiError(0, 'UNKNOWN', '서버에 연결하지 못했어요.', {}))).toBe(false)
    expect(isMissingSection(new Error('boom'))).toBe(false)
    expect(isMissingSection(null)).toBe(false)
  })
})

describe('커뮤니티 카드의 작성자 표기 (F-6 · R13.1)', () => {
  it('F6_authorDisplayName_말고_다른_식별자를_쓰지_않는다', () => {
    // 표기 규칙은 `author.ts` 하나다. 이 화면이 두 번째 규칙을 두지 않는다는 것을 고정한다.
    expect(storyCardMeta(story('a', { authorDisplayName: '연우', genres: ['판타지'] }))).toBe(
      '@연우 · 판타지',
    )
  })

  it('닉네임이_없는_UGC_는_장르만_남는다', () => {
    expect(storyCardMeta(story('a', { genres: ['미스터리'] }))).toBe('미스터리')
  })
})
