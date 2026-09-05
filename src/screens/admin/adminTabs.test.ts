import { describe, expect, it } from 'vitest'

import { ROUTES } from '../../routes/routes'
import { ADMIN_TABS, isCurrentTab, type AdminTab } from './adminTabs'

describe('관리자_구역의_문은_셋이다', () => {
  it('세션 · 검수 큐 · 블록리스트가 같은 줄을 나눠 갖는다', () => {
    expect(ADMIN_TABS.map((tab) => tab.key)).toEqual(['sessions', 'reviews', 'blocklist'])
  })

  it('경로는 routes.ts 의 것만 쓴다 — 문자열을 화면이 다시 적지 않는다', () => {
    expect(ADMIN_TABS.map((tab) => tab.path)).toEqual([
      ROUTES.adminSessions,
      ROUTES.adminReviews,
      ROUTES.adminBlocklist,
    ])
  })

  it('Debug 콘솔은 이 줄에 없다 — 세션 id 없이 열리는 문을 늘리지 않는다', () => {
    expect(ADMIN_TABS.map((tab) => tab.path)).not.toContain(ROUTES.adminSessionDebug)
  })

  it('지금 서 있는 자리 하나만 현재다 — 나머지 둘은 갈 수 있는 곳이다', () => {
    for (const current of ['sessions', 'reviews', 'blocklist'] satisfies AdminTab[]) {
      const marked = ADMIN_TABS.filter((tab) => isCurrentTab(tab, current))

      expect(marked).toHaveLength(1)
      expect(marked[0]?.key).toBe(current)
    }
  })
})
