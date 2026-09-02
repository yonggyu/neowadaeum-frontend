import { describe, expect, it } from 'vitest'

import { reachRatePercent } from './ending'

/**
 * 근거는 계약 한 곳이다 — `docs/openapi.yaml` 의 `TurnResponse.reachRate`:
 * `minimum: 0` · `maximum: 1` · *"0.0~1.0 의 비율이다 — 백분율이 아니다. `0.12` 는 12% 를 뜻한다"*
 * (백엔드 #260). 생성 타입은 `number | null` 뿐이라 이 사실을 나르지 못하므로 여기서 고정한다.
 */
describe('reachRatePercent', () => {
  it('백엔드260_reachRate_는_0에서_1이다 — 0.12 는 12% 이지 0.12% 가 아니다', () => {
    expect(reachRatePercent(0.12)).toBe(12)
  })

  it('백엔드260_reachRate_1은_100퍼센트다 — 계약의 maximum 이 1 이다', () => {
    expect(reachRatePercent(1)).toBe(100)
    expect(reachRatePercent(0)).toBe(0)
  })

  it('R2_8_표본이_적으면_null_이고_화면은_0퍼센트를_적지_않는다', () => {
    // 0% 로 적으면 "아무도 도달하지 못한 결말" 이라는 뜻이 된다. 그건 사실이 아니다.
    expect(reachRatePercent(null)).toBeNull()
    // 아직 붙지 않은 백엔드 작업(B-39)의 필드라 계약에서 선택 항목이다 — 오지 않는 경우도 같다.
    expect(reachRatePercent(undefined)).toBeNull()
  })

  it('소수점은 반올림한다 — 표시는 정수 퍼센트다 (2d)', () => {
    expect(reachRatePercent(0.125)).toBe(13)
    expect(reachRatePercent(0.004)).toBe(0)
  })
})
