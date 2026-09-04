import { ROUTES } from '../../routes/routes'

/**
 * 화면이 그리는 나가는 문 하나.
 *
 * 문을 **어디로 열 것인가**는 마크업이 아니라 판단이다 — 그래서 렌더링 밖에 둔다.
 * 이 자리에 테스트가 붙고, 문이 하나 더 생기려면 그 테스트를 지나야 한다.
 */
export type Exit = { readonly label: string; readonly to: string }

/**
 * 404 의 나가는 문 — **랜딩 하나다** (8차 B-1).
 *
 * 라이브러리로 보내지 않는다. 이 화면은 **로그아웃 상태에서도 열리고**, 라이브러리는
 * `RequireAuth` 뒤에 있다 — 거기로 보내면 가드가 다시 로그인으로 튕겨 사용자는 두 번
 * 튕긴다. 인증 없이 서는 화면은 랜딩과 로그인 둘뿐이며(계약의 `security: []` 넷),
 * 그중 "돌아갈 곳" 으로 읽히는 것은 랜딩이다.
 *
 * 로그인한 사람에게는 라이브러리가 더 맞지만 **그 판단은 세션을 아는 자리에서만** 할 수
 * 있고, 이 화면은 가드 밖에 있어 세션을 모른다 (8차 이슈 후보 ④).
 */
export const NOT_FOUND_EXITS: readonly Exit[] = [{ label: '처음으로', to: ROUTES.landing }]

/**
 * `unreachable` 의 [다시 시도] 버튼 문구 — 두 상태뿐이다.
 *
 * **두 번째 실패에서 문구를 바꾸지 않는다.** 몇 번 눌렀는지는 새로운 사실이 아니고,
 * 횟수를 세어 보여 주면 사용자가 고칠 수 없는 것을 계속 세게 만든다 (8차 B-2).
 */
export function retryLabel(pending: boolean): string {
  return pending ? '다시 확인하는 중…' : '다시 시도'
}
