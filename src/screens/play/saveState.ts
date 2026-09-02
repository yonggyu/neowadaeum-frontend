import { formatRelativeTime } from '../account/relativeTime'

const MINUTE = 60_000

/**
 * Play Menu 의 "저장 상태" 한 줄 (3c).
 *
 * **서버가 `savedAt` 을 주지 않으면 아무 말도 하지 않는다** — 저장됐다고 화면이 지어내면 그
 * 문장에는 근거가 없고, 사용자는 그것을 믿고 나간다. 그래서 `null` 을 돌려주고 부르는 쪽이
 * 줄을 통째로 뺀다.
 *
 * 방금 저장된 경우만 문구가 따로 있다 (3c 의 "방금 저장됨"). `formatRelativeTime` 은 1분이
 * 지나지 않은 시각을 "현재 분" 으로 옮기는데, 턴 직후에 그 말이 뜨면 뜻이 통하지 않는다.
 * 시계가 어긋나 미래로 보이는 경우도 "방금" 이다.
 */
export function savedLabel(savedAt: string | null | undefined, now: number): string | null {
  if (savedAt === null || savedAt === undefined || Number.isNaN(Date.parse(savedAt))) {
    return null
  }
  return now - Date.parse(savedAt) < MINUTE
    ? '방금 저장됨'
    : `${formatRelativeTime(savedAt, now)} 저장됨`
}
