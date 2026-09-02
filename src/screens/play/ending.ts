/**
 * Ending 이 표시하는 값 (2d).
 *
 * `reachRate` 는 계약이 **0.0~1.0 의 비율**로 못박은 값이다 — 백분율이 아니다
 * (`TurnResponse.reachRate`: *"`0.12` 는 12% 를 뜻한다. 화면에 `%` 로 그리려면 클라이언트가
 * 100 을 곱한다"*, 백엔드 #260). 타입은 그냥 `number` 라 **단위가 어긋나도 컴파일러가 잡지
 * 못한다** — 12% 를 1200% 로 그리는 종류의 실수다. 그래서 곱하는 자리를 화면에서 꺼내
 * 테스트가 지키게 둔다.
 *
 * 표본이 적으면 계약이 `null` 을 준다 (R2.8). 그때는 **도달률만 사라진다** — 0% 로 적으면
 * 아무도 도달하지 못한 결말이라는 뜻이 되고, 그건 사실이 아니다.
 */
export function reachRatePercent(reachRate: number | null | undefined): number | null {
  if (reachRate === null || reachRate === undefined) {
    return null
  }
  return Math.round(reachRate * 100)
}
