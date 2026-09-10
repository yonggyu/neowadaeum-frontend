import { validationFields, type ClientErrorCode } from '../../api/errors'
import { OUTLINE_FIELD } from './outline'

/**
 * 저장이 `400` 으로 막혔을 때, 서버 문장이 **말하지 않는 것**을 한 줄 덧붙인다 (§13-96).
 *
 * `VALIDATION_ERROR` 의 `message` 는 언제나 같은 한 문장이다 — `입력값을 확인해 주세요.`
 * 코드당 하나로 고정돼 있어 `field` 가 무엇이든 달라지지 않는다. 그래서 챕터를 서른셋 만든
 * 작성자가 보는 것은 **어느 목록이 몇 개까지인지 말하지 않는 문장 하나**이고, 계약이 그
 * 문제를 알고 `max` 를 항목 안에 남겼다: *"버리면 작성자는 몇 개까지 되는지 모른 채 지웠다
 * 넣었다 하며 같은 400 을 반복해서 받는다."*
 *
 * **F-4 를 깨지 않는다.** 서버의 `message` 는 그대로 서고(`SaveIndicator`), 여기서 만드는
 * 것은 그 아래에 붙는 별개의 한 줄이다 — `signInFallback` 의 `recoveryHint` 가 같은 자리다.
 * F-4 가 막는 것은 서버 문장을 프론트가 제 말로 바꿔 쓰는 것이지, 서버가 준 값으로 길을
 * 알려 주는 것이 아니다.
 *
 * **`max` 를 가리지 않는다.** S-11 이 가리는 것은 검수 비율과 정지 임계이고 목록 상한은
 * 그것이 아니다 — 계약이 같은 판단을 같은 이유로 적어 두었다. 가리면 작성자는 몇 개를
 * 지워야 하는지 알 수 없다.
 */

/**
 * 상한을 말할 수 있는 목록 — **`DraftScaleGate` 가 실제로 지목하는 둘뿐이다.**
 *
 * 서버가 보내지 않는 필드를 미리 적지 않는다. `fields` 를 싣는 자리는 백엔드 전체에 셋이고
 * (`DraftScaleGate` · `GlobalExceptionHandler` · `MyAccountUpdateService`), 이 화면에 상한과
 * 함께 오는 것은 첫째 하나다. 나머지가 지목하는 것은 `step` · `payload` 처럼 **작성자가 고칠
 * 수 없는 요청 구조**이고, 그 자리에서 화면이 할 수 있는 말은 서버 문장뿐이다.
 *
 * 목록이 늘어야 할 때는 서버가 그 칸을 지목하기 시작할 때다 — 그때 계약을 읽고 더한다.
 *
 * **조사를 값에 붙여 둔다** (`챕터는` · `엔딩은`). 받침에 따라 갈리는 규칙이라 이름만 들면
 * 한쪽이 반드시 틀리는데, 항목이 둘뿐인 표를 위해 한글 조사 함수를 만드는 것은 이 자리가
 * 필요로 하는 것보다 큰 장치다. 항목이 늘어 규칙이 값보다 짧아지면 그때 꺼낸다.
 */
const LIST_SUBJECT: Readonly<Record<string, string>> = {
  [OUTLINE_FIELD.chapters]: '챕터는',
  [OUTLINE_FIELD.endings]: '엔딩은',
}

/**
 * 서버 문장에 덧붙일 줄들. 없으면 빈 배열이고, 그때 화면에는 서버 문장 하나만 선다.
 *
 * **`ApiError` 를 통째로 받지 않는다** — `recovery.ts` 와 같은 이유다. 통째로 받으면 이
 * 함수가 상태 코드도 `requestId` 도 볼 수 있게 되고, *`error` 코드로 분기한다* 는 F-4 의
 * 경계가 인자 모양에서 사라진다.
 *
 * **아는 칸이면서 상한이 함께 온 자리에만 말한다.** 상한 없이 지목된 칸에 *"챕터를 확인해
 * 주세요"* 를 붙이면 서버 문장을 우리 말로 한 번 더 적는 것일 뿐이고, 정보는 하나도 늘지
 * 않는다. **덧붙이는 줄은 서버 문장이 말하지 않은 것을 말할 때만 값이 있다.**
 */
export function limitNotes(
  errorCode: ClientErrorCode,
  details: Record<string, unknown>,
): readonly string[] {
  if (errorCode !== 'VALIDATION_ERROR') return []

  return validationFields(details).flatMap((found) => {
    const subject = LIST_SUBJECT[found.field]
    if (subject === undefined || found.max === null) return []
    return [`${subject} ${found.max}개까지 만들 수 있어요.`]
  })
}
