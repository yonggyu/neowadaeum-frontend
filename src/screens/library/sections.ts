import type { LibrarySection } from '../../api/endpoints/library'

/** 사용자 작품이 모이는 섹션 하나. 장르 섹션은 공식 작품만 담는다 (백엔드 13-25). */
export const COMMUNITY_SECTION = 'community'

/** 장르 칩이 고르는 섹션 키. 계약의 `genre:<key>` 형식이다. */
export const genreSectionKey = (genreId: string): string => `genre:${genreId}`

/**
 * 스크롤 순서를 고정한다 — 이어하기 → 공식 → 커뮤니티 (3g).
 *
 * 이어하기는 섹션 배열 밖(`continueSessions`)에 있으므로 화면이 위에 둔다. 여기서 하는 일은
 * **공식과 커뮤니티를 가르는 것 하나**다. 서버가 준 순서를 흐트러뜨리지 않고 커뮤니티만
 * 끝으로 민다 — 섞으면 R13.1 이 금지하는 "같은 그리드에 공식과 UGC" 가 된다.
 */
export function orderSections(sections: readonly LibrarySection[]): LibrarySection[] {
  const official = sections.filter((s) => s.sectionKey !== COMMUNITY_SECTION)
  const community = sections.filter((s) => s.sectionKey === COMMUNITY_SECTION)
  return [...official, ...community]
}

/**
 * 다음 쪽을 이어 붙인다.
 *
 * 커서 페이지네이션이므로 **누적**이지 교체가 아니다. `hasMore` · `nextCursor` 는 언제나
 * 마지막 쪽의 것을 쓴다 — 첫 쪽의 커서를 남겨 두면 "더 보기"가 같은 쪽을 무한히 가져온다.
 *
 * `storyId` 로 중복을 걷어낸다. 키셋 정렬이 경계 중복을 막게 되어 있지만(13-25), 같은 작품이
 * 두 번 들어오면 화면에서는 React key 충돌로 나타나고 그때는 원인이 보이지 않는다.
 */
export function appendPage(current: LibrarySection, next: LibrarySection): LibrarySection {
  const seen = new Set(current.stories.map((story) => story.storyId))
  return {
    ...next,
    stories: [...current.stories, ...next.stories.filter((s) => !seen.has(s.storyId))],
  }
}

/** "더 보기"를 그릴지. `hasMore` 만으로는 부족하다 — 커서가 없으면 다음 쪽을 부를 수 없다. */
export const canLoadMore = (section: LibrarySection): boolean =>
  section.hasMore && typeof section.nextCursor === 'string' && section.nextCursor.length > 0
