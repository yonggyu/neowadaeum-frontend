import { ApiError, hasAccessToken, renewAccessToken, setAccessToken } from '../api/client'
import { logout, type TokenResponse } from '../api/endpoints/auth'
import { getMe, type MeResponse } from '../api/endpoints/me'

/**
 * 부팅 시점의 인증 상태 — 셋뿐이다.
 *
 * `restoring` 은 **아직 모르는 상태**다. 이것을 익명과 합치면 복원이 끝나기 전 한 프레임 동안
 * 화면이 "로그아웃됨" 을 그리고, 곧 로그인 화면으로 튀거나 반대로 되돌아온다.
 *
 * 계정은 `MeResponse` 그대로 나른다. 계약이 이미 화면이 쓰는 것만 담고 있어(§13-7) 여기서
 * 더 좁힐 것이 없고, 손으로 다시 적으면 그것이 두 번째 진실이 된다 (F-2).
 */
export type AuthState =
  | { kind: 'restoring' }
  | { kind: 'authenticated'; account: MeResponse }
  | { kind: 'anonymous'; reason: AnonymousReason }

/**
 * 익명인 **이유**. 화면이 익명 하나로만 알면 세 사실이 같은 문구를 받는다.
 *
 * - `no_token` — 물어볼 토큰이 없었다. 재발급도 되지 않아 `GET /me` 를 부르지도 못했다
 * - `rejected` — 물어봤고 서버가 `401` 로 거절했다
 * - `unreachable` — 물어봤으나 답을 받지 못했다. 로그인 여부는 **여전히 모른다**
 */
export type AnonymousReason = 'no_token' | 'rejected' | 'unreachable'

/**
 * 부팅 복원 — **재발급 한 단계, 그다음 `getMe`.**
 *
 * `#24` 가 남겨 둔 모양 그대로다: *"결정이 서면 이 함수는 `getMe` 앞에 재발급 한 단계가 붙는
 * 모양으로 늘어난다 — 상태 셋은 그대로다."* 그 결정이 ADR-0008(backend #278)로 났고, 여기가
 * 그 한 단계다. **상태 셋(`restoring` · `authenticated` · `anonymous`)도 익명의 이유 셋도
 * 그대로 둔다** — 늘어난 것은 순서뿐이다.
 *
 * 새로고침이 액세스 토큰을 지우는 것은 여전하다 (F-3 — 메모리에만 둔다). 달라진 것은 그다음
 * 이다: 리프레시 쿠키가 `HttpOnly` 로 남아 있으므로 **물어볼 토큰을 여기서 다시 얻을 수 있다.**
 */
export async function restoreSession(signal?: AbortSignal): Promise<AuthState> {
  // 토큰이 없으면 재발급을 한 번 시도한다. 그래도 없으면 `GET /me` 를 부르지 않는다 —
  // 물어봤자 401 이고, 그 401 은 "거절당했다" 로 읽혀 **없는 사실을 만든다.**
  //
  // 재발급이 실패하는 길은 셋이다: 쿠키가 없거나(첫 방문) · 만료됐거나(401) · CSRF 토큰이
  // 없다. 셋 다 지금 보낼 토큰이 없다는 같은 결론이고, 그 이상을 화면에 말하지 않는다.
  if (!hasAccessToken() && !(await renewAccessToken())) {
    return { kind: 'anonymous', reason: 'no_token' }
  }

  try {
    return { kind: 'authenticated', account: await getMe(signal) }
  } catch (error) {
    // 401 이면 토큰은 이미 버려졌다 — 그 처리는 `request` 한곳에 있다.
    if (error instanceof ApiError && error.status === 401) {
      return { kind: 'anonymous', reason: 'rejected' }
    }
    // 서버가 답하지 못한 것은 토큰이 틀렸다는 뜻이 아니다. 그래도 **로그인됐다고 말할 수는
    // 없으므로** 익명으로 두되, 무엇이 일어났는지는 이유에 남긴다. 오류를 화면에 그리지
    // 않는 것은 부팅이 계약 오류 화면을 띄울 자리가 아니기 때문이다 (F-4 의 분기는 그
    // 요청을 실제로 일으킨 화면이 한다).
    return { kind: 'anonymous', reason: 'unreachable' }
  }
}

/**
 * 로그인이 방금 성공했다 — 그 사실을 인증 상태로 바꾼다 (#217).
 *
 * **토큰이 도착하는 자리와 인증 상태가 만들어지는 자리를 하나로 묶는다.** 그 둘이 갈라져
 * 있던 것이 `#217` 이다: 로그인 화면이 `setAccessToken` 으로 모듈 변수만 갱신했고, 가드가
 * 보는 `AuthState` 는 부팅 때의 `anonymous` 그대로여서 로그인 직후 보호 라우트가 열리지
 * 않았다. **여기를 지나지 않고 토큰만 넣는 길을 만들지 않는다.**
 *
 * `TokenResponse` 는 계정을 싣지 않는다 — `accessToken` · `tokenType` · `expiresIn` 셋뿐이다.
 * 그래서 `authenticated` 를 여기서 지어낼 수 없고 `restoreSession` 을 그대로 다시 탄다.
 * 토큰이 방금 들어갔으므로 그 안의 재발급 단계는 지나가고 `GET /me` 한 번만 나간다 — 새
 * 경로가 아니라 **부팅이 걷던 길의 뒷부분**이다.
 *
 * 실패도 부팅과 같은 뜻을 갖는다: 서버가 답하지 못했으면 `unreachable` 이고, 그것은
 * 로그아웃이 아니다. 그 판정을 화면이 다시 하지 않도록 여기서 갈라 두지 않는다 —
 * `guardDecision` 하나가 그 넷을 읽는다.
 */
export async function beginSession(tokens: TokenResponse): Promise<AuthState> {
  // 저장소에 쓰지 않는다 — 메모리에만 둔다 (F-3).
  setAccessToken(tokens.accessToken)
  return restoreSession()
}

/**
 * 로그아웃 — **나갔다는 사실을 두 자리에서 함께 만든다** (#231, §13-94).
 *
 * `beginSession` 의 반대 방향이고, 같은 이유로 여기 있다: 토큰이 사라지는 자리와 인증 상태가
 * 만들어지는 자리가 갈리면 그중 한쪽이 먼저 낡는다 (#217).
 *
 * **서버를 먼저 부른다.** 브라우저의 리프레시 쿠키는 `HttpOnly` 라 JS 가 지우지 못하므로,
 * 그것을 무를 수 있는 것은 서버의 응답 하나뿐이다. 메모리만 비우면 **새로고침 한 번에 그
 * 쿠키로 다시 로그인된다** — 사용자는 나갔다고 믿고 브라우저는 그대로 들고 있다.
 *
 * **실패하면 상태를 바꾸지 않고 던진다.** 나가지 못했는데 화면만 익명으로 만들면 그것이
 * 바로 위의 실패다. 부르는 쪽이 서버 문구를 그대로 보여 준다 (F-4).
 *
 * 성공했을 때 액세스 토큰을 비우는 것은 **쿠키가 이미 무효가 된 뒤**다 — 순서가 반대면
 * 요청이 자격 증명 없이 나간다.
 */
export async function endSession(signal?: AbortSignal): Promise<AuthState> {
  await logout(signal)
  setAccessToken(null)
  return { kind: 'anonymous', reason: 'no_token' }
}
