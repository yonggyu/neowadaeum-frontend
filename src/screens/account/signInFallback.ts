import { ApiError } from '../../api/client'

/**
 * 빠져나갈 길이 **언제 서고 무엇을 말하는가** (#218, #212).
 *
 * 자리 자체는 `#181`(PR #210)이 만들었고 9차 캔버스 `LoginOptionA` 가 그렸다. 여기서 정하는
 * 것은 그 자리의 **시점**과, 그 자리가 만료된 뒤 화면이 **무슨 말을 하는가** 둘이다.
 *
 * **화면이 아니라 여기에 두는 이유** — 러너에 DOM 이 없다(jsdom 미설치). 이 레포는 그래서
 * 화면이 내리는 판정을 순수 함수로 꺼내 두고 그 함수를 시험한다 (`resumeNotice` ·
 * `reviewStatus` · `storyActions` 와 같은 자리). 그리는 일은 `LoginScreen` 이 그대로 한다.
 */

/**
 * 아무 소식이 없는 채로 이만큼 흐르면 **다른 길을 먼저 제안한다** (#218).
 *
 * `googleIdToken.ts` 의 `NO_RESPONSE_TIMEOUT_MS`(120초)와 **같은 시계의 이른 눈금**이다 —
 * 재는 것은 둘 다 *"GIS 가 우리에게 아무 말도 하지 않은 채 흐른 시간"* 이고, 다른 것은
 * 그 눈금에서 무엇을 하는가다. 120초는 여전히 **실패를 선언하는** 자리이고, 이 값은
 * **아무것도 선언하지 않는** 자리다: 창이 떴는지는 코드가 알 수 없고(FedCM 전환으로 표시
 * 계열 moment 알림이 사라졌다) **사람이 보고 안다.** 그래서 여기서 하는 일은 판정이 아니라
 * *물어볼 자리를 하나 세우는 것*이다.
 *
 * **10초는 이 레포가 이미 쓰는 눈금이다** — `play/generating.ts` 의 `LONG_WAIT_MS` 가 같은
 * 값으로 *"기다림이 길어졌다"* 를 판정한다(와이어프레임 1e · 2c). 저 화면은 그 자리에서
 * 문구를 바꾸고, 이 화면은 **길을 하나 더 세운다.**
 *
 * **120초를 줄이지 않는다.** 줄이면 계정 선택 창을 보고 있는 사람에게서 창을 뺏는다 —
 * 그 위험을 값으로 다시 사는 대신, 실패 선언과 탈출구 등장을 **나눈다.**
 */
export const FALLBACK_REVEAL_MS = 10_000

/**
 * 탈출구가 어디까지 와 있는가.
 *
 * - `hidden` — 아직 아무것도 없다. 로그인 시도가 시작될 때마다 여기로 돌아온다
 * - `offered` — *"창이 열리지 않으면"* 아래에 **우리 버튼**이 하나 선다. 아직 GIS 를 다시
 *   부르지 않았고, 그래서 **nonce 도 아직 받지 않았다**
 * - `mounted` — Google 이 그린 버튼이 서 있다. 이 자리에 서려면 nonce 를 하나 받는다
 *
 * **`offered` 가 중간에 있는 이유가 이 파일의 핵심 결정이다.** 10초에 곧바로 Google 버튼을
 * 세우지 않는 근거 셋:
 *
 * 1. **GIS 는 `initialize()` 를 한 번만 부르라고 적어 두었다.** One Tap 과 렌더 버튼을 함께
 *    써도 마찬가지다. 창이 아직 떠 있을지 모르는 동안 두 번째 설정을 덮어쓰면, 사람이 보고
 *    있는 창을 우리가 알지 못한 채 흔든다 — **DoD 가 지키라고 한 바로 그 창이다.** `offered`
 *    는 사람이 *"안 떴다"* 고 말한 뒤에야 GIS 를 다시 부른다
 * 2. **쓰이지 않을 nonce 를 만들지 않는다** (S-8). 10초에 무조건 버튼을 세우면 **One Tap 이
 *    잘 뜬 사람의 로그인마다** 아무도 쓰지 않을 nonce 가 하나씩 서버에 생긴다. 이 파일이
 *    지키는 것은 *한 번 누른 결과로만 nonce 가 하나 는다* 이며, 시도 하나가 받는 nonce 의
 *    최대는 **여전히 둘**이다 (One Tap 하나 · 탈출구 하나)
 * 3. **아무것도 선언하지 않는다.** 실패 문구를 앞당기는 것이 아니라 조건문을 하나 세우는
 *    것이므로, 화면이 아는 것은 그대로 *"안 떴다"* 까지다
 */
export type FallbackStage = 'hidden' | 'offered' | 'mounted'

