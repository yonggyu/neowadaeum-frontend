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
  /** 인간 검수 큐 (3h). 계약의 `/admin/reviews` 와 같은 모양으로 둔다. */
  adminReviews: '/admin/reviews',
  /*
   * 세션 목록 (7차 A-3). 계약의 `/admin/sessions` 와 같은 모양으로 둔다.
   *
   * **Debug 콘솔과 다른 층이다** — 이 경로가 부르는 `listAdminSessions` 는 식별자와
   * 메타데이터만 주고 열람 감사를 남기지 않는다 (백엔드 R12.3 · S-5, 정정본 §13-67).
   * 그래서 콘솔의 하위가 아니라 그 **앞의 문**이며, 경로도 나란히 둔다.
   *
   * 좁히는 값(`storyId`)은 경로가 아니라 쿼리다 — 계약이 쿼리 파라미터로 열었고, 좁히지
   * 않은 목록도 같은 화면이기 때문이다.
   */
  adminSessions: '/admin/sessions',
  /*
   * Debug 콘솔 (1j). 계약의 `/admin/sessions/{sessionId}/debug` 와 같은 모양으로 둔다.
   *
   * **세션 id 가 URL 에 온다.** F-6 이 막는 것은 `player_ref` 이고, 세션 식별자는 계약이
   * 직접 경로에 둔 값이다 — 응답에도 `playerRef` 는 없다 (백엔드 I-3).
   */
  adminSessionDebug: '/admin/sessions/:sessionId/debug',
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

/**
 * 세션 목록. 작품을 주면 그 작품으로 좁힌 채로 연다 — 검수 상세에서 건너오는 길이다.
 *
 * **id 를 손으로 치는 칸만 두면 실제로는 아무도 쓰지 않는다** (7차 A-3). 그래서 이 함수가
 * 있다: 관리자가 이미 작품 하나를 보고 있는 자리에서 그 작품의 세션으로 넘어간다.
 */
export const adminSessionsPath = (storyId?: string): string =>
  storyId === undefined || storyId === ''
    ? ROUTES.adminSessions
    : `${ROUTES.adminSessions}?storyId=${encodeURIComponent(storyId)}`

/** Debug 콘솔. 세션 id 는 서버가 준 값이므로 인코딩해서 넣는다. */
export const adminSessionDebugPath = (sessionId: string): string =>
  `/admin/sessions/${encodeURIComponent(sessionId)}/debug`
export const authoringDraftPath = (draftId: string): string => `/authoring/drafts/${draftId}`
