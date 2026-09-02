import { describe, expect, it } from 'vitest'

import { retryAfterSeconds } from '../../api/errors'
import { recoveryActions } from './recovery'

describe('429 세 코드는 서로 다르게 끝난다', () => {
  it('RETRY_COOLDOWN — 재시도는 있고, 잠기는 시간은 서버가 준 값이다', () => {
    const details = { retryAfterSeconds: 30 }
    expect(recoveryActions('RETRY_COOLDOWN', details)).toContain('retry')
    expect(retryAfterSeconds(details)).toBe(30)
  })

  it('RATE_LIMITED — 재시도는 있고, 잠글 근거가 오지 않는다. 프론트가 지어내지 않는다', () => {
    expect(recoveryActions('RATE_LIMITED', {})).toContain('retry')
    expect(retryAfterSeconds({})).toBeNull()
  })

  it('QUOTA_EXCEEDED — 재시도가 없다. 오늘 쓸 수 있는 양이 끝났고 기다려도 늘지 않는다', () => {
    expect(recoveryActions('QUOTA_EXCEEDED', {})).toEqual(['leave'])
  })

  it('셋이 같은 버튼 묶음으로 뭉개지지 않는다', () => {
    const cooldown = recoveryActions('RETRY_COOLDOWN', { retryAfterSeconds: 30 })
    const quota = recoveryActions('QUOTA_EXCEEDED', {})
    expect(cooldown).not.toEqual(quota)
  })
})

describe('422 SAFETY_BLOCKED', () => {
  it('서버가 준 actions 로만 그린다', () => {
    expect(recoveryActions('SAFETY_BLOCKED', { actions: ['choose_other', 'leave'] })).toEqual([
      'chooseOther',
      'leave',
    ])
  })

  it('retry 를 붙이지 않는다 — 같은 choiceId 재전송은 같은 차단을 되풀이한다 (R9.5)', () => {
    const actions = recoveryActions('SAFETY_BLOCKED', { actions: ['choose_other', 'leave'] })
    expect(actions).not.toContain('retry')
  })

  it('서버가 actions 를 주지 않으면 버튼이 없다 — 없는 것을 채워 넣지 않는다', () => {
    expect(recoveryActions('SAFETY_BLOCKED', {})).toEqual([])
  })

  it('모르는 action 문자열은 버린다 — 이름을 지어 붙인 버튼을 그리지 않는다', () => {
    expect(recoveryActions('SAFETY_BLOCKED', { actions: ['choose_other', 'teleport'] })).toEqual([
      'chooseOther',
    ])
  })
})

describe('409 · 400 — 서버가 앞서 있다', () => {
  it('TURN_CONFLICT 는 재시도가 아니라 /current 재조회로 맞춘다 (I-6)', () => {
    const actions = recoveryActions('TURN_CONFLICT', { currentTurnNo: 13 })
    expect(actions).toContain('refresh')
    expect(actions).not.toContain('retry')
  })

  it('CONCURRENT_GENERATION 도 같다 — 이미 만들고 있는 것을 한 번 더 시키지 않는다', () => {
    expect(recoveryActions('CONCURRENT_GENERATION', {})).toEqual(['refresh', 'leave'])
  })

  it('INVALID_CHOICE 는 화면이 낡은 것이다 — 다시 불러온다', () => {
    expect(recoveryActions('INVALID_CHOICE', {})).toEqual(['refresh', 'leave'])
  })
})

describe('이어갈 수 없는 상태', () => {
  it.each(['STORY_SUSPENDED', 'FORBIDDEN', 'UNAUTHENTICATED', 'NOT_FOUND'] as const)(
    '%s — 나가기만 남는다',
    (code) => {
      expect(recoveryActions(code, {})).toEqual(['leave'])
    },
  )
})

describe('일시적 실패 (2c)', () => {
  it.each(['GENERATION_TIMEOUT', 'PROVIDER_ERROR', 'INTERNAL_ERROR', 'UNKNOWN'] as const)(
    '%s — 다시 시도 · 다른 선택하기 · 나중에 이어하기',
    (code) => {
      expect(recoveryActions(code, {})).toEqual(['retry', 'chooseOther', 'leave'])
    },
  )
})
