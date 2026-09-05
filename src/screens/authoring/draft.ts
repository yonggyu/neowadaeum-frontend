import { ApiError } from '../../api/client'
import type { Draft, DraftPayload, SafetyState } from '../../api/endpoints/authoring'
import { formatRelativeTime } from '../account/relativeTime'

/**
 * 마법사가 화면 없이 판단하는 것들 — 단계 · 제목 · 진행 가능 여부 · 개수 상한.
 *
 * 컴포넌트에서 꺼내 두는 이유는 테스트가 아니라 **한 곳에서만 판단하기 위해서**다. 진행바 ·
 * 헤더 · 버튼 셋이 각자 `step` 을 해석하면 그중 하나가 5 를 넘긴 값을 그대로 그린다.
 *
 * 이것을 부르는 두 화면(원고 목록 · 마법사 골격)은 **뒤따르는 PR** 에 온다 — 한 PR 에 넣으면
 * `src/**` 800줄을 넘는다.
 */

/**
 * 다섯 단계의 이름 (와이어프레임 3d · 3e · 6a).
 *
 * 계약이 주는 것은 `step` 정수 하나뿐이다 (`1..5`) — 이름은 오지 않는다. 6a 의 헤더가
 * "STEP 3 / 5 · …" 이므로 그 자리를 채울 값이 필요하고, 와이어프레임 셋이 다섯을 모두
 * 적어 두었다: 기본 정보(3d) · 세계관(3d) · 등장인물과 플래그(3d · 7차 `A-1`) ·
 * 챕터 & 엔딩(3e) · 미리보기(3e).
 *
 * **셋째의 이름이 늘어난 것은 그 단계가 하는 일이 늘었기 때문이다** (#125). 7차 `A-1` 이
 * 플래그 선언을 새 스텝이 아니라 Step 3 안에 두었고, 상단 표시를 *"Step 3 / 5 · 등장인물과
 * 플래그"* 로 그렸다 — 이름이 인물만 말하면 그 단계에서 선언한 플래그는 화면 어디에서도
 * 단계의 일로 보이지 않는다.
 */
export const STEP_LABELS = [
  '기본 정보',
  '세계관',
  '등장인물과 플래그',
  '챕터 & 엔딩',
  '미리보기',
] as const

export const STEP_COUNT = STEP_LABELS.length

/**
 * 화면이 그릴 수 있는 단계로 좁힌다.
 *
 * 계약이 `1..5` 로 못박았지만 **화면은 그 범위를 다시 확인한다** — 서버가 단계를 하나 늘리는
 * 날 진행바가 배열 밖을 읽어 빈 칸을 그리는 대신, 마지막 단계로 붙어 있는 편이 낫다.
 */
export function clampStep(step: number): number {
  if (!Number.isFinite(step)) return 1
  return Math.min(STEP_COUNT, Math.max(1, Math.trunc(step)))
}

/**
 * 목록에 적을 제목.
 *
 * `payload` 는 계약이 `additionalProperties: true` 로 열어 둔 자리라 타입이 좁혀지지 않는다 —
 * 그래서 여기서 한 번만 좁히고, 화면은 문자열만 받는다.
 *
 * 비어 있을 때의 문구는 3g 가 정했다 ("제목 없는 작품"). 원고는 **제목 없이도 만들어지므로**
 * 이 경우가 예외가 아니라 첫 화면의 기본값이다.
 */
export function draftTitle(payload: DraftPayload): string {
  const title = payload?.['title']
  return typeof title === 'string' && title.trim() !== '' ? title.trim() : '제목 없는 작품'
}

/**
 * 다음 단계로 갈 수 있는가 (6a — *"blocked 가 하나라도 있으면 다음 버튼 Disabled + 서버도 거부"*).
 *
 * **이 판정이 방어가 아니다.** `safetyState` 가 `blocked` 면 서버가 진행을 거부한다 (R8.3);
 * 화면의 비활성 버튼은 그 거부를 미리 알려 주는 안내일 뿐이다. 둘 중 하나만 두면 안 되는
 * 이유가 여기 있다 — 화면만 두면 우회되고, 서버만 두면 눌러 봐야 안다.
 *
 * `warned` 는 `blocked` 로 취급하지 않는다. precheck 가 만드는 값은 `clean` 과 `blocked`
 * 뿐이며 (§13-33), 경고 단계는 P0 에 나오지 않는다 (3d).
 */
export function isBlocked(safetyState: SafetyState): boolean {
  return safetyState === 'blocked'
}

/**
 * 새 원고를 만들지 못한 이유가 **개수 상한**인가 (R8.12, §13-32).
 *
 * **`error` 코드가 아니라 상태 코드로 가른다.** 계약이 `createDraft` 에 보장한 것은 `409`
 * 이고, 그 자리의 예시 코드(`ALREADY_EXISTS`)는 "이미 등록되어 있어요" 라는 다른 뜻의 문구를
 * 달고 있다. 코드로 갈랐다가 서버가 `STORY_LIMIT_REACHED` 를 보내면 이 화면만 조용히
 * 안내를 잃는다 — 어긋남은 이슈로 보고하고, 화면은 계약이 보장한 쪽에 건다.
 */
export function isDraftLimitReached(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409
}

/**
 * 임시 저장 표시의 시각 (6a — "임시 저장됨 · 방금").
 *
 * 1분 안쪽은 6a 의 말대로 "방금" 이다. `Intl.RelativeTimeFormat` 의 `numeric: 'auto'` 는
 * 그 구간에서 "현재 분" 을 내놓는데, 저장 직후에 가장 자주 보이는 문구가 그것이면 화면이
 * 잘못 만들어진 것처럼 보인다. **공용 헬퍼를 고치지 않는다** — 다른 화면은 며칠 단위를
 * 보여 주는 자리라 지금 값이 맞고, 그 변경은 이 이슈의 범위가 아니다.
 */
export function savedAtLabel(updatedAt: string, now: number): string {
  const elapsed = now - Date.parse(updatedAt)
  if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 60_000) {
    return '방금'
  }
  return formatRelativeTime(updatedAt, now)
}

/**
 * 목록에 보여 줄 한 줄로 좁힌다.
 *
 * 서버 응답 객체를 그대로 여러 컴포넌트에 흘리지 않는다 (설계 원칙) — 목록 항목이 쓰는 것은
 * 넷뿐이고, `payload` 원문은 여기서 끝난다.
 */
export interface DraftSummary {
  readonly draftId: string
  readonly title: string
  readonly step: number
  readonly updatedAt: string
  readonly blocked: boolean
}

export function toSummary(draft: Draft): DraftSummary {
  return {
    draftId: draft.draftId,
    title: draftTitle(draft.payload),
    step: clampStep(draft.step),
    updatedAt: draft.updatedAt,
    blocked: isBlocked(draft.safetyState),
  }
}
