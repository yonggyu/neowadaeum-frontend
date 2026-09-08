/**
 * `updatedAt` 을 "어제" · "3일 전" 으로 옮긴다 (와이어프레임 1i · 2e · 4b).
 *
 * `Intl.RelativeTimeFormat` 을 쓴다 — 문구를 직접 짓지 않는다는 뜻이기도 하고, 새 의존성을
 * 더하지 않는다는 뜻이기도 하다. `now` 를 인자로 받는 이유는 테스트 때문이 아니라 **목록의
 * 모든 항목이 같은 기준 시각을 봐야** 하기 때문이다 — 항목마다 `Date.now()` 를 부르면
 * 경계에서 두 카드가 다른 날을 가리킨다.
 */
const FORMATTER = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' })

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function formatRelativeTime(isoDateTime: string, now: number): string {
  const then = Date.parse(isoDateTime)
  // 서버가 준 값이 파싱되지 않으면 아무 시각도 지어내지 않는다 — 원문을 그대로 보여 준다.
  if (Number.isNaN(then)) {
    return isoDateTime
  }

  const elapsed = now - then
  if (elapsed < HOUR) {
    return FORMATTER.format(-Math.floor(elapsed / MINUTE), 'minute')
  }
  if (elapsed < DAY) {
    return FORMATTER.format(-Math.floor(elapsed / HOUR), 'hour')
  }
  const days = Math.floor(elapsed / DAY)
  if (days < 30) {
    return FORMATTER.format(-days, 'day')
  }
  if (days < 365) {
    return FORMATTER.format(-Math.floor(days / 30), 'month')
  }
  return FORMATTER.format(-Math.floor(days / 365), 'year')
}
