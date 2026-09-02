import { request } from '../client'
import type { components } from '../schema'

/**
 * 인증 — `POST /auth/oauth/{provider}` 하나.
 *
 * 타입을 손으로 적지 않는다 (F-2). 계약의 스키마를 그대로 좁혀 내보낸다 — 화면은
 * `components['schemas'][...]` 를 직접 헤집지 않고 이 이름들만 안다.
 */
export type ConsentItem = components['schemas']['ConsentItem']
export type ConsentType = ConsentItem['consentType']
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
 */
export function loginWithOAuth(
  body: OAuthLoginRequest,
  signal?: AbortSignal,
): Promise<TokenResponse> {
  return request<TokenResponse>(`/auth/oauth/${PROVIDER}`, { method: 'POST', body, signal })
}
