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
 * 무엇을 보여 줄지 **서버의 `error` 코드로 정하고**, 서버에 **닿았는지**로 한 번 더 거른다
 * (F-4 · 8차 `B-2`, #141).
 *
 * 문구는 서버 `message` 를 쓴다 — 여기서 정하는 것은 버튼뿐이다.
 *
 * ### 왜 인자가 하나 늘었는가
 *
 * 계약 밖 실패는 전부 `UNKNOWN` 으로 온다 — 서버가 준 `UNKNOWN` 도, **서버에 닿지도 못한
 * 실패**도 그렇다 (`client.ts` 의 `asUnreachable` 이 `ApiError(0, UNKNOWN, …)` 로 옮긴다).
 * 둘을 가르는 사실은 `status === 0` 하나뿐이고, `errorCode` 와 `details` 만으로는 알 수 없다.
 *
 * **`ApiError` 를 통째로 받지 않는다.** 그러면 이 함수가 상태 코드도 `requestId` 도 볼 수 있게
 * 되고, F-4 가 *"`error` 코드로 분기한다"* 로 좁혀 둔 경계가 인자 모양에서 사라진다 — 다음
 * 사람은 `status === 429` 같은 분기를 여기 적어도 되는 줄 안다. 그래서 들어오는 것은
 * `isUnreachable` 이 **이미 내린 판정 하나**(`boolean`)다: 판정은 `systemNotice.ts` 한 곳에
 * 남고 (`#122` 가 세운 자리), 이 함수는 그 결과를 쓰기만 한다.
 *
 * 기본값을 두지 않고 **필수 인자로** 받는다. `unreachable = false` 로 두면 넘기는 것을 잊은
 * 호출부가 옛 동작(갈 수 없는 곳으로 가는 문을 그리는 것)으로 조용히 돌아간다.
 *
 * ### 닿지 못했을 때 빠지는 것은 `leave` 하나다
 *
 * 세 행동을 하나씩 판정한 결과다.
 *
 * | 행동 | 서버를 부르는가 | 닿지 못한 상태에서 |
 * |---|---|---|
 * | `retry` | 부른다 — 그리고 그것이 **맞는 행동이다** | 남긴다 |
 * | `chooseOther` | **부르지 않는다** — 들고 있는 직전 턴을 다시 그릴 뿐이다 | 남긴다 |
 * | `leave` | 나가는 문이다. 그 화면이 다시 서버를 부른다 | **뺀다** |
 *
 * `leave` 를 누르면 라이브러리로 가고, 라이브러리는 같은 이유로 실패한다 — 사용자는 그 실패를
 * **자기 선택의 실패로 읽는다.** `B-2` 가 금지한 모양이며 `#122` 가 `ErrorNotice` 에서 걷어 낸
 * 것과 같은 것이다.
 *
 * 거르는 자리를 갈래마다 두지 않고 **끝에 한 번** 둔다. 닿지 못한 실패는 지금 `default` 갈래로만
 * 오지만(`UNKNOWN`), 규칙 자체는 *"닿지 못했으면 나가는 문을 그리지 않는다"* 이지 *"UNKNOWN 일
 * 때 그렇다"* 가 아니다. 갈래 안에 적으면 코드가 하나 늘 때마다 같은 판단을 다시 해야 한다.
 *
 * 422 는 이 표를 쓰지 않고 **서버가 준 `details.actions` 로만 그린다** (R9.5). 같은 선택을
 * 다시 보내면 같은 차단이 반복되므로 `retry` 가 계약에 없고, 없는 것을 채워 넣지 않는다.
 */
export function recoveryActions(
  errorCode: ClientErrorCode,
  details: Record<string, unknown>,
  unreachable: boolean,
): readonly RecoveryAction[] {
  const actions = contractActions(errorCode, details)
  return unreachable ? actions.filter((action) => action !== 'leave') : actions
}

/** 서버가 준 것으로 정하는 부분. 여기까지가 F-4 의 분기다. */
function contractActions(
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
    //
    // **서버에 닿지 못한 실패도 여기로 온다** (`UNKNOWN`). 위의 필터가 그 갈래에서 `leave` 를
    // 걷어 내며, 그것이 이 표에서 갈리는 유일한 자리다.
    default:
      return ['retry', 'chooseOther', 'leave']
  }
}
