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
