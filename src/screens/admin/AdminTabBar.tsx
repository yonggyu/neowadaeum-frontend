import { Link } from 'react-router-dom'

import { ADMIN_TABS, isCurrentTab, type AdminTab } from './adminTabs'
import styles from './adminTabs.module.css'

/**
 * 관리자 구역의 공통 탭 줄 — 세션 · 검수 큐 · 블록리스트.
 *
 * **사용처가 셋이라 컴포넌트다** (CLAUDE.md 의 추상화 도입 조건 1). 셋이 되기 전에 만들었다면
 * 그것은 추측이었다. 지금은 세 화면이 같은 줄을 실제로 나눠 갖는다 — 각자 `<nav>` 를 적으면
 * 넷째가 붙을 때 셋 중 하나만 고쳐지고, 그 어긋남은 고친 화면에서는 보이지 않는다.
 *
 * **그 이상 일반화하지 않는다.** 아이콘 · 배지 · 건수를 받지 않는다 — 계약이 큐의 길이를
 * 주지 않고(`listReviewQueue`), 나머지는 지금 아무도 요구하지 않는다.
 */
export function AdminTabBar({ current }: { current: AdminTab }) {
  return (
    <nav className={styles.tabs} aria-label="관리자 구역">
      {ADMIN_TABS.map((item) =>
        isCurrentTab(item, current) ? (
          <span key={item.key} className={styles.tab} aria-current="page">
            {item.label}
          </span>
        ) : (
          <Link key={item.key} className={styles.tab} to={item.path}>
            {item.label}
          </Link>
        ),
      )}
    </nav>
  )
}
