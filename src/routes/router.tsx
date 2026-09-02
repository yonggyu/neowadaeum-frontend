import { Route, Routes } from 'react-router-dom'

import { ConsentScreen } from '../screens/account/ConsentScreen'
import { HistoryScreen } from '../screens/account/HistoryScreen'
import { LoginScreen } from '../screens/account/LoginScreen'
import { MyStoriesScreen } from '../screens/account/MyStoriesScreen'
import { ResumeScreen } from '../screens/account/ResumeScreen'
import { LandingScreen } from '../screens/library/LandingScreen'
import { LibraryScreen } from '../screens/library/LibraryScreen'
import { StoryDetailScreen } from '../screens/library/StoryDetailScreen'
import { PlayScreen } from '../screens/play/PlayScreen'
import { ROUTES } from './routes'

/**
 * 라우트 트리. **와이어프레임의 P0 화면 자리를 지금 전부 뚫어 둔다.**
 *
 * 슬라이스 셋(플레이 · 탐색 · 계정)이 병렬로 붙는다. 각자 라우트를 여기 추가하게 하면
 * 세 브랜치가 확정적으로 같은 줄에서 충돌한다 — 자리를 먼저 만들어 두면 각 슬라이스는
 * **자기 화면 파일만** 채우면 되고 이 파일은 아무도 건드리지 않는다.
 *
 * 여기 없는 화면(Play Menu · 신고 · 작품 만들기 · 계정 설정 · Admin)은 이번 범위가 아니다.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.landing} element={<LandingScreen />} />
      <Route path={ROUTES.login} element={<LoginScreen />} />
      <Route path={ROUTES.consent} element={<ConsentScreen />} />
      <Route path={ROUTES.library} element={<LibraryScreen />} />
      <Route path={ROUTES.storyDetail} element={<StoryDetailScreen />} />
      <Route path={ROUTES.play} element={<PlayScreen />} />
      <Route path={ROUTES.resume} element={<ResumeScreen />} />
      <Route path={ROUTES.history} element={<HistoryScreen />} />
      <Route path={ROUTES.myStories} element={<MyStoriesScreen />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

/**
 * 없는 경로.
 *
 * 문구를 정성껏 짓지 않는다 — 디자인에 404 화면이 없다. 화면을 지어내지 않는다는 규칙 그대로,
 * 골격만 두고 디자인이 나오면 채운다.
 */
function NotFound() {
  return <main data-screen="NotFound" />
}
