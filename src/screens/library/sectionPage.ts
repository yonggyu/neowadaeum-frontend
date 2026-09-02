import { ApiError } from '../../api/client'
import type { LibrarySection, StoryCard } from '../../api/endpoints/library'
import type { CursorPage } from '../../hooks/usePagedApi'
import { canLoadMore } from './sections'

/**
 * 섹션 응답 하나를 커서 페이지네이션 훅이 아는 모양으로 옮긴다.
 *
 * `LibrarySection` 과 `CursorPage` 는 **같은 규약의 다른 이름**이다 — 계약의 목록 응답은
 * 전부 `items · nextCursor · hasMore` 세 필드로 쪽을 넘긴다. 그 사실을 여기 한 줄로 적고,
 * 페이지네이션 자체는 `usePagedApi` 가 그대로 한다. 이 화면을 위해 새 훅을 만들지 않는다.
 *
 * `noticeText` 도 함께 옮긴다. 계약이 이 응답에 문구를 실어 주므로(백엔드 #289) 이 화면이
 * `/landing` 을 따로 부를 이유가 사라졌다 — PR #36 이 걷어낸 우회가 여기서 되살아나지 않는다.
 *
 * `hasMore` 를 그대로 넘기지 않고 `canLoadMore` 를 통과시킨다 (F-2 로 생성한 타입이 말해 준다 —
 * `nextCursor` 는 optional 이다). 커서 없이 `hasMore` 만 참이면 "더 보기"가 **첫 쪽을 무한히**
 * 다시 가져온다. 그 판단은 이미 `sections.ts` 에 있고, 두 번째로 적지 않는다.
 */
export function toCursorPage(section: LibrarySection): CursorPage<StoryCard> {
  return {
    items: section.stories,
    nextCursor: section.nextCursor ?? null,
    hasMore: canLoadMore(section),
    noticeText: section.noticeText,
  }
}

/**
 * 없는 섹션 키인가.
 *
 * 계약이 이 경로에 `404` 를 정의했고(`getLibrarySection`), 섹션 키가 **URL 에 있으므로**
 * 사용자가 아무 값이나 들고 올 수 있다. 다시 시도해도 결과가 같은 유일한 실패라서,
 * 화면은 여기에만 "재시도" 대신 **나가는 길**을 준다.
 *
 * 문구는 서버의 `message` 를 그대로 쓴다 (F-4) — 이 함수가 정하는 것은 *덧붙일 행동* 하나다.
 */
export function isMissingSection(error: unknown): boolean {
  return error instanceof ApiError && error.errorCode === 'NOT_FOUND'
}
