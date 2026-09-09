import { readCsrfToken } from '../csrf'
import { request } from '../client'
import type { components } from '../schema'

/**
 * 인증 — nonce 발급 `POST /auth/nonce` · 로그인 `POST /auth/oauth/{provider}` ·
 * 재발급 `POST /auth/refresh`.
 *
 * **이 파일에 인증 경로가 셋 있지만 자격 증명을 실어 보내는 것은 둘뿐이다**
 * (backend ADR-0008, 이슈 #278). 셋째인 `issueLoginNonce` 는 **로그인보다도 앞이라 실어 보낼
 * 자격 증명이 아예 없다** — 붙이면 백엔드가 재발급 하나로 좁혀 둔 CSRF 면제 경계가 어긋난다.
 * `withCredentials` 가 다른 파일로 번지면 모든 요청이 쿠키를 싣게 되고, F-3 이 막으려던 것이
 * 뒷문으로 돌아온다 — 그 경계를 `auth.test.ts` 가 **경로 이름까지 적어** 못박는다.
 *
 * 타입을 손으로 적지 않는다 (F-2). 계약의 스키마를 그대로 좁혀 내보낸다 — 화면은
 * `components['schemas'][...]` 를 직접 헤집지 않고 이 이름들만 안다.
 */
export type AuthNonceResponse = components['schemas']['AuthNonceResponse']
export type ConsentItem = components['schemas']['ConsentItem']
export type ConsentType = ConsentItem['consentType']
export type ConsentTerm = components['schemas']['ConsentTerm']
export type ConsentTermsResponse = components['schemas']['ConsentTermsResponse']
export type OAuthLoginRequest = components['schemas']['OAuthLoginRequest']
export type TokenResponse = components['schemas']['TokenResponse']

/**
 * MVP 의 provider 는 하나다.
 *
 * 계약의 `provider` enum 이 `[google]` 뿐이고(§13-11), `/auth/email/*` 는 명시적으로 계약에서
 * 제외됐다. 상수로 두는 것은 **선택지가 있다는 뜻이 아니라 경로에 박힌 값이라는 뜻**이다 —
 * 두 번째 provider 가 생기면 계약의 enum 이 먼저 늘고, 그때 여기가 매개변수가 된다.
 */
const PROVIDER = 'google'

/**
 * 로그인 nonce 발급 (`issueLoginNonce`, 백엔드 §13-87 · 이슈 #424).
 *
 * 로그인 **앞에** 한 번 부른다. 받은 값을 Google Identity Services 의 `initialize({ nonce })`
 * 에 그대로 실으면 그 값이 ID 토큰의 클레임이 되고, 서버가 로그인에서 자기가 발급한 것과
 * 대조한다. **`loginWithOAuth` 의 본문에 담는 값이 아니다** — `OAuthLoginRequest` 에 그 필드는
 * 없고 앞으로도 만들지 않는다. 같은 요청이 실어 온 값을 그 요청 안에서 비교하면 대조가
 * 성립하지 않기 때문이다.
 *
 * **요청에 본문이 없다.** 만드는 쪽이 서버다. `POST` 인 것은 조회가 아니라 **서버에 상태를
 * 만들기** 때문이며, 두 번 부르면 값이 둘 생긴다.
 *
 * **`withCredentials` 를 붙이지 않는다.** 로그인보다 앞이라 실어 보낼 자격 증명이 없고,
 * 계약이 이 오퍼레이션에 `security: []` 를 적었다. 붙이는 순간 자격 증명을 싣는 경로가 셋이
 * 되어 백엔드가 좁혀 둔 CSRF 경계와 어긋난다 (ADR-0008).
 *
 * 실패는 `ApiError` 로 올라오고 문구를 여기서 짓지 않는다 (F-4). **이 경로에는 인증 경로 셋이
 * 함께 쓰는 IP 기준 호출 한도가 걸려 있다** (백엔드 S-8) — 그래서 부르는 쪽이 실패에 자동으로
 * 다시 부르지 않는다. 다시 부르는 것은 사용자가 로그인을 다시 누를 때뿐이다.
 */
