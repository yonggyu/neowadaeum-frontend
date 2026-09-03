import { Navigate, Route, Routes } from 'react-router-dom'

import type { AuthState } from '../auth/session'
import { AccountSettingsScreen } from '../screens/account/AccountSettingsScreen'
import { AdminAuthScreen } from '../screens/admin/AdminAuthScreen'
import { AdminGuard } from '../screens/admin/AdminGuard'
import { HistoryScreen } from '../screens/account/HistoryScreen'
import { LoginScreen } from '../screens/account/LoginScreen'
import { MyStoriesScreen } from '../screens/account/MyStoriesScreen'
import { MyStoryReviewScreen } from '../screens/account/MyStoryReviewScreen'
import { ResumeScreen } from '../screens/account/ResumeScreen'
import { DraftsScreen } from '../screens/authoring/DraftsScreen'
import { LandingScreen } from '../screens/library/LandingScreen'
import { LibraryScreen } from '../screens/library/LibraryScreen'
import { LibrarySectionScreen } from '../screens/library/LibrarySectionScreen'
import { StoryDetailScreen } from '../screens/library/StoryDetailScreen'
import { PlayScreen } from '../screens/play/PlayScreen'
import { AppShell } from '../shell/AppShell'
import { RequireAuth } from './RequireAuth'
import { ROUTES } from './routes'

/**
 * 라우트 트리. **와이어프레임의 P0 화면 자리를 지금 전부 뚫어 둔다.**
 *
 * 슬라이스 셋(플레이 · 탐색 · 계정)이 병렬로 붙는다. 각자 라우트를 여기 추가하게 하면
 * 세 브랜치가 확정적으로 같은 줄에서 충돌한다 — 자리를 먼저 만들어 두면 각 슬라이스는
 * **자기 화면 파일만** 채우면 되고 이 파일은 아무도 건드리지 않는다.
 *
 * 여기 없는 화면(작품 만들기 마법사)은 아직 범위가 아니다.
 *
 * **셸이 붙는 자리와 붙지 않는 자리를 이 트리가 정한다** (#25). 화면이 스스로 판단하게 두면
 * 새 화면마다 같은 질문을 다시 하게 된다 — 여기 한 곳에서 보이는 편이 낫다.
 *
 * **로그인이 필요한 자리도 같은 방식으로 이 트리가 정한다** (#41). 인증 없이 열리는 화면은
 * 계약이 정했다 — 전역 `security` 가 `bearerAuth` 이고 `security: []` 로 그것을 벗는 오퍼레이션은
 * 넷뿐이다: `getLanding` · `loginWithOAuth` · `refreshToken` · `getConsentTerms`. 화면으로 옮기면
 * **랜딩과 로그인 둘**이고, 나머지는 전부 `RequireAuth` 안에 든다. 라이브러리도 예외가 아니다 —
 * `getLibrary` · `getStoryDetail` 은 `security: []` 를 달고 있지 않다.
 */
