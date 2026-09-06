import { ApiError } from '../../api/client'
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
 * `sessionId` 없이 Play 에 닿았을 때의 나가는 문 — **라이브러리 하나다** (8차 `B-4`, #129).
 *
 * `B-2` 는 문을 아예 금지했지만 여기서는 금지하지 않는다. 그 규칙이 막는 것은 *갈 수 없는
 * 곳*이고, 이 화면은 서버에 닿지 못한 자리가 아니라 **`RequireAuth` 안**이다 — 가드가 이미
 * 세션을 확인했으므로 라이브러리는 실제로 열린다. `B-1`(404)이 랜딩을 고른 근거(가드 밖이라
 * 세션을 모른다)도 여기서는 성립하지 않는다.
 *
 * "이어서 하기"(`ResumeScreen`)로 보내지 않는다. 그 경로는 `:sessionId` 를 요구하는데
 * **없는 그 값이 바로 이 실패의 원인**이다 — 만들 수 없는 주소로 가는 문이다.
 */
export const PLAY_ENTRY_EXITS: readonly Exit[] = [{ label: '작품 둘러보기', to: ROUTES.library }]

/**
 * 서버에 **닿지 못한** 실패인가 (8차 `B-2`, #122).
 *
 * `client.ts` 의 `asUnreachable` · `toApiError` 가 응답이 오지 않았거나 읽어 낼 수 없는 실패를
 * `status === 0` 으로 옮긴다. HTTP 응답이 온 경우는 실제 상태 코드가 들어오므로 `0` 과 섞이지
 * 않는다 — 502 HTML 페이지는 닿은 것이고 여기서 갈라지지 않는다.
 *
 * **판정을 렌더링 밖에 둔다.** 이 한 줄이 화면의 모양을 가르는데(나가는 문을 그리는가 마는가)
 * 러너에 DOM 이 없어 그리는 결과로는 지킬 수 없다 — `Exit` · `retryLabel` 과 같은 자리다.
 */
export function isUnreachable(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0
}

/**
 * `unreachable` 의 [다시 시도] 버튼 문구 — 두 상태뿐이다.
 *
 * **두 번째 실패에서 문구를 바꾸지 않는다.** 몇 번 눌렀는지는 새로운 사실이 아니고,
 * 횟수를 세어 보여 주면 사용자가 고칠 수 없는 것을 계속 세게 만든다 (8차 B-2).
 */
export function retryLabel(pending: boolean): string {
  return pending ? '다시 확인하는 중…' : '다시 시도'
}
