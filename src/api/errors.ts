import type { components } from './schema'

/** 계약의 오류 코드 22종. 손으로 적지 않고 계약에서 가져온다 (F-2). */
export type ErrorCode = components['schemas']['ErrorCode']

/**
 * 계약 형태가 아닌 응답에 붙이는 코드.
 *
 * 프록시가 끼어들거나 서버가 뜨지 않으면 `{error, message, details}` 가 오지 않는다.
 * 그때 아무 계약 코드나 골라 붙이면 **화면이 서버가 하지 않은 말을 하게 된다** —
 * 502 HTML 페이지는 `INTERNAL_ERROR` 가 아니다. 계약 밖이라는 사실을 그대로 들고 간다.
 */
export const UNKNOWN_ERROR = 'UNKNOWN'

/** 화면이 실제로 마주치는 코드 — 계약의 22종 + 계약 밖 하나. */
export type ClientErrorCode = ErrorCode | typeof UNKNOWN_ERROR

/**
 * 요청이 **서버에 닿지도 못했을 때** 쓰는 문구 (서버 미기동 · DNS · CORS · 오프라인).
 *
 * F-4 는 서버가 준 `message` 를 그대로 보여 주라고 하지만, 이 경우엔 **서버가 아무 말도 하지
 * 않았다** — 보여 줄 대상이 없다. 그렇다고 브라우저의 `Failed to fetch` 를 그대로 두면
 * 아무의 말도 아닌 영어 문장이 화면에 남는다.
 *
 * 그래서 문구를 **하나만** 둔다. 원인을 짐작해 늘리지 않는다 — 무엇이 잘못됐는지는 우리도
 * 모르고, 화면마다 다른 추측을 적으면 그것이 곧 서로 다른 진실이 된다.
 */
export const UNREACHABLE_MESSAGE = '서버에 연결하지 못했어요.'

/**
 * 429 는 세 코드로 나뉜다. **하나로 합치지 않는다** — 사용자가 할 수 있는 일이 서로 다르다.
 * 연속 실패 쿨다운 · 분당 호출 초과 · 일일 한도 초과.
 */
export const THROTTLED: readonly ErrorCode[] = ['RETRY_COOLDOWN', 'RATE_LIMITED', 'QUOTA_EXCEEDED']

/**
 * 재시도해도 되는 대기 시간(초).
 *
 * **하드코딩하지 않는다.** 서버가 `details.retryAfterSeconds` 로 준 값을 그대로 쓴다 —
 * 프론트가 3초라고 정해 두면 서버 정책이 바뀌는 순간 조용히 어긋난다.
 */
export function retryAfterSeconds(details: Record<string, unknown>): number | null {
  const value = details['retryAfterSeconds']
  return typeof value === 'number' ? value : null
}

/**
 * 세이프티 차단 후 사용자가 고를 수 있는 행동.
 *
 * 서버가 준 배열로만 버튼을 그린다 — `retry` 는 계약에 없다(R9.5). 같은 `choiceId` 를
 * 다시 보내면 같은 차단이 반복되기 때문이다. **차단 사유는 표시하지 않는다 (F-5).**
 */
export function safetyActions(details: Record<string, unknown>): string[] {
  const value = details['actions']
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/**
 * 409 TURN_CONFLICT 가 알려주는 서버의 현재 턴 번호.
 * 이 값으로 `GET /current` 를 다시 받아 화면을 교체한다. `turnNo` 가 낙관적 잠금 키다 (I-6).
 */
export function currentTurnNo(details: Record<string, unknown>): number | null {
  const value = details['currentTurnNo']
  return typeof value === 'number' ? value : null
}

/**
 * `VALIDATION_ERROR` 가 지목한 **요청의 칸** (§13-95 · §13-96).
 *
 * **`reason` 이 없다 — 타입에 자리를 두지 않았다.** 그것이 이 모양의 요점이다.
 * `fields[].reason` 은 진단·로그용 값이고 검증 라이브러리의 기본 메시지가 그대로 실린다
 * (`must not be blank`). 서버가 쓴 문구가 아니므로 판본이 오르면 바뀌고 한 응답 안에서
 * 언어가 갈린다. 그래서 **화면은 `field` 로 문구를 고르고 `reason` 은 어디에도 그리지 않는다.**
 * 꺼낼 수 없게 만들면 그 규칙이 주석이 아니라 **타입**이 된다.
 *
 * **`max` 는 반대로 담는다.** 계약이 그것을 항목 안에 남긴 이유가 화면이기 때문이다 —
 * §13-96 이 *"모양을 맞추느라 버리면 작성자는 몇 개까지 되는지 모른 채 지웠다 넣었다 하며
 * 같은 400 을 반복해서 받는다"* 고 적었다. 서버가 화면을 위해 남긴 값을 접근자가 버리면
 * 그 자리에서 화면이 할 수 있는 일이 없어진다.
 */
export interface ValidationField {
  /** 요청 본문의 자리. `title` · `chapters` · `characters[0].name` 처럼 온다 */
  readonly field: string
  /** 목록이 몇 개까지인가 — 상한이 걸린 칸에만 온다 (§13-96) */
  readonly max: number | null
}

/**
 * `VALIDATION_ERROR` 가 지목한 칸들.
 *
 * **`details` 의 모양은 셋이다.** §13-96 이 *"둘"* 이라 말한 것은 **판별이 하나**(`fields` 가
 * 있는가)라는 뜻이고, 실제로는 `fields` 있음 · 최상위 `reason` 있음 · 빈 객체 셋이 온다.
 * 이 함수는 첫째만 답한다 — 나머지 둘에서는 빈 배열이고, 그때 화면이 할 수 있는 것은
 * 서버의 `message` 하나다. **최상위 `reason` 은 여기서 읽지 않는다**: §13-96 이 화면의 분기를
 * 허용했지만 그 값의 목록이 계약에 없어(백엔드 #483) 소스를 읽어 옮겨 적어야 하고, 그러면
 * 계약을 건너뛴 정본이 하나 더 생긴다 (F-2).
 *
 * **빈 `field` 는 버린다.** 파라미터 검증 실패는 이름을 특정하지 못하면 `""` 를 싣는데,
 * 그것을 들고 있으면 *칸 하나가 지목됐다* 고 화면이 착각한다.
 *
 * **같은 칸은 한 번만 센다.** 한 필드에 위반이 둘일 수 있어 `fields` 가 배열이지만(#466),
 * 그 둘을 가르는 것은 `reason` 뿐이고 화면은 그것을 읽지 않는다 — 두 번 세면 같은 말을
 * 두 줄로 하게 된다. 서버가 준 순서는 지킨다.
 */
export function validationFields(details: Record<string, unknown>): readonly ValidationField[] {
  const value = details['fields']
  if (!Array.isArray(value)) return []

  const found: ValidationField[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null) continue
    const entry: Record<string, unknown> = item as Record<string, unknown>
    const field = entry['field']
    if (typeof field !== 'string' || field === '') continue
    if (found.some((seen) => seen.field === field)) continue
    const max = entry['max']
    found.push({ field, max: typeof max === 'number' ? max : null })
  }
  return found
}
