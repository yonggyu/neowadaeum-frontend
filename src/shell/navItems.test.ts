import { describe, expect, it } from 'vitest'

import { ROUTES } from '../routes/routes'
import { NAV_ITEMS } from './navItems'

/**
 * 셸의 링크는 **실제로 열리는 화면**만 가리킨다.
 *
 * 없는 경로를 가리키면 라우터가 빈 골격(`NotFound`)을 그리고, 빈 화면은 돌아가는 것처럼
 * 보인다. 계정 설정(6d)처럼 아직 없는 화면을 탭바에 미리 넣는 일을 이 테스트가 막는다.
 */
describe('NAV_ITEMS — 셸이 가리키는 곳', () => {
  it('모든 목적지가 ROUTES 에 있다', () => {
    const known = new Set<string>(Object.values(ROUTES))
    for (const item of NAV_ITEMS) {
      expect(known.has(item.to), `${item.key} → ${item.to}`).toBe(true)
    }
  })

  it('경로 파라미터가 남은 목적지를 두지 않는다', () => {
    // `/stories/:storyId` 같은 패턴은 그대로 링크할 수 없다 — 값을 채워야 열린다.
    for (const item of NAV_ITEMS) {
      expect(item.to.includes(':'), `${item.key} → ${item.to}`).toBe(false)
    }
  })

  it('6d 의 탭 셋이 다 있다 — Library · My Stories · 계정', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual(['Library', 'My Stories', '계정'])
  })

  it('같은 곳을 두 번 가리키지 않는다', () => {
    const destinations = NAV_ITEMS.map((item) => item.to)
    expect(new Set(destinations).size).toBe(destinations.length)
  })
})
