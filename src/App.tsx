import { BrowserRouter } from 'react-router-dom'

import { useAuthSession } from './auth/useAuthSession'
import { AppRoutes } from './routes/router'

/**
 * 부팅 — 인증 상태를 한 번 복원하고 라우터에 넘긴다.
 *
 * **복원이 끝날 때까지 기다리는 자리를 라우터 안으로 옮겼다** (#41). 여기서 전부 막으면
 * 인증이 필요 없는 화면(랜딩)까지 `GET /me` 를 기다리는데, 그 화면은 계약상 토큰 없이 열린다 —
 * 기다릴 이유가 없다. 기다려야 하는 것은 **로그인 여부로 갈리는 라우트**뿐이고, 그 판단은
 * 가드 하나가 한다. 상태를 두 곳에서 해석하면 그중 한 곳이 먼저 낡는다.
 *
 * 상태를 Context 로 올리지 않는다 — 소비자가 가드 하나인 Context 는 추상화가 아니라 짐이다.
 */
export function App() {
  const session = useAuthSession()

  return (
    <BrowserRouter>
      <AppRoutes session={session} />
    </BrowserRouter>
  )
}
