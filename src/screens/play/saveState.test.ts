import { describe, expect, it } from 'vitest'

import { savedLabel } from './saveState'

const NOW = Date.parse('2026-09-02T12:00:00Z')

describe('savedLabel', () => {
  it('savedAt_이_없으면_저장_상태_줄을_그리지_않는다 — 저장됐다고 지어내지 않는다', () => {
    expect(savedLabel(null, NOW)).toBeNull()
    expect(savedLabel(undefined, NOW)).toBeNull()
    expect(savedLabel('언제인지 모름', NOW)).toBeNull()
  })

  it('방금_저장된_턴은_3c_의_문구_그대로다', () => {
    expect(savedLabel('2026-09-02T11:59:30Z', NOW)).toBe('방금 저장됨')
    // 서버와 브라우저의 시계가 어긋나 미래로 보여도 같다.
    expect(savedLabel('2026-09-02T12:00:10Z', NOW)).toBe('방금 저장됨')
  })

  it('오래된_저장은_상대_시각으로_말한다', () => {
    expect(savedLabel('2026-09-02T11:30:00Z', NOW)).toBe('30분 전 저장됨')
    expect(savedLabel('2026-09-01T12:00:00Z', NOW)).toBe('어제 저장됨')
  })
})
