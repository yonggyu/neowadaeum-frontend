import { describe, expect, it } from 'vitest'

import { formatRelativeTime } from './relativeTime'

const NOW = Date.parse('2026-09-02T12:00:00Z')

describe('formatRelativeTime', () => {
  it('어제와 3일 전을 구분한다 — 목록 카드의 메타 줄이다', () => {
    expect(formatRelativeTime('2026-09-01T12:00:00Z', NOW)).toBe('어제')
    expect(formatRelativeTime('2026-08-30T12:00:00Z', NOW)).toBe('3일 전')
  })

  it('한 시간 안이면 분으로 센다', () => {
    expect(formatRelativeTime('2026-09-02T11:30:00Z', NOW)).toBe('30분 전')
  })

  it('한 달을 넘기면 달로, 한 해를 넘기면 해로 센다', () => {
    expect(formatRelativeTime('2026-06-02T12:00:00Z', NOW)).toBe('3개월 전')
    expect(formatRelativeTime('2024-09-02T12:00:00Z', NOW)).toBe('2년 전')
  })

  it('파싱되지 않는 값에 시각을 지어내지 않는다 — 원문을 그대로 둔다', () => {
    expect(formatRelativeTime('언제인지 모름', NOW)).toBe('언제인지 모름')
  })
})
