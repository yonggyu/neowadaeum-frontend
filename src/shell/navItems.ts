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
 * 와이어프레임 6d 의 탭바는 **Library / My Stories / 계정** 셋이다. 여기 둘뿐인 이유는
 * 계정 설정 화면이 아직 없기 때문이다 — 라우트가 뚫려 있지 않고(`routes.ts`) #25 의 범위도
 * 아니다. 갈 곳이 없는 칸을 만들면 눌렀을 때 빈 화면이 나오고, **비어 있는 화면은 돌아가는
 * 것처럼 보인다.** 계정 설정(6d)을 붙이는 이슈에서 여기 한 줄을 더한다.
 *
 * 3g 의 "＋ 작품 만들기"(1차 CTA)도 같은 이유로 없다 — 작품 만들기 화면이 아직 없다.
 *
 * 배지 · 알림 · 읽지 않음 표시를 두지 않는다 — 그것을 조회할 오퍼레이션이 계약에 없다.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'library', label: 'Library', to: ROUTES.library },
  { key: 'myStories', label: 'My Stories', to: ROUTES.myStories },
]
