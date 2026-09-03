import type { Finding, PrecheckResponse } from '../../api/endpoints/authoring'

/**
 * 실시간 검수의 판정 — 화면 없이 정해지는 것들 (와이어프레임 3d · 4c).
 *
 * 컴포넌트에서 꺼내 두는 이유는 판정이 **한 곳에서만** 일어나게 하기 위해서다. 다음 버튼 ·
 * 필드 테두리 · 우측 패널 셋이 각자 `state` 를 해석하면 그중 하나가 언젠가 세 번째 상태를
 * 그린다.
 */

/**
 * 입력이 멈춘 뒤 검사까지 (3d — *"입력 정지 0.8초 후 자동 검사"*).
 *
 * 글자마다 부르지 않는 이유가 하나 더 있다 — 계정당 **분당 20회** 제한이다 (R8.4).
 */
export const PRECHECK_DEBOUNCE_MS = 800

/**
 * 응답에서 화면이 받아들이는 findings.
 *
 * **`blocked` 가 아니면 아무것도 그리지 않는다.** `SafetyState` enum 에는 `warned` 가 있지만
 * precheck 가 만드는 값은 `clean` 과 `blocked` 뿐이고(정정본 13-33), 3d 는 주황 "진행 가능한
 * 경고" 를 **삭제**했다 — P0 에 나오지 않는다.
 *
 * 그래서 여기서 `warned` 를 "경고 색으로 그리는 세 번째 상태" 로 만들지 않는다. 만들면 화면과
 * 판정기가 서로 다른 목록을 보게 되고(정정본 13-33 채택 2), 사용자는 막히지도 않는 표시를
 * 보게 된다. 서버가 언젠가 `warned` 를 보내기 시작하면 이 함수 하나를 고친다.
 */
export function acceptedFindings(response: PrecheckResponse): readonly Finding[] {
  return response.state === 'blocked' ? response.findings : []
}

/**
 * 방금 검사한 필드들의 결과로 갈아 끼운다.
 *
 * **검사한 필드의 옛 findings 를 먼저 지운다.** 지우지 않으면 고친 자리의 밑줄이 남고, 그
 * 상태로는 무엇을 더 고쳐야 하는지 알 수 없다. 검사하지 않은 필드의 것은 건드리지 않는다 —
 * 요청은 필드 단위이므로 응답도 그 필드들에 대해서만 말한다.
 */
export function mergeFindings(
  current: readonly Finding[],
  checked: readonly string[],
  response: PrecheckResponse,
): Finding[] {
  const replaced = new Set(checked)
  return [...current.filter((f) => !replaced.has(f.field)), ...acceptedFindings(response)]
}

/** 그 필드에 걸린 것들. 한 필드에 여럿이 올 수 있다 (4c). */
export function findingsFor(findings: readonly Finding[], field: string): Finding[] {
  return findings.filter((f) => f.field === field)
}

/**
 * 다음 단계로 갈 수 없는가 (6a — *"blocked 가 하나라도 있으면 다음 버튼 Disabled"*).
 *
 * **`canProceed` 가 계약에 없다** — 서버가 boolean 으로 주지 않으므로 화면이 판정한다.
 * 받아들인 finding 이 하나라도 있으면 그것이 `blocked` 다: `acceptedFindings` 가 `blocked`
 * 응답의 것만 남기므로 두 판정이 갈라질 수 없다.
 *
 * **이 판정은 방어가 아니다.** 같은 상태를 서버도 거부한다 (R8.3) — 버튼 비활성은 그 거부를
 * 미리 알려 주는 안내다.
 */
export function hasBlocked(findings: readonly Finding[]): boolean {
  return findings.length > 0
}

/** 문제 구간 하나 (3d — *"문제 구간 하이라이트"*). */
export interface Segment {
  readonly text: string
  readonly marked: boolean
}

/**
 * 원문을 밑줄 칠 구간과 아닌 구간으로 자른다.
 *
 * `span` 은 `[시작, 끝)` 문자 오프셋이고 한 필드에 여럿이 온다 (4c). 겹치거나 붙은 구간은
 * **하나로 합친다** — 나누어 두면 `<mark>` 사이에 경계선이 보이고, 그 선은 원문에 없는 정보다.
 *
 * 범위를 벗어난 자리는 잘라 낸다. 정정본 13-33 이 *"둘이 다르면 자리 추적을 포기하고 필드
 * 전체를 가리킨다"* 고 정했으므로 **필드 길이만 한 span 이 정상 응답**이며, 사용자가 그 사이
 * 글자를 지우면 응답보다 원문이 짧아진다 — 그때 예외를 던지지 않고 짧아진 만큼만 긋는다.
 *
 * **걸린 항목을 여기서 다시 말하지 않는다** (F-5). 이 함수가 아는 것은 자리뿐이다.
 */
export function highlightSegments(value: string, spans: readonly (readonly number[])[]): Segment[] {
  const ranges = spans
    .map((span) => [clamp(span[0] ?? 0, value.length), clamp(span[1] ?? 0, value.length)] as const)
    .filter(([start, end]) => start < end)
    .sort((a, b) => a[0] - b[0])

  const segments: Segment[] = []
  let cursor = 0
  for (const [start, end] of ranges) {
    if (end <= cursor) continue // 앞 구간에 이미 삼켜졌다
    const from = Math.max(start, cursor)
    if (from > cursor) segments.push({ text: value.slice(cursor, from), marked: false })
    const last = segments[segments.length - 1]
    if (last?.marked === true && from === cursor) {
      segments[segments.length - 1] = { text: last.text + value.slice(from, end), marked: true }
    } else {
      segments.push({ text: value.slice(from, end), marked: true })
    }
    cursor = end
  }
  if (cursor < value.length) segments.push({ text: value.slice(cursor), marked: false })
  return segments
}

function clamp(offset: number, length: number): number {
  if (!Number.isFinite(offset)) return 0
  return Math.min(length, Math.max(0, Math.trunc(offset)))
}
