import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ApiError, toApiError } from '../../api/client'
import { retryAfterSeconds, UNKNOWN_ERROR, UNREACHABLE_MESSAGE } from '../../api/errors'
import { isUnreachable } from '../system/systemNotice'
import { recoveryActions } from './recovery'

/** 서버에 닿은 실패. 이 파일의 대부분이 그 경우다. */
const REACHED = false

describe('429 세 코드는 서로 다르게 끝난다', () => {
  it('RETRY_COOLDOWN — 재시도는 있고, 잠기는 시간은 서버가 준 값이다', () => {
    const details = { retryAfterSeconds: 30 }
    expect(recoveryActions('RETRY_COOLDOWN', details, REACHED)).toContain('retry')
    expect(retryAfterSeconds(details)).toBe(30)
  })

  it('RATE_LIMITED — 재시도는 있고, 잠글 근거가 오지 않는다. 프론트가 지어내지 않는다', () => {
    expect(recoveryActions('RATE_LIMITED', {}, REACHED)).toContain('retry')
    expect(retryAfterSeconds({})).toBeNull()
  })

  it('QUOTA_EXCEEDED — 재시도가 없다. 오늘 쓸 수 있는 양이 끝났고 기다려도 늘지 않는다', () => {
    expect(recoveryActions('QUOTA_EXCEEDED', {}, REACHED)).toEqual(['leave'])
  })

  it('셋이 같은 버튼 묶음으로 뭉개지지 않는다', () => {
    const cooldown = recoveryActions('RETRY_COOLDOWN', { retryAfterSeconds: 30 }, REACHED)
    const quota = recoveryActions('QUOTA_EXCEEDED', {}, REACHED)
    expect(cooldown).not.toEqual(quota)
  })
})

describe('422 SAFETY_BLOCKED', () => {
  it('서버가 준 actions 로만 그린다', () => {
    expect(
      recoveryActions('SAFETY_BLOCKED', { actions: ['choose_other', 'leave'] }, REACHED),
    ).toEqual(['chooseOther', 'leave'])
  })

  it('retry 를 붙이지 않는다 — 같은 choiceId 재전송은 같은 차단을 되풀이한다 (R9.5)', () => {
    const actions = recoveryActions(
      'SAFETY_BLOCKED',
      { actions: ['choose_other', 'leave'] },
      REACHED,
    )
    expect(actions).not.toContain('retry')
  })

  it('서버가 actions 를 주지 않으면 버튼이 없다 — 없는 것을 채워 넣지 않는다', () => {
    expect(recoveryActions('SAFETY_BLOCKED', {}, REACHED)).toEqual([])
  })

  it('모르는 action 문자열은 버린다 — 이름을 지어 붙인 버튼을 그리지 않는다', () => {
    expect(
      recoveryActions('SAFETY_BLOCKED', { actions: ['choose_other', 'teleport'] }, REACHED),
    ).toEqual(['chooseOther'])
  })
})

describe('409 · 400 — 서버가 앞서 있다', () => {
  it('TURN_CONFLICT 는 재시도가 아니라 /current 재조회로 맞춘다 (I-6)', () => {
    const actions = recoveryActions('TURN_CONFLICT', { currentTurnNo: 13 }, REACHED)
    expect(actions).toContain('refresh')
    expect(actions).not.toContain('retry')
  })

  it('CONCURRENT_GENERATION 도 같다 — 이미 만들고 있는 것을 한 번 더 시키지 않는다', () => {
    expect(recoveryActions('CONCURRENT_GENERATION', {}, REACHED)).toEqual(['refresh', 'leave'])
  })

  it('INVALID_CHOICE 는 화면이 낡은 것이다 — 다시 불러온다', () => {
    expect(recoveryActions('INVALID_CHOICE', {}, REACHED)).toEqual(['refresh', 'leave'])
  })
})

describe('이어갈 수 없는 상태', () => {
  it.each(['STORY_SUSPENDED', 'FORBIDDEN', 'UNAUTHENTICATED', 'NOT_FOUND'] as const)(
    '%s — 나가기만 남는다',
    (code) => {
      expect(recoveryActions(code, {}, REACHED)).toEqual(['leave'])
    },
  )
})

describe('일시적 실패 (2c)', () => {
  it.each(['GENERATION_TIMEOUT', 'PROVIDER_ERROR', 'INTERNAL_ERROR', 'UNKNOWN'] as const)(
    '%s — 다시 시도 · 다른 선택하기 · 나중에 이어하기',
    (code) => {
      expect(recoveryActions(code, {}, REACHED)).toEqual(['retry', 'chooseOther', 'leave'])
    },
  )
})

