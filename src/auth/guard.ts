import type { AuthState } from './session'

/**
 * 로그인이 필요한 라우트 앞에서 지금 무엇을 해야 하는가.
 *
 * 결정을 컴포넌트에서 떼어 둔 이유는 **이것이 테스트해야 하는 부분**이기 때문이다. 렌더링은
 * 이 넷을 화면으로 옮기기만 한다.
 *
 * - `render` — 통과시킨다
 * - `wait` — **아직 모른다.** 판정하지 않는다
 * - `signIn` — 로그인이 필요하다고 말한다
 * - `unreachable` — 로그인 여부를 알아내지 못했다. 로그인하라고 말할 수 없다
 */
export type GuardDecision = 'render' | 'wait' | 'signIn' | 'unreachable'

/**
 * `#24` 가 만든 네 사실을 그대로 옮긴다. **뭉개지 않는다.**
 *
 * 특히 두 가지가 중요하다.
 *
 * 1. `restoring` 은 익명이 아니다. `GET /me` 가 답하기 전에 익명으로 보면 새로고침마다
 *    로그인 화면이 스치고, 곧 원래 화면으로 되돌아온다 — 사용자에게는 로그인이 한 번
 *    풀린 것으로 보인다.
 * 2. `unreachable` 은 로그아웃이 아니다. 서버가 답하지 못했을 뿐이고 **로그인 여부는 여전히
 *    모른다.** 그때 로그인 화면으로 보내면 사용자는 있지도 않은 로그아웃을 고치려 든다 —
 *    실제로 할 일은 서버가 뜨기를 기다리는 것이다.
 *
 * `no_token` 과 `rejected` 는 여기서 같은 결정으로 모인다. 사용자가 할 일이 **로그인 하나로
 * 같기** 때문이며, 두 사실 자체는 `AuthState` 에 그대로 남아 있다 — 다르게 다뤄야 할 자리가
 * 생기면 그때 여기서 갈라진다.
 */
export function guardDecision(session: AuthState): GuardDecision {
  switch (session.kind) {
    case 'restoring':
      return 'wait'
    case 'authenticated':
      return 'render'
    case 'anonymous':
      return session.reason === 'unreachable' ? 'unreachable' : 'signIn'
  }
}