/**
 * 자리를 움직이는 사건 셋.
 *
 * `taken` 은 **사람이 누른 것**이다 — 코드가 스스로 그 자리로 가는 길은 없다.
 */
export type FallbackEvent =
  /** 로그인 시도가 시작됐다 (두 버튼 중 무엇을 눌렀든). */
  | { kind: 'attempt' }
  /** 아무 소식 없이 `FALLBACK_REVEAL_MS` 가 흘렀다. */
  | { kind: 'reveal' }
  /** 사람이 *"창이 열리지 않았다"* 고 답했다. */
  | { kind: 'taken' }

/**
 * 다음 자리.
 *
 * **`reveal` 은 뒤로 가지 못한다.** 이미 Google 버튼이 서 있는데 늦게 도착한 타이머가 그것을
 * 우리 버튼으로 되돌리면, 사람이 방금 받은 버튼이 눈앞에서 사라진다.
 *
 * **`attempt` 은 언제나 `hidden` 이다.** 이 한 줄이 `#212` 를 떠받친다 — 시도가 시작될 때
 * 자리가 반드시 내려가므로, 다음 실패는 **새 nonce 로 세운 버튼**을 만난다. 만료된 nonce 를
 * 든 버튼이 자리에 남아 같은 401 을 되풀이하는 상태가 여기서 닫힌다.
 */
export function nextFallbackStage(stage: FallbackStage, event: FallbackEvent): FallbackStage {
  switch (event.kind) {
    case 'attempt':
      return 'hidden'
    case 'reveal':
      return stage === 'hidden' ? 'offered' : stage
    case 'taken':
      return 'mounted'
  }
}

/** 지금 이 자리에 무엇을 그리는가. */
export type FallbackView =
  /** 아무것도 없다. */
  | 'none'
  /** *"창이 열리지 않으면"* + 우리 버튼. 아직 GIS 를 부르지 않았다. */
  | 'offer'
  /** *"창이 열리지 않으면"* + Google 이 그린 버튼. 이 자리가 nonce 하나를 쓴다. */
  | 'button'

/**
 * 실패는 **자리를 건너뛰게 한다.**
 *
 * 실패가 선언된 뒤에는 물어볼 것이 없다 — One Tap 왕복이 이미 끝났으므로 `initialize()` 를
 * 다시 불러도 덮어쓸 창이 없고, 사람에게 *"창이 열렸나요"* 를 묻는 것도 늦은 말이다. 그래서
 * 실패한 화면은 `#181` 이 그린 그대로 **Google 버튼을 곧바로** 세운다 (`LoginOptionA`).
 */
export function fallbackView(stage: FallbackStage, failure: unknown): FallbackView {
  if (failure !== null || stage === 'mounted') return 'button'
  return stage === 'offered' ? 'offer' : 'none'
}

/**
 * 서버 문장 **아래에** 한 줄 덧붙이는 회복 방법 (#212).
 *
 * **F-4 를 어기지 않는다.** F-4 가 막는 것은 *서버가 준 문장을 프론트가 제 말로 바꿔 쓰는
 * 것*이고, 여기서 하는 일은 그 문장을 **그대로 둔 채** 그 아래에 *무엇을 누르면 되는가*를
 * 적는 것이다 — 어느 코드에 무엇을 덧붙이는지는 화면이 정하며, 그 근거가 이 주석이다.
 *
 * **`LOGIN_NONCE_INVALID` 하나에만 붙인다.** 이 코드만 회복 방법이 *다시 누르는 것*으로
 * 정해져 있기 때문이다 — 계약이 이 코드를 `UNAUTHENTICATED` 와 나눈 이유가 그것이고
 * (재발급으로 회복되지 않는다 · 로그인 왕복을 처음부터 다시 한다), 그 회복을 코드가 대신
 * 해 주지 않기로 한 것이 `#185` 다. 남은 것이 **화면이 그 길을 말하는 일** 하나다.
 *
 * **원인을 적지 않는다.** 없든 · 안 맞든 · 만료됐든 · 이미 쓰였든 서버가 하나의 코드로
 * 답하기로 했다 (S-6). 그래서 *"시간이 지났어요"* 라고 쓰지 않는다 — 넷 중 하나를 골라
 * 말하는 것이고, 그것은 서버가 하지 않기로 한 구분을 화면이 대신 하는 일이다.
 * 이 줄이 말하는 것은 **무엇을 누르면 되는가** 하나다.
 */
export function recoveryHint(failure: unknown): string | null {
  if (failure instanceof ApiError && failure.errorCode === 'LOGIN_NONCE_INVALID') {
    return '버튼을 한 번 더 눌러 주세요 — 누를 때마다 처음부터 새로 시작해요.'
  }
  return null
}
