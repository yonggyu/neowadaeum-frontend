import type { components } from '../schema'
import { request } from '../client'

/**
 * 탐색(Landing · Library · Story Detail)이 부르는 계약 경로.
 *
 * 타입을 손으로 적지 않는다 (F-2) — 전부 `schema.d.ts` 에서 좁혀 온다. 화면은 여기서
 * 내보내는 이름만 알면 되고, 계약이 바뀌면 이 파일이 먼저 빨개진다.
 */
type Schemas = components['schemas']

export type Genre = Schemas['Genre']
export type StoryCard = Schemas['StoryCard']
export type LibrarySection = Schemas['LibrarySection']
export type ContinueSession = Schemas['ContinueSession']
export type LibraryResponse = Schemas['LibraryResponse']
export type StoryDetailResponse = Schemas['StoryDetailResponse']
export type CharacterCard = Schemas['CharacterCard']
export type MySessionBrief = Schemas['MySessionBrief']
export type LandingResponse = Schemas['LandingResponse']
export type StartSessionResponse = Schemas['StartSessionResponse']

/**
 * 랜딩 (`getLanding`). **인증 없이 열린다** — `security: []`.
 *
 * `noticeText` 는 AI 사전 고지 문구이며 서버가 준 것만 쓴다. 프론트에 기본 문구를 두지
 * 않는다 (R11.1) — 그 문구는 반드시 그대로 운영에 나간다.
 */
export const getLanding = (signal?: AbortSignal): Promise<LandingResponse> =>
  request<LandingResponse>('/landing', { signal })

/** 라이브러리 (`getLibrary`). 장르 · 섹션 · 이어하기가 한 번에 온다. 비로그인은 401 이다. */
export const getLibrary = (signal?: AbortSignal): Promise<LibraryResponse> =>
  request<LibraryResponse>('/library', { signal })

/**
 * 섹션 하나 (`getLibrarySection`). 섹션 단위 재시도와 다음 쪽에 함께 쓴다.
 *
 * 페이지네이션은 **커서**다 — `cursor` 를 보내고 `nextCursor` 를 받는다. offset 이 아니다
 * (백엔드 13-25 의 키셋 정렬). `sectionKey` 는 `genre:romance` 처럼 `:` 를 담으므로 인코딩한다.
 */
export const getLibrarySection = (
  sectionKey: string,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<LibrarySection> => {
  const query = cursor == null ? '' : `?cursor=${encodeURIComponent(cursor)}`
  return request<LibrarySection>(`/library/sections/${encodeURIComponent(sectionKey)}${query}`, {
    signal,
  })
}

/**
 * 작품 상세 (`getStoryDetail`).
 *
 * `ageRating` 은 상수이지만 **서버가 준 값을 쓴다** — 작품별 컬럼이 아니라는 사실과, 그 문구를
 * 프론트가 정한다는 것은 다른 이야기다. 작성자는 `authorDisplayName` 뿐이다 (F-6).
 */
export const getStoryDetail = (
  storyId: string,
  signal?: AbortSignal,
): Promise<StoryDetailResponse> =>
  request<StoryDetailResponse>(`/stories/${encodeURIComponent(storyId)}`, { signal })

