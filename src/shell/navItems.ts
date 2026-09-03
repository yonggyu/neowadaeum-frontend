import { ROUTES } from '../routes/routes'

/** 셸 내비게이션 한 칸. `to` 는 `ROUTES` 의 값이어야 한다 — 죽은 링크를 만들지 않는다. */
export type NavItem = {
  readonly key: string
  readonly label: string
  readonly to: string
}

/**
 * 셸이 가리키는 곳 — 상단 내비(768+)와 하단 탭바(~767)가 **같은 목록**을 쓴다.
 *
 * 와이어프레임 6d 의 탭바는 **Library / My Stories / 계정** 셋이고, 이제 셋이 다 있다 —
 * 계정 설정 화면이 서면서 마지막 칸의 목적지가 생겼다 (#35). 그전까지 둘이었던 이유는 갈
 * 곳이 없는 칸을 만들면 눌렀을 때 빈 화면이 나오기 때문이다. **비어 있는 화면은 돌아가는
 * 것처럼 보인다.**
 *
 * 3g 의 "＋ 작품 만들기"(1차 CTA)는 **이 목록에 넣지 않는다.** 원고 목록 화면이 서면서
 * 갈 곳이 생겼지만(#54), 그것은 *어디에 있는가* 가 아니라 *무엇을 하는가* 다 — 여기 넣으면
 * 탭바의 네 번째 칸이 되고 6d 는 탭바를 셋으로 정했다. 자리는 `AppShell` 의 상단 우측이다.
 *
 * 배지 · 알림 · 읽지 않음 표시를 두지 않는다 — 그것을 조회할 오퍼레이션이 계약에 없다.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'library', label: 'Library', to: ROUTES.library },
  { key: 'myStories', label: 'My Stories', to: ROUTES.myStories },
  { key: 'account', label: '계정', to: ROUTES.accountSettings },
]
