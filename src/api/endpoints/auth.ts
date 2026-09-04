import { request } from '../client'
import type { components } from '../schema'

/**
 * 인증 — 로그인 `POST /auth/oauth/{provider}` 과 재발급 `POST /auth/refresh`.
 *
 * **자격 증명을 실어 보내는 경로는 이 파일 안의 둘뿐이다** (backend ADR-0008, 이슈 #278).
 * `withCredentials` 가 다른 파일로 번지면 모든 요청이 쿠키를 싣게 되고, F-3 이 막으려던 것이
 * 뒷문으로 돌아온다 — 그 경계를 `auth.test.ts` 가 못박는다.
 *
 * 타입을 손으로 적지 않는다 (F-2). 계약의 스키마를 그대로 좁혀 내보낸다 — 화면은
 * `components['schemas'][...]` 를 직접 헤집지 않고 이 이름들만 안다.
 */
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
 * 소셜 로그인 · 가입 (`loginWithOAuth`).
 *
 * 최초 로그인이면 `birthDate` · `consents` 가 함께 가야 한다. 기존 회원은 `idToken` 만 보낸다 —
 * 매번 동의를 다시 받으면 동의 이력이 로그인 이력이 된다 (백엔드 §13-24).
 *
 * 실패는 `ApiError` 로 올라온다. 화면은 `errorCode` 로 분기한다 (F-4):
 * `CONSENT_REQUIRED`(400) · `AGE_RESTRICTED`(403) · `RATE_LIMITED` 등(429).
 *
 * **`refreshToken` 을 응답에서 읽지 않는다 — 없다** (ADR-0008). 리프레시 토큰은 이 응답의
 * `Set-Cookie` 로 오며, `credentials: 'include'` 를 싣지 않으면 **브라우저가 그 쿠키를 그냥
 * 버린다.** 그러면 재발급에 쓸 자격 증명이 처음부터 생기지 않아 새로고침이 여전히 로그인을
 * 푼다 — 이 옵션이 로그인에도 붙는 이유가 그것이다 (백엔드 §13-60 의 "프론트가 고쳐야 하는 것" 2).
 */
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
