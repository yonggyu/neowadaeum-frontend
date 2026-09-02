import { safetyActions, type ClientErrorCode } from '../../api/errors'

/**
 * 오류 뒤에 사용자가 할 수 있는 일 (와이어프레임 2c · 3a · 4a).
 *
 * - `retry`       — 같은 `choiceId` 를 **같은 `Idempotency-Key` 로** 다시 보낸다 (F-7)
 * - `chooseOther` — 직전 턴을 그대로 다시 그리고 다른 번호를 고르게 한다
 * - `refresh`     — `GET /current` 로 화면을 서버 상태에 맞춘다
 * - `leave`       — 나중에 이어하기. 진행은 이미 저장돼 있다
 */
export type RecoveryAction = 'retry' | 'chooseOther' | 'refresh' | 'leave'

/** 계약의 `actions` 문자열 → 화면이 그릴 수 있는 행동. 모르는 값은 버린다. */
const SAFETY_ACTIONS: Readonly<Record<string, RecoveryAction>> = {
  choose_other: 'chooseOther',
  leave: 'leave',
}

/**
 * 무엇을 보여 줄지 **서버의 `error` 코드로만 정한다** (F-4). 문구는 서버 `message` 를 쓴다 —
 * 여기서 정하는 것은 버튼뿐이다.
 *
 * 422 는 이 표를 쓰지 않고 **서버가 준 `details.actions` 로만 그린다** (R9.5). 같은 선택을
 * 다시 보내면 같은 차단이 반복되므로 `retry` 가 계약에 없고, 없는 것을 채워 넣지 않는다.
 */
export function recoveryActions(
  errorCode: ClientErrorCode,
  details: Record<string, unknown>,
): readonly RecoveryAction[] {
  if (errorCode === 'SAFETY_BLOCKED') {
    return safetyActions(details).flatMap((action) => {
      const mapped = SAFETY_ACTIONS[action]
      return mapped === undefined ? [] : [mapped]
    })
  }

  switch (errorCode) {
    // 서버가 이미 앞서 있다. 재시도는 같은 충돌을 되풀이할 뿐이고, 맞출 근거는 /current 다 (I-6).
    case 'TURN_CONFLICT':
    case 'CONCURRENT_GENERATION':
    case 'INVALID_CHOICE':
      return ['refresh', 'leave']

    // 이어갈 수 없는 상태다. `QUOTA_EXCEEDED` 는 오늘 쓸 수 있는 양이 끝난 것이며 기다리라고
    // 안내할 근거(`retryAfterSeconds`)조차 오지 않는다 — 나머지는 정지된 작품 · 끝났거나
    // 만료된 세션 · 로그인 만료다. 어느 쪽이든 재시도가 바꾸는 것이 없다.
    case 'QUOTA_EXCEEDED':
    case 'STORY_SUSPENDED':
    case 'FORBIDDEN':
    case 'NOT_FOUND':
    case 'UNAUTHENTICATED':
      return ['leave']

    // 일시적 실패다 (2c) — 500 · 502 · 504 · 계약 밖 응답.
    //
    // 429 의 나머지 둘도 여기로 온다. **합쳐지는 것이 아니다** — 셋은 서로 다르게 끝난다:
    // `RETRY_COOLDOWN` 은 `details.retryAfterSeconds` 만큼 재시도가 잠기고,
    // `RATE_LIMITED` 는 곧바로 다시 눌러도 되며, `QUOTA_EXCEEDED` 는 위에서 재시도가 없다.
    // 거기에 각자의 서버 `message` 가 그대로 붙는다.
    default:
      return ['retry', 'chooseOther', 'leave']
  }
}
