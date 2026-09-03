/**
 * Step 5 — 미리보기가 판단하는 것 (와이어프레임 3e).
 *
 * **여기에 `3` 이 없다.** R8.13 은 미리보기를 *"3턴 후 자동 종료"* 로 적지만, 정정본 §13-36 은
 * 그 값을 **`play_session.turn_limit` 에 두기로** 정했다 — `is_test_session` 인 세션이
 * 미리보기만이 아니기 때문이다(관리자 디버그 세션도 같은 플래그를 쓴다). 그래서 상한은
 * 세션마다 다를 수 있고, 응답의 `turnLimit` 이 그것을 말한다.
 *
 * 프론트가 3을 적으면 두 가지가 따라온다 — 서버가 값을 바꾸는 날 화면이 거짓말을 하고,
 * 그 사실은 작성자가 네 번째 턴에서 `403` 을 만날 때 처음 드러난다 (§13-36 이 `turnLimit` 을
 * 응답에 넣은 이유가 정확히 그것이다).
 */

/**
 * 이 세션이 더 만들 수 있는 턴이 있는가.
 *
 * **화면이 막는 것이 아니다** — 상한을 지키는 것은 서버의 턴 가드다 (§13-36: *"상한을
 * 클라이언트에 맡기면 그것은 상한이 아니라 안내다"*). 여기서 하는 일은 그 거부를 만나기 전에
 * 끝났다고 말해 주는 것뿐이다.
 */
export function isPreviewOver(turnNo: number, turnLimit: number): boolean {
  return turnNo >= turnLimit
}

/** 3e 의 "TURN 1 / turnLimit". 두 숫자 모두 서버가 준 값이다. */
export function previewTurnLabel(turnNo: number, turnLimit: number): string {
  return `TURN ${turnNo} / ${turnLimit}`
}