export function issueLoginNonce(signal?: AbortSignal): Promise<AuthNonceResponse> {
  return request<AuthNonceResponse>('/auth/nonce', { method: 'POST', signal })
}

/**
 * 소셜 로그인 · 가입 (`loginWithOAuth`).
 *
 * 최초 로그인이면 `birthDate` · `consents` 가 함께 가야 한다. 기존 회원은 `idToken` 만 보낸다 —
 * 매번 동의를 다시 받으면 동의 이력이 로그인 이력이 된다 (백엔드 §13-24).
 *
 * **`idToken` 은 `issueLoginNonce` 가 발급한 nonce 를 클레임으로 담고 있어야 한다** (§13-87).
 * 그 값은 한 번만 통과하므로 **이 요청은 재시도 가능한 요청이 아니다** — 같은 `idToken` 을 다시
 * 보내면 두 번째부터 `401 LOGIN_NONCE_INVALID` 다. 그래서 `Idempotency-Key` 가 여기 붙지
 * 않는다 (F-7 이 말하는 "재시도가 있는 요청" 이 아니다). 회복은 재발급이 아니라 **nonce 부터
 * 로그인 왕복을 처음부터 다시** 하는 것이다.
 *
 * 실패는 `ApiError` 로 올라온다. 화면은 `errorCode` 로 분기한다 (F-4):
 * `CONSENT_REQUIRED`(400) · `LOGIN_NONCE_INVALID`(401) · `AGE_RESTRICTED`(403) ·
 * `RATE_LIMITED` 등(429).
 *
 * **`refreshToken` 을 응답에서 읽지 않는다 — 없다** (ADR-0008). 리프레시 토큰은 이 응답의
 * `Set-Cookie` 로 오며, `credentials: 'include'` 를 싣지 않으면 **브라우저가 그 쿠키를 그냥
 * 버린다.** 그러면 재발급에 쓸 자격 증명이 처음부터 생기지 않아 새로고침이 여전히 로그인을
 * 푼다 — 이 옵션이 로그인에도 붙는 이유가 그것이다 (백엔드 §13-60 의 "프론트가 고쳐야 하는 것" 2).
 */
/**
 * 로그아웃 — **이 브라우저에서 나간다** (§13-94, 이슈 #473).
 *
 * **재발급과 같은 경로다.** 리프레시 쿠키의 `Path` 가 그 경로 하나이므로 다른 자리에 두면
 * 브라우저가 쿠키를 붙이지 않는다 — 그래서 메서드로 가른다. **자격 증명을 싣는 *경로* 는
 * 여전히 둘이고**(로그인 · 재발급), 늘어난 것은 그 경로의 메서드다.
 *
 * **`credentials: 'include'` 가 필수다.** 싣지 않으면 브라우저가 응답의 `Set-Cookie` 를
 * 버려 **쿠키가 그대로 남는다** — 화면은 성공으로 보이고 새로고침하면 다시 로그인된 상태가
 * 된다. 로그아웃에서 그 실패는 *돌아가는 것처럼 보이는* 것 중에서도 나쁜 쪽이다.
 *
 * **언제나 `204` 다** — 쿠키가 없어도, 토큰이 만료됐어도. 서버가 검증하지 않기로 했으므로
 * (§13-94) 화면도 *나가지 못했다* 를 그릴 경우를 만들지 않는다. 남는 실패는 서버에 닿지
 * 못한 것 하나이며 그것은 `ApiError` 로 올라온다.
 *
 * **서버가 무르는 것은 브라우저의 흔적까지다.** 리프레시 토큰이 상태 없는 서명 JWT 라
 * 탈취된 토큰은 이 요청으로 무효가 되지 않는다 — 화면이 그 이상을 약속하지 않는다.
 *
 * ## CSRF 토큰을 여기서 읽는다 — `refreshToken` 과 다른 점이다
 *
 * 재발급은 토큰을 **매개변수로 받는다.** 부르는 쪽(`renewAccessToken`)이 *쿠키가 없다* 와
 * *서버가 거절했다* 를 갈라야 하기 때문이다 — 부팅 경로라 그 둘을 뭉개면 로그인 상태를
 * 잘못 판정한다.
 *
 * **여기에는 그 구분이 없다.** 어느 쪽이든 결과는 *나가지 못했다* 하나이고, 그 사실을 말하는
 * 문장은 서버가 준다 (F-4). 그래서 읽는 자리를 부르는 쪽으로 올리지 않는다 — 올리면 화면
 * 계층이 쿠키를 알게 되고, 없을 때 **프론트가 문구를 지어내야 하는 분기**가 새로 생긴다.
 */
