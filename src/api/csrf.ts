/**
 * `XSRF-TOKEN` 쿠키를 읽는 자리 — **여기 하나다** (backend ADR-0008, 이슈 #278).
 *
 * 계약에서 CSRF 토큰을 요구하는 경로는 `POST /auth/refresh` 하나이고(double-submit), 서버가
 * 모든 `/api/v1/**` 응답에 이 쿠키를 갱신하므로 **따로 발급받는 경로가 없다.** 그래서 프론트가
 * 할 일은 *읽어서 헤더로 돌려보내는 것* 뿐이다.
 *
 * `document.cookie` 파싱을 화면이나 훅으로 누출하지 않는다. 이 경계를 두는 이유는 재사용이
 * 아니라 **브라우저 API 를 아는 자리를 하나로 묶는 것**이다 — 쿠키 문자열을 여러 곳에서
 * 자르기 시작하면 그중 하나가 인코딩이나 접두어 일치에서 조용히 틀린다.
 */

/** Spring Security 의 `CookieCsrfTokenRepository` 가 굽는 이름이다. 우리가 고르는 값이 아니다. */
const CSRF_COOKIE = 'XSRF-TOKEN'

/**
 * 지금 돌려보낼 CSRF 토큰. 없으면 `null`.
 *
 * **없을 수 있다는 사실을 감추지 않는다.** 이 쿠키는 서버 응답이 굽는 것이라, 이 문서가 아직
 * `/api/v1/**` 을 한 번도 부르지 않았거나 브라우저가 쿠키를 지웠으면 없다. 그때 헤더 없이
 * 재발급을 부르면 계약이 `403` 으로 답하므로(ADR-0008), 부르는 쪽이 *성립할 수 없는 요청*을
 * 보내지 않도록 `null` 을 그대로 준다 — 빈 문자열로 대신하면 그 사실이 사라진다.
 */
export function readCsrfToken(): string | null {
  // 브라우저가 아닌 실행 환경(테스트 · 도구)에는 쿠키 자체가 없다. 있는 척하지 않는다.
  if (typeof document === 'undefined') {
    return null
  }
  return readCookie(document.cookie, CSRF_COOKIE)
}

/**
 * `name=value; name2=value2` 에서 하나를 꺼낸다.
 *
 * **`includes` 로 찾지 않는다** — `XSRF-TOKEN` 은 `MY-XSRF-TOKEN` 의 부분 문자열이기도 하다.
 * 값은 서버가 URL 인코딩해 굽고 브라우저가 그대로 돌려주므로 여기서 디코딩한다.
 */
function readCookie(cookies: string, name: string): string | null {
  for (const pair of cookies.split(';')) {
    const separator = pair.indexOf('=')
    if (separator === -1) {
      continue
    }
    if (pair.slice(0, separator).trim() !== name) {
      continue
    }
    const value = pair.slice(separator + 1).trim()
    return value === '' ? null : decodeURIComponent(value)
  }
  return null
}
