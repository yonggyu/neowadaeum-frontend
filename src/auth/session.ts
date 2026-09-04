import { ApiError, hasAccessToken, renewAccessToken } from '../api/client'
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