export function logout(signal?: AbortSignal): Promise<void> {
  return request<void>('/auth/refresh', {
    method: 'DELETE',
    withCredentials: true,
    // 없으면 헤더 없이 나가고 서버가 `403` 과 그 문구로 답한다. 빈 문자열로 대신하지 않는다 —
    // 그러면 *보냈는데 틀렸다* 가 되어 실제로 일어난 일과 다른 사실이 서버에 도착한다.
    csrfToken: readCsrfToken() ?? undefined,
    signal,
  })
}

export function loginWithOAuth(
  body: OAuthLoginRequest,
  signal?: AbortSignal,
): Promise<TokenResponse> {
  return request<TokenResponse>(`/auth/oauth/${PROVIDER}`, {
    method: 'POST',
    body,
    withCredentials: true,
    signal,
  })
}

/**
 * 액세스 토큰 재발급 (`refreshToken`).
 *
 * **요청에 본문이 없다.** 자격 증명은 로그인·재발급이 구운 `HttpOnly` 쿠키 하나이고, 브라우저가
 * `Path=/api/v1/auth/refresh` 때문에 **이 경로에만** 붙인다 (ADR-0008). 프론트는 그 값을 읽지
 * 못하고, 읽지 못하는 것이 이 설계의 요점이다 — XSS 가 30일짜리 토큰을 가져갈 자리가 없다.
 *
 * **계약에서 CSRF 토큰을 요구하는 경로는 여기 하나다.** `XSRF-TOKEN` 쿠키 값을 그대로
 * `X-XSRF-TOKEN` 헤더로 돌려보낸다(double-submit). 값을 만들어 내지 않고 부르는 쪽에서 받는다 —
 * 쿠키를 읽는 자리는 `api/csrf.ts` 하나여야 하고, 없을 때 *무엇을 할 것인가*는 계약이 아니라
 * 부르는 쪽의 판단이다.
 *
 * 실패는 `ApiError` 로 올라오고 **문구를 여기서 짓지 않는다** (F-4):
 * 쿠키가 없거나 무효면 `401 UNAUTHENTICATED`, CSRF 가 어긋나면 `403 FORBIDDEN`, `429` 도 있다.
 */
export function refreshToken(csrfToken: string, signal?: AbortSignal): Promise<TokenResponse> {
  return request<TokenResponse>('/auth/refresh', {
    method: 'POST',
    withCredentials: true,
    csrfToken,
    signal,
  })
}

/**
 * 지금 동의를 받아야 할 약관의 종류 · 판본 · 본문 주소 (`getConsentTerms`).
 *
 * **인증 없이 열린다** — 가입 전 화면이 부르는 경로이고 회원에 관한 값이 하나도 없다 (S-9).
 * 그래서 `/auth/*` 아래가 아니라 `/consents` 다.
 *
 * 여기서 읽은 `version` 을 `loginWithOAuth` 의 `consents[].version` 에 **그대로 되돌려
 * 보낸다** (backend #261). 프론트가 판본을 상수로 들면 약관이 개정된 날부터 동의 이력에
 * 옛 판본이 쌓이고, **그것은 조용히 틀린다.**
 *
 * 판본이 서버 설정에 없으면 **기본 판본을 지어내지 않고 실패한다** — 그것이 서버의 설계다.
 * 실패는 `ApiError` 로 올라오고, 화면은 판본을 얻지 못한 채 동의를 보내지 않는다.
 */
export function getConsentTerms(signal?: AbortSignal): Promise<ConsentTermsResponse> {
  return request<ConsentTermsResponse>('/consents', { signal })
}