export function AppRoutes({ session }: { session: AuthState }) {
  return (
    <Routes>
      {/*
       * 공통 셸이 붙는 화면 (3g · 6d).
       *
       * 셋의 공통점은 **오가는 화면**이라는 것이다 — 훑고, 고르고, 목록으로 돌아간다.
       * 그 이동을 상단 내비와 하단 탭바가 맡는다.
       */}
      <Route element={<AppShell />}>
        {/* 랜딩만 인증 밖이다 — `getLanding` 의 `security: []` 가 그렇게 정했다 */}
        <Route path={ROUTES.landing} element={<LandingScreen />} />

        {/* 아래는 전부 토큰이 있어야 부를 수 있는 화면이다. 새 화면은 여기 안에 넣는다 */}
        <Route element={<RequireAuth session={session} />}>
          <Route path={ROUTES.library} element={<LibraryScreen />} />
          <Route path={ROUTES.librarySection} element={<LibrarySectionScreen />} />
          <Route path={ROUTES.storyDetail} element={<StoryDetailScreen />} />
          <Route path={ROUTES.resume} element={<ResumeScreen />} />
          <Route path={ROUTES.history} element={<HistoryScreen />} />
          <Route path={ROUTES.myStories} element={<MyStoriesScreen />} />
          <Route path={ROUTES.myStory} element={<MyStoryReviewScreen />} />
          {/*
           * 계정 설정 (6d). 셸이 붙는다 — 6d 의 모바일 프레임이 **하단 탭바를 유지**하고 그
           * 세 번째 칸이 이 화면이다. 자기 자리로 돌아오는 길이 보여야 한다.
           */}
          <Route path={ROUTES.accountSettings} element={<AccountSettingsScreen />} />
        {/*
         * 원고 목록 (#54) — 셸이 붙는다. 훑고 고르고 돌아오는 화면이고, 3g 의 "＋ 작품
         * 만들기" CTA 가 셸 상단에서 이리로 온다.
         */}
        <Route path={ROUTES.authoringDrafts} element={<DraftsScreen />} />
        </Route>
      </Route>

      {/*
       * 로그인 — 셸을 붙이지 않는다.
       *
       * 6b 가 이 화면을 **Desktop Split(비주얼 좌 / 카드 우) · Mobile 전체화면**으로 정했다.
       * 상단 바도 하단 탭바도 그려져 있지 않고, 모바일은 "버튼이 화면 하단 안전영역 위"라서
       * 탭바를 깔면 그 자리를 정확히 덮는다. 목적지 셋이 전부 인증이 필요한 화면이기도 하다 —
       * 로그인하기 전에 그리로 가는 길을 보여 줄 이유가 없다.
       *
       * 최초 로그인의 추가 정보(생년월일 · 약관)는 별 라우트가 아니다 — 6b 가 "같은 화면 교체,
       * 페이지 이동 없음"으로 정했다. LoginScreen 안에서 단계로 바뀐다.
       */}
      <Route path={ROUTES.login} element={<LoginScreen />} />

      {/*
       * Play — 셸을 붙이지 않는다.
       *
       * 2f 가 이 화면의 헤더를 **자기 것**으로 정했다(390 에서 제목+Chapter 2줄, 어느 폭에서도
       * sticky 48px). 그 자리에 셸의 브랜드 바를 얹으면 sticky 가 둘이 된다. 하단도 마찬가지다 —
       * 2f 는 "Choice 는 화면을 넘겨도 sticky 처리하지 않는다"고 못박았고 Choice 는 본문 끝에
       * 오므로(최소 높이 60px), 고정 탭바는 읽는 사람이 마지막 선택지를 누르는 자리를 덮는다.
       */}
      <Route element={<RequireAuth session={session} />}>
        <Route path={ROUTES.play} element={<PlayScreen />} />
      </Route>

      {/*
       * Admin — 셸을 붙이지 않는다. 사용자 화면이 아니고, 상단 내비와 하단 탭바가 가리키는
       * 곳이 전부 라이브러리 쪽이다. F-9 의 유일한 예외이며 `1j` · `3h` 가 그 예외를 정했다.
       *
       * 문(`/admin/auth`)은 가드 **밖**이다 — 승격을 만드는 자리가 승격을 요구하면 들어갈
       * 길이 없다. 그 안쪽은 `AdminGuard` 가 지키고, 3h(검수·신고 큐) · 1j(Debug 콘솔) 이
       * 다음 배치에 그 아래로 들어온다. 지금은 갈 곳이 없으므로 승격 여부와 무관하게 문으로
       * 돌아온다 — 승격을 들고 있으면 문이 그 사실을 알려 준다.
       */}
      <Route path={ROUTES.admin} element={<AdminGuard />}>
        <Route index element={<Navigate to={ROUTES.adminAuth} replace />} />
      </Route>
      <Route path={ROUTES.adminAuth} element={<AdminAuthScreen />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

/**
 * 없는 경로.
 *
 * 문구를 정성껏 짓지 않는다 — 디자인에 404 화면이 없다. 화면을 지어내지 않는다는 규칙 그대로,
 * 골격만 두고 디자인이 나오면 채운다. 셸도 붙이지 않는다 — 붙일 화면이 없다.
 */
function NotFound() {
  return <main data-screen="NotFound" />
}
