import { ROUTES } from '../../routes/routes'

/**
 * 관리자 구역 안쪽의 문 셋 — 무엇이 있고, 지금 어디에 서 있는가.
 *
 * **셋이 됐기 때문에 공통 줄이 생겼다** (8차 블록리스트 아트보드). `#108` 이 세션 목록을
 * 세우기 전까지 안쪽은 검수 큐 하나였고, 그때의 탭 줄은 화면 하나의 장식이었다. 지금은
 * 세션 · 검수 큐 · 블록리스트 셋이며, 어느 화면에서 시작하든 나머지 둘에 닿아야 한다 —
 * 닿지 않으면 관리자는 URL 을 직접 쳐서 옮겨 다닌다.
 *
 * 목록과 판정을 React 밖에 두는 이유는 이 파일이 답하는 것이 **마크업이 아니라 사실**이기
 * 때문이다: 문이 몇 개인가, 지금 표시할 것은 어느 하나인가.
 *
 * **Debug 콘솔은 이 줄에 없다.** 그것은 세션 하나를 여는 자리이고 (`1j`) 목록에서 행을 눌러
 * 들어간다 — 탭에 올리면 세션 id 없이 열리는 문이 하나 더 생긴다.
 */
export type AdminTab = 'sessions' | 'reviews' | 'blocklist'

export interface AdminTabItem {
  key: AdminTab
  label: string
  path: string
}

/** 아트보드가 그린 순서 그대로다. 경로는 `routes.ts` 의 것만 쓴다 — 문자열을 다시 적지 않는다. */
export const ADMIN_TABS: readonly AdminTabItem[] = [
  { key: 'sessions', label: '세션', path: ROUTES.adminSessions },
  { key: 'reviews', label: '검수 큐', path: ROUTES.adminReviews },
  { key: 'blocklist', label: '블록리스트', path: ROUTES.adminBlocklist },
]

/**
 * 지금 서 있는 자리는 **링크가 아니다.**
 *
 * 자기 자신으로 가는 링크를 남겨 두면 누를 때마다 화면이 다시 서고, 화면 낭독기는 갈 수 있는
 * 곳 셋을 읽는다 — 하나는 이미 있는 곳인데. `aria-current="page"` 와 링크 여부가 같은 판단을
 * 따라야 하므로 그 판단을 여기 한 번만 둔다.
 */
export function isCurrentTab(item: AdminTabItem, current: AdminTab): boolean {
  return item.key === current
}