/*
 * #141 — 서버에 **닿지 못한** 실패 (8차 `B-2`).
 *
 * 계약 밖 실패는 전부 `UNKNOWN` 으로 오므로 코드만으로는 갈라지지 않는다. 그래서 판정
 * 하나(`isUnreachable`)가 인자로 들어오고, 이 묶음이 그 인자가 무엇을 바꾸는지를 못박는다.
 */
describe('닿지 못한 실패에서 그리는 것 (#141 · 8차 B-2)', () => {
  const UNREACHABLE = true

  it('나중에_이어하기를_그리지_않는다 — 누르면 같은 이유로 실패하는 문이다', () => {
    expect(recoveryActions('UNKNOWN', {}, UNREACHABLE)).not.toContain('leave')
  })

  it('다시_시도는_남는다 — 닿지 못한 상태에서 맞는 행동이다', () => {
    expect(recoveryActions('UNKNOWN', {}, UNREACHABLE)).toContain('retry')
  })

  it('다른_선택하기도_남는다 — 직전 턴을 다시 그릴 뿐 서버를 부르지 않는다', () => {
    // `usePlaySession.chooseOther` 는 들고 있는 상태만 되돌린다. 서버가 죽어도 동작한다.
    expect(recoveryActions('UNKNOWN', {}, UNREACHABLE)).toContain('chooseOther')
  })

  it('빠지는_것은_그_하나뿐이다 — 나머지 둘의 순서까지 그대로다', () => {
    expect(recoveryActions('UNKNOWN', {}, UNREACHABLE)).toEqual(['retry', 'chooseOther'])
  })

  it('같은_UNKNOWN_이라도_닿았으면_문이_남는다 — 502 HTML 페이지는 닿은 것이다', () => {
    // 갈라지는 근거는 코드가 아니라 판정이다. 여기서 뭉개면 서버가 살아 있는데 문이 사라진다.
    expect(recoveryActions('UNKNOWN', {}, REACHED)).toContain('leave')
  })

  it('client_가_옮기는_그_실패가_이_갈래로_온다', () => {
    // `client.ts` 의 `asUnreachable` 이 만든 값을 그대로 태워, 판정과 표가 이어져 있는지 본다.
    const cause = toApiError(new TypeError('Failed to fetch'))
    expect(cause.errorCode).toBe(UNKNOWN_ERROR)
    expect(recoveryActions(cause.errorCode, cause.details, isUnreachable(cause))).toEqual([
      'retry',
      'chooseOther',
    ])
  })

  it('닿지_못한_판정은_한_곳에서만_난다 — 화면이 status 를 다시 읽지 않는다', () => {
    // 같은 사실을 두 곳에서 판단하기 시작하면 한쪽만 고쳐지는 날이 온다.
    const source = readFileSync(new URL('./PlayNotice.tsx', import.meta.url), 'utf8')
    expect(source).toContain('isUnreachable(error)')
    expect(source).not.toContain('status === 0')
  })

  it('판정_결과만_받는다 — 오류 객체를 통째로 받지 않는다 (F-4 의 경계)', () => {
    // `ApiError` 를 넘기면 이 함수가 무엇이든 볼 수 있게 되고, "코드로 분기한다"는 경계가
    // 인자 모양에서 사라진다. 인자가 셋이고 셋째가 원시값이라는 것이 그 규칙의 자리다.
    expect(recoveryActions).toHaveLength(3)
    const error = new ApiError(0, UNKNOWN_ERROR, UNREACHABLE_MESSAGE, {})
    const source = readFileSync(new URL('./recovery.ts', import.meta.url), 'utf8')
    // 오류 객체를 가져올 길 자체가 없다 — `client.ts` 를 부르지 않는다.
    expect(source).not.toContain("from '../../api/client'")
    // 판정 자체는 `systemNotice.ts` 의 것이고, 이 함수는 그 결과를 쓰기만 한다.
    expect(recoveryActions('UNKNOWN', {}, isUnreachable(error))).not.toContain('leave')
  })
})

/*
 * **이 파일이 지키지 못하는 것** — 러너에 DOM 이 없다(jsdom 미설치).
 *
 * 위의 것들은 *무엇을 그릴지 고르는 판단*까지만 못박는다. `PlayProblem` 이 실제로 그 버튼만
 * 그리는가 · `usePlaySession.retry` 가 복원 실패 뒤에 복원을 다시 부르는가(#141)는 렌더링과
 * 훅을 돌려야 보이며, 그 둘은 렌더링 테스트가 생길 때까지 남는다.
 */
