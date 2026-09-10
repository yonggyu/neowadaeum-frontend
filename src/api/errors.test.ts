import { describe, expect, it } from 'vitest'

import {
  THROTTLED,
  currentTurnNo,
  retryAfterSeconds,
  safetyActions,
  validationFields,
} from './errors'

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

/**
 * §13-95 · §13-96 — 검증 오류가 지목한 칸.
 *
 * 계약 예제(`fieldViolations` · `fieldViolationWithCap` · `preconditionNotMet` ·
 * `vocabularyBudgetExceeded`)를 그대로 입력으로 쓴다.
 */
describe('validationFields', () => {
  it('F4_reason_을_돌려주지_않는다', () => {
    // 타입에 자리가 없다는 것을 값으로도 붙잡는다 — `reason` 이 새어 나오면 여기가 깨진다.
    const fields = validationFields({
      fields: [{ field: 'title', reason: 'must not be blank' }],
    })
    expect(fields).toEqual([{ field: 'title', max: null }])
    expect(JSON.stringify(fields)).not.toContain('must not be blank')
  })

  it('13_96_max_는_담는다', () => {
    // 계약 예제 `fieldViolationWithCap`. 계약이 `max` 를 항목에 남긴 이유가 화면이다 —
    // 버리면 작성자는 몇 개까지인지 모른 채 같은 400 을 반복해서 받는다.
    expect(validationFields({ fields: [{ field: 'chapters', reason: 'too_many', max: 32 }] })).toEqual(
      [{ field: 'chapters', max: 32 }],
    )
  })

  it('13_95_같은_칸이_두_번_어긋나도_한_번만_센다', () => {
    // 계약 예제 `fieldViolations` — 한 필드에 위반이 둘일 수 있어 `fields` 가 배열이다 (#466).
    // 그 둘을 가르는 것은 `reason` 뿐이고 화면은 그것을 읽지 않는다.
    expect(
      validationFields({
        fields: [
          { field: 'title', reason: 'must not be blank' },
          { field: 'title', reason: 'size must be between 1 and 40' },
        ],
      }),
    ).toEqual([{ field: 'title', max: null }])
  })

  it('13_96_최상위_reason_은_읽지_않는다', () => {
    // `preconditionNotMet` · `vocabularyBudgetExceeded` — `fields` 가 없는 쪽. 분기는 `fields`
    // 유무 하나이고, 최상위 `reason` 은 백엔드 #483 이 계약에 그린 뒤에 본다.
    expect(validationFields({ reason: 'story_not_approved' })).toEqual([])
    expect(
      validationFields({ reason: 'vocabulary_budget_exceeded', vocabularyUsagePercent: 137 }),
    ).toEqual([])
  })

  it('13_96_어긋난_자리를_특정하지_못하면_빈_배열이다', () => {
    // 서버가 자리를 못 짚으면 `details` 는 빈 객체다. 파라미터 검증은 이름 대신 `""` 를 싣는데
    // 그것을 칸으로 세면 화면이 지목되지 않은 자리를 지목된 것처럼 그린다.
    expect(validationFields({})).toEqual([])
    expect(validationFields({ fields: [{ field: '', reason: 'must not be null' }] })).toEqual([])
  })

  it('계약_밖의_모양은_버린다', () => {
    // `details` 는 `additionalProperties: true` 라 어떤 모양이든 스키마를 통과한다.
    expect(validationFields({ fields: 'title' })).toEqual([])
    expect(validationFields({ fields: [null, 'title', { reason: 'x' }, { field: 7 }] })).toEqual([])
    // `max` 가 숫자가 아니면 없는 것으로 읽는다 — 칸 자체는 지목된 것이 맞다.
    expect(validationFields({ fields: [{ field: 'chapters', max: '32' }] })).toEqual([
      { field: 'chapters', max: null },
    ])
  })
})
