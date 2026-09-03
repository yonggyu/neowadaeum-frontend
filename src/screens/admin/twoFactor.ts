/**
 * 관리자 2FA 화면이 판단하는 것 — 코드를 보낼 수 있는가, 실패를 무엇이라 말하는가.
 *
 * React 밖에 두는 이유는 이 둘이 이 이슈의 보안 면 전체이기 때문이다. 컴포넌트 안에 있으면
 * 렌더링 없이는 확인할 수 없고, 그러면 **"같은 코드를 다시 보내지 않는다" 를 지키는 것이
 * 코드가 아니라 리뷰어가 된다.**
 */

/** 계약 `TotpCodeRequest.code` 의 `^[0-9]{6}$`. 손으로 정한 값이 아니다. */
export const CODE_LENGTH = 6

/**
 * 입력을 계약이 받는 모양으로 좁힌다.
 *
 * 숫자가 아닌 것을 지우고 길이를 자른다 — 붙여 넣은 값에 공백이나 하이픈이 섞여 오는 것이
 * 인증기 앱에서 흔하고, 그것을 그대로 보내면 서버는 형식 오류로 답한다. 그 `400` 은 코드가
 * 틀렸다는 뜻이 아닌데 화면은 구분할 방법이 없다.
 */
export function normalizeCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, CODE_LENGTH)
}

/**
 * 지금 이 코드를 보낼 수 있는가.
 *
 * **`lastSubmitted` 와 같으면 보내지 않는다.** 한 스텝 동안 같은 여섯 자리가 유효하므로,
 * 실패한 코드를 그대로 다시 누를 수 있게 두면 화면이 재사용을 대신 해 주는 꼴이 된다 —
 * 서버가 재사용을 막는 이유(어깨너머로 본 코드)를 프론트에서 무르는 것이다.
 *
 * 자동 재시도는 어디에도 두지 않는다. 새 코드는 사람이 인증기에서 읽어 넣는다.
 */
export function canSubmitCode(
  code: string,
  options: { lastSubmitted: string | null; pending: boolean },
): boolean {
  if (options.pending) {
    return false
  }
  if (code.length !== CODE_LENGTH) {
    return false
  }
  return code !== options.lastSubmitted
}

/**
 * 실패를 무엇이라 말하는가 — **서버가 준 문장 그대로다** (F-4).
 *
 * `status` 로도 `error` 코드로도 `details` 로도 가르지 않는다. 계약이 이유를 적었다:
 * 등록 없음 · 확정 전 · 코드 불일치 · 재사용이 전부 `403` 하나이며, 구분해 알리면 그것이
 * 곧 단서다 (backend S-6). 여기서 "코드가 틀렸어요" 와 "먼저 등록하세요" 를 나눠 적는
 * 순간, 서버가 감춘 것을 화면이 되돌려 준다.
 *
 * 계약 밖 응답(네트워크 단절 · 프록시)에는 `client.ts` 가 이미 안전한 폴백 문장을 붙여
 * 두었다 — 여기서 또 짓지 않는다.
 */
export function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
