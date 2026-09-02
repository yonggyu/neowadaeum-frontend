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
  storyDetail: '/stories/:storyId',
  play: '/sessions/:sessionId',
  resume: '/sessions/:sessionId/resume',
  history: '/sessions/:sessionId/history',
  myStories: '/me/stories',
} as const

export const storyDetailPath = (storyId: string): string => `/stories/${storyId}`
export const playPath = (sessionId: string): string => `/sessions/${sessionId}`
export const resumePath = (sessionId: string): string => `/sessions/${sessionId}/resume`
export const historyPath = (sessionId: string): string => `/sessions/${sessionId}/history`
