import { describe, expect, it } from 'vitest'

import type { Choice } from '../../api/endpoints/play'
import { GRID_TEXT_LIMIT, choiceLayout, showsChoiceNumber } from './choiceLayout'

/** 계약의 `Choice` 그대로 만든다 — `disabled` 는 항상 `false`, `disabledReason` 은 항상 `null` 이다. */
const choice = (order: number, text: string): Choice => ({
  choiceId: `12-${order}-1a2b3c4d`,
  order,
  text,
  disabled: false,
  disabledReason: null,
})

const short = (order: number) => choice(order, '응, 시간 있어.')

describe('choiceLayout', () => {
  it('빈 배열은 Ending 이다 — 선택지가 없는 것이 곧 끝이라는 신호다 (R7.8)', () => {
    expect(choiceLayout([])).toBe('none')
  })

  it('1개는 full-width 단일 카드이고 번호를 생략한다', () => {
    expect(choiceLayout([short(1)])).toBe('single')
    expect(showsChoiceNumber('single')).toBe(false)
  })

  it('2~3개는 세로 스택이다', () => {
    expect(choiceLayout([short(1), short(2)])).toBe('stack')
    expect(choiceLayout([short(1), short(2), short(3)])).toBe('stack')
  })

  it('4개가 전부 짧으면 Desktop 2×2 다', () => {
    expect(choiceLayout([short(1), short(2), short(3), short(4)])).toBe('grid')
  })

  it('4개라도 하나가 길면 세로 스택으로 강제한다 — 셀 안에서 줄이 접히면 격자가 어긋난다', () => {
    const long = choice(1, '유나 옆에 앉아, 가방에서 아직 펴보지도 못한 전공 서적을 꺼낸다.')
    expect(long.text.length).toBeGreaterThan(GRID_TEXT_LIMIT)
    expect(choiceLayout([long, short(2), short(3), short(4)])).toBe('stack')
  })

  it('5개 이상은 격자를 만들지 않는다 — 2×2 는 4개일 때의 규칙이다', () => {
    expect(choiceLayout([short(1), short(2), short(3), short(4), short(5)])).toBe('stack')
  })
})
