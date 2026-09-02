import { Link, NavLink, Outlet } from 'react-router-dom'

import { ROUTES } from '../routes/routes'
import { NAV_ITEMS } from './navItems'
import css from './shell.module.css'

/**
 * 공통 셸 — 상단 내비 + 모바일 하단 탭바 (와이어프레임 3g · 6d).
 *
 * 화면 여섯이 각자 자기 헤더를 그리지 않고 이 하나를 쓴다. 3g 의 `wfbar` 왼쪽 "너와다음",
 * 6d 모바일의 하단 탭바(**Library / My Stories / 계정**, 행 48px 이상)가 근거다.
 *
 * **계정 정보를 그리지 않는다** — 이메일 · 닉네임 · `@handle` 자리를 두지 않는다. 3g 가 그
 * 블록을 삭제했고(`/api/v1/me` 에 `GET` 이 없다) `player_ref` 는 화면에 오지 않는다 (F-6).
 *
 * 목적지 목록은 `navItems.ts` 하나이고 두 자리가 그것을 함께 쓴다 — 상단과 하단이 서로
 * 다른 곳을 가리키는 일이 생기지 않게 하려는 것이다.
 */
export function AppShell() {
  return (
    <div className={css.shell}>
      {/* 2f 가 Play 헤더를 sticky 로 정했다. 셸의 상단 내비도 같은 규칙을 따른다 */}
      <header className={css.top}>
        <div className={css.topInner}>
          <Link className={css.brand} to={ROUTES.landing}>
            너와다음
          </Link>

          {/* ~767 에서는 하단 탭바가 이 자리를 대신한다 (6d). 같은 링크를 두 번 보이지 않는다 */}
          <nav className={css.topNav} aria-label="주요 메뉴">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                className={({ isActive }) => (isActive ? `${css.navLink} ${css.on}` : css.navLink)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/*
       * 본문. 아래 여백은 탭바 높이 토큰(`--tabbar-total-h`)에서 온다 — 값을 여기 따로 적으면
       * 탭바가 본문 끝을 가리는 순간이 반드시 온다 (F-9).
       */}
      <div className={css.content}>
        <Outlet />
      </div>

      <nav className={css.tabbar} aria-label="하단 탭 메뉴">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.key}
            to={item.to}
            className={({ isActive }) => (isActive ? `${css.tab} ${css.on}` : css.tab)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
