/**
 * Google 이 발급한 ID 토큰을 얻는 자리 — **아직 붙지 않았다.**
 *
 * 계약의 `POST /auth/oauth/google` 은 `idToken` 을 요구하고, 그것을 만드는 것은 우리 서버가
 * 아니라 Google 이다. **dev 우회가 없다** — 실제 OAuth 앱(클라이언트 ID · 승인된 오리진)이
 * 있어야 토큰이 나온다. 이 레포에는 그 앱이 아직 없다.
 *
 * **가짜 토큰을 만들어 넘기지 않는다.** 넘기면 로그인 화면이 도는 것처럼 보이고, 실패는
 * 서버의 검증 단계에서 이유를 알 수 없는 401 로 나타난다. 비어 있는 화면이 돌아가는 것처럼
 * 보이는 것이 프론트에서 가장 위험한 실패다 (CLAUDE.md — 미구현을 통과시키지 않는다).
 *
 * 그래서 **경계만 세우고 명시적으로 실패시킨다.** 실제 provider 가 준비되면 이 파일 하나를
 * 바꾸면 되고, `LoginScreen` 은 손대지 않는다.
 */
export type GoogleIdTokenProvider = (signal: AbortSignal) => Promise<string>

/** 로그인 수단이 아직 없다는 사실. 서버 오류가 아니므로 `ApiError` 와 섞지 않는다. */
export class GoogleSignInUnavailableError extends Error {
  constructor() {
    super('Google 로그인이 아직 연결되지 않았어요.')
    this.name = 'GoogleSignInUnavailableError'
  }
}

/**
 * 지금의 provider.
 *
 * 붙이는 쪽이 해야 하는 일 — OAuth 클라이언트 ID 를 환경에서 읽고(기본값을 두지 않는다),
 * Google 의 로그인 흐름을 띄우고, 받은 ID 토큰을 그대로 돌려준다. **토큰은 어떤 저장소에도
 * 두지 않는다** — 이 함수의 반환값으로만 흐르고 `LoginScreen` 의 메모리에서 끝난다 (F-3).
 */
export const requestGoogleIdToken: GoogleIdTokenProvider = () =>
  Promise.reject(new GoogleSignInUnavailableError())
