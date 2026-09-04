import { Navigate, Outlet } from 'react-router-dom'

import { guardDecision } from '../auth/guard'
import type { AuthState } from '../auth/session'
import { UnreachableScreen } from '../screens/system/UnreachableScreen'
import { ROUTES } from './routes'

/**
 * 로그인이 필요한 라우트를 감싼다 (#41).
 *
 * 지금까지는 이 자리가 없어서 `/me/settings` · `/me/stories` · `/sessions/*` 가 로그아웃
 * 상태에서 열리고, API 가 `401` 을 주고, 사용자는 **로그인하라는 말 대신 실패했다는 말**을
 * 들었다. 401 을 화면마다 다시 해석하게 두지 않고 들어오는 길에서 한 번 판단한다.
 *
 * 판단 자체는 `auth/guard` 에 있다. 여기는 그 넷을 화면으로 옮기기만 한다.
 *
 * **원래 가려던 곳으로 돌려보내지 않는다.** 계약도 디자인도 정한 것이 없어 가장 단순한 쪽을
 * 골랐다 — 로그인은 실제 Google OAuth 리디렉션을 지나므로 목적지를 들고 있으려면 그 왕복을
 * 견디는 저장소가 필요한데, 토큰을 메모리에만 두기로 한 지금(F-3) 그 저장소를 여기서 새로
 * 만들 수는 없다. 로그인 뒤 어디로 갈지는 로그인 화면의 결정이고, 그 화면은 이미 있다.
 */
export function RequireAuth({ session }: { session: AuthState }) {
  switch (guardDecision(session)) {
    case 'render':
      return <Outlet />

    case 'wait':
      // 복원이 끝나기 전에는 판정하지 않는다. 여기서 익명으로 보면 새로고침마다 로그인
      // 화면이 스친다.
      return (
        <p role="status" aria-live="polite">
          불러오는 중…
        </p>
      )

    case 'signIn':
      // `replace` 다. 뒤로 가기가 막힌 화면으로 돌아가 다시 튕기는 고리를 만들지 않는다.
      return <Navigate to={ROUTES.login} replace />

    case 'unreachable':
      /*
       * 서버가 답하지 못했다 — 로그인 여부는 **여전히 모른다.** 로그인 화면으로 보내면
       * 있지도 않은 로그아웃을 사용자가 고치려 든다.
       *
       * 8차 와이어프레임(B-2)이 이 자리를 그려서 골격을 화면으로 바꿨다 (#117). 라우트가
       * 아니라 여전히 **이 분기 하나**이며, 셸이 붙는 라우트에서는 셸의 본문 자리에 그대로
       * 들어간다.
       */
      return <UnreachableScreen onRetry={restartBoot} />
  }
}

/**
 * [다시 시도] — **부팅을 통째로 다시 돌린다.**
 *
 * 복원은 `App` 이 한 번 돌리고 그 결과가 이리로 내려온다. 여기서 `restoreSession` 을 다시
 * 부르면 성공했을 때 그 사실을 위로 올릴 길이 없어 **두 번째 인증 상태**가 생긴다 — 화면은
 * 로그인됐다고 보는데 앱은 아니라고 보는 자리다.
 *
 * 새로 고치면 그 한 번이 처음부터 다시 일어난다. 잃는 것도 없다 — 이 상태에서 앱이 들고 있는
 * 것은 아직 아무것도 아니고, 액세스 토큰은 애초에 메모리에만 있다 (F-3). 리프레시 쿠키는
 * `HttpOnly` 로 남아 있으므로 서버가 살아나면 그대로 이어진다.
 *
 * **자동으로 부르지 않는다.** 서버가 뜨는 순간 모든 탭이 동시에 몰린다 — 다시 부르는 시점은
 * 사람이 정한다.
 */
function restartBoot() {
  window.location.reload()
}
