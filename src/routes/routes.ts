/**
 * 경로를 한곳에 모은다.
 *
 * 화면이 문자열을 직접 적으면 오타가 런타임까지 살아 있고, 경로를 바꿀 때 어디를 고쳐야
 * 하는지 알 수 없다. 슬라이스가 셋으로 갈라져 병렬로 붙는 동안에는 특히 그렇다.
 *
 * **`player_ref` 를 경로에 담지 않는다 (F-6).** 여기 들어가는 식별자는 작품·세션 것뿐이다.
 */
export const ROUTES = {
  landing: '/',
  login: '/login',
  library: '/library',
  librarySection: '/library/sections/:sectionKey',
  storyDetail: '/stories/:storyId',
  play: '/sessions/:sessionId',
  resume: '/sessions/:sessionId/resume',
  history: '/sessions/:sessionId/history',
  myStories: '/me/stories',
  myStory: '/me/stories/:storyId',
  accountSettings: '/me/settings',
  /** 관리자 구역. 승격 없이는 열리지 않는다 (`AdminGuard`). */
  admin: '/admin',
  /** 그 앞의 문. **가드 밖에 둔다** — 승격을 만드는 자리가 승격을 요구하면 들어갈 길이 없다. */
  adminAuth: '/admin/auth',
  /*
   * 작품 만들기 (3d · 3e · 6a). 경로를 계약과 같은 모양으로 둔다 — `/authoring/drafts` 는
   * `listDrafts` · `createDraft` 가 사는 자리이고, 그 아래 하나가 마법사다.
   *
   * **`draftId` 는 URL 에 온다.** 남의 원고를 열면 `404` 이며 그것이 방어다 (I-8) —
   * `player_ref` 가 아니므로 F-6 의 대상이 아니다.
   */
  authoringDrafts: '/authoring/drafts',
  authoringDraft: '/authoring/drafts/:draftId',
} as const

/** 섹션 전체 보기 (3g “전체 보기 ›”). `sectionKey` 는 `genre:romance` 처럼 `:` 를 담으므로 인코딩한다. */
export const librarySectionPath = (sectionKey: string): string =>
  `/library/sections/${encodeURIComponent(sectionKey)}`

export const storyDetailPath = (storyId: string): string => `/stories/${storyId}`
export const playPath = (sessionId: string): string => `/sessions/${sessionId}`
export const resumePath = (sessionId: string): string => `/sessions/${sessionId}/resume`
export const historyPath = (sessionId: string): string => `/sessions/${sessionId}/history`
export const myStoryPath = (storyId: string): string => `/me/stories/${storyId}`
export const authoringDraftPath = (draftId: string): string => `/authoring/drafts/${draftId}`
