import { BrowserRouter } from 'react-router-dom'

import { useAuthSession } from './auth/useAuthSession'
import { AppRoutes } from './routes/router'

/**
 * 부팅 — 라우터를 세우기 전에 인증 상태를 먼저 정한다.
 *
 * 복원이 끝나기 전에 화면을 그리지 않는다. 그리면 첫 프레임이 "로그아웃됨" 을 말하게 되고,
 * 그 뒤에 로그인 상태가 도착하면 화면이 한 번 튄다 — 사용자에게는 로그인이 풀렸다 돌아온
 * 것으로 보인다.
 *
 * **`anonymous` 와 `authenticated` 가 지금 같은 화면을 그린다.** 그것을 읽어 분기하는 쪽은
 * 라우터의 보호 규칙이고 그 자리는 아직 없다 (#24 는 경계와 상태까지다). 상태를 Context 로
 * 올리는 것도 여기서 하지 않는다 — 소비자가 하나도 없는 Context 는 추상화가 아니라 짐이다.
 */
export function App() {
  const session = useAuthSession()

  if (session.kind === 'restoring') {
    return (
      <p role="status" aria-live="polite">
        불러오는 중…
      </p>
    )
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
