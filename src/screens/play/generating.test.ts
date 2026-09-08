import { describe, expect, it } from 'vitest'

import { LONG_WAIT_MS, loadingMessage } from './generating'

describe('loadingMessage', () => {
  it('10초 전까지는 만들고 있다고 말한다', () => {
    expect(loadingMessage(0)).toBe('다음 이야기를 만들어가고 있어요')
    expect(loadingMessage(LONG_WAIT_MS - 1)).toBe('다음 이야기를 만들어가고 있어요')
  })

  it('10초를 넘기면 문구를 바꾼다 — 서버 예산이 25초라 그때까지 같은 말이면 멈춘 것처럼 보인다', () => {
    expect(loadingMessage(LONG_WAIT_MS)).toBe('조금만 더 기다려 주세요')
    expect(loadingMessage(24_000)).toBe('조금만 더 기다려 주세요')
  })
})
