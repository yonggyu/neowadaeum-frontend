import { describe, expect, it } from 'vitest'

import { THROTTLED, currentTurnNo, retryAfterSeconds, safetyActions } from './errors'

describe('429 세 코드', () => {
  it('하나로 합치지 않는다 — 사용자가 할 수 있는 일이 서로 다르다', () => {
    expect(THROTTLED).toEqual(['RETRY_COOLDOWN', 'RATE_LIMITED', 'QUOTA_EXCEEDED'])
    expect(new Set(THROTTLED).size).toBe(3)
  })
})

describe('retryAfterSeconds', () => {
  it('서버가 준 값을 그대로 쓴다 — 대기 시간을 프론트가 정하지 않는다', () => {
    expect(retryAfterSeconds({ retryAfterSeconds: 45 })).toBe(45)
  })

  it('값이 없으면 null 이다 — 없는 것을 기본값으로 지어내지 않는다', () => {
    expect(retryAfterSeconds({})).toBeNull()
    expect(retryAfterSeconds({ retryAfterSeconds: '30' })).toBeNull()
  })
})

describe('safetyActions', () => {
  it('서버가 준 배열로만 버튼을 그린다', () => {
    expect(safetyActions({ actions: ['choose_other', 'leave'] })).toEqual(['choose_other', 'leave'])
  })

  it('배열이 없으면 비어 있다 — retry 는 계약에 없으므로 채워 넣지 않는다', () => {
    expect(safetyActions({})).toEqual([])
  })
})

describe('currentTurnNo', () => {
  it('409 가 알려준 서버의 턴 번호를 꺼낸다 — 이 값으로 /current 를 다시 받는다', () => {
    expect(currentTurnNo({ currentTurnNo: 13 })).toBe(13)
    expect(currentTurnNo({})).toBeNull()
  })
})
