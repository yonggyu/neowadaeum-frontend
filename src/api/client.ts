import { API_BASE_URL, API_PREFIX } from './config'
import { readCsrfToken } from './csrf'
import { refreshToken } from './endpoints/auth'
import {
  UNKNOWN_ERROR,
  UNREACHABLE_MESSAGE,
  type ClientErrorCode,
  type ErrorCode,
} from './errors'

/**
 * 백엔드가 돌려주는 오류 한 형태 (계약의 `Error` 스키마).
 *
 * 코드 필드의 이름은 **`error`** 다 — `code` 가 아니다. 셋이 같은 말을 한다:
 * `openapi.yaml` 의 `Error.required: [error, message, details]`, 위키 `50-API/error-contract`,
 * 백엔드 CLAUDE.md. `details` 도 필수이며 **`null` 이 되지 않는다** — 값이 없으면 빈 객체다.
 *
 * 화면은 `error` 로 분기하고 `message` 를 그대로 보여 준다 (F-4).
 */
export interface ApiErrorBody {
  error: ErrorCode
  message: string
  details: Record<string, unknown>
}

export class ApiError extends Error {
  readonly status: number

  /**
   * 계약의 `error` 필드.
   *
   * 속성 이름을 `error` 로 두지 않는 이유는 `Error` 를 상속하기 때문이다 — `err.error` 는
   * 읽는 사람을 멈추게 한다. `code` 로도 두지 않는다: 그 이름 때문에 실제로 한 번 어긋났다.
   */
  readonly errorCode: ClientErrorCode

  readonly details: Record<string, unknown>

  /** 서버 로그와 이어 붙일 값. 사용자가 오류를 제보할 때 이것 하나면 된다. */
  readonly requestId: string | undefined

  // 매개변수 프로퍼티를 쓰지 않는다 — tsconfig 의 erasableSyntaxOnly 가 금지한다.
  // 타입만 지우면 실행되는 코드로 유지하겠다는 결정이며, 그 대가가 이 몇 줄이다.
  constructor(
    status: number,
    errorCode: ClientErrorCode,
    message: string,
    details: Record<string, unknown>,
    requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = errorCode
    this.details = details
    this.requestId = requestId
  }
}

/** 서버가 돌려주는 추적 ID. CORS 노출 헤더에 들어 있다 (backend #248). */
const REQUEST_ID_HEADER = 'X-Request-Id'

let accessToken: string | null = null

/**
 * 토큰을 메모리에만 둔다 (F-3).
 *
 * `localStorage` 에 두면 XSS 하나로 토큰이 나간다. **이 규칙은 리프레시 쿠키가 생긴 뒤에도
 * 그대로다** (ADR-0008, backend #278) — 바뀐 것은 *리프레시* 쪽이고, 그것은 애초에 JS 가 읽을
 * 수 없는 자리(`HttpOnly` 쿠키)로 갔다. 액세스 토큰은 여전히 이 변수 하나에만 산다.
 *
 * 새로고침에 이 변수가 비는 것은 그대로이고, 그 뒤를 `renewAccessToken` 이 잇는다.
 */
export function setAccessToken(token: string | null): void {
  accessToken = token
}

/**
 * 지금 보낼 토큰을 들고 있는가.
 *
 * 값을 내주지 않는다 — 묻는 쪽이 알아야 하는 것은 "물어볼 것이 있는가" 하나다. 토큰 자체를
 * 꺼낼 수 있게 만들면 그 값이 로그·에러 리포트로 새는 길이 생긴다 (보안 hard-stop).
 *
 * 부팅 복원이 이것을 먼저 묻는다. **토큰이 없으면 `GET /me` 는 부를 수조차 없고**, 그때의
 * `401` 은 "거절당했다" 가 아니라 "물어보지 못했다" 이다 — 두 사실을 섞지 않기 위해서다.
 */
export function hasAccessToken(): boolean {
  return accessToken !== null
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** 중복 과금을 막는 값 (backend R6.2). 턴 생성처럼 재시도가 있는 요청에 붙인다 (F-7). */
  idempotencyKey?: string
  /**
   * 관리자 경로의 단계 승격 (계약 `parameters/AdminStepUp`, backend S-4).
   *
   * `headers` 를 통째로 열지 않고 이름 붙은 옵션을 하나 더 두는 이유는 `idempotencyKey` 와
   * 같다 — 임의 헤더 맵을 받으면 호출부가 `Authorization` 을 덮어쓸 수 있고, 그때 *누구인가*
   * 와 *방금 두 번째 요소를 통과했는가* 가 같은 자리를 다투게 된다. 계약이 그 둘을 나눠
   * 놓은 이유가 그것이다.
   *
   * 값을 만드는 곳도 붙이는 곳도 `endpoints/admin.ts` 하나다.
   */
  adminStepUp?: string
  /**
   * 브라우저가 쿠키를 붙이고 응답의 `Set-Cookie` 를 받아들이게 한다 (`credentials: 'include'`).
   *
   * **계약이 이것을 요구하는 오퍼레이션은 둘뿐이다** — `loginWithOAuth`(쿠키를 받는다)와
   * `refreshToken`(쿠키로 인증한다). 붙이는 자리도 `endpoints/auth.ts` 둘뿐이며, 그 경계를
   * 테스트가 못박는다 (`endpoints/auth.test.ts`).
   *
   * 다른 경로로 번지면 안 되는 이유는 리프레시 쿠키가 실려서가 아니다 — 그 쿠키는 `Path` 가
   * 재발급 경로 하나라 애초에 붙지 않는다. **번지면 안 되는 것은 규칙 쪽이다**: 모든 요청이
   * 자격 증명을 싣는 클라이언트가 되면 CSRF 를 감당해야 하는 경로가 하나에서 전부로 늘고,
   * 백엔드가 좁혀 둔 면제 경계(ADR-0008)와 어긋난다.
   */
  withCredentials?: true
  /**
   * double-submit CSRF 토큰 (`X-XSRF-TOKEN`). `XSRF-TOKEN` 쿠키 값을 그대로 돌려보낸다.
   *
   * `headers` 를 통째로 열지 않고 이름 붙은 옵션을 두는 이유는 `adminStepUp` 과 같다.
   * **계약에서 이 헤더를 요구하는 경로는 `POST /auth/refresh` 하나다** (ADR-0008).
   */
  csrfToken?: string
  signal?: AbortSignal
}

/**
 * 계약 경로 하나를 부른다.
 *
 * 인증은 `Authorization` 헤더의 Bearer 토큰이다. 자격 증명(쿠키)은 **기본으로 보내지 않는다**
 * (`credentials` 기본값 `same-origin`) — 실어 보내는 경로는 `withCredentials` 를 명시한 둘뿐이며,
 * 그 둘을 계약이 정했다 (ADR-0008).
 *
 * **`401` 을 만나면 재발급을 한 번 시도하고, 되면 그 요청을 한 번만 다시 부른다.** 되지 않으면
 * 토큰을 버리고 원래의 `401` 을 그대로 올린다 — 화면이 익명으로 떨어질 근거는 서버가 준
 * 그 응답이지 우리가 지어낸 상태가 아니다.
 *
 * **거절하는 값은 `ApiError` 아니면 취소(`AbortError`) 둘뿐이다.** 이것이 이 함수가 화면에
 * 주는 약속이며, 부르는 쪽이 각자 폴백을 두지 않아도 되는 근거다 — 폴백을 화면마다 두면
 * 같은 실패에 서로 다른 문구가 붙고, **닿지 않는 그 갈래를 다음 사람이 살아 있는 길로 읽는다.**
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await send<T>(path, options)
  } catch (error) {
    if (!isUnauthenticated(error)) {
      throw error
    }
    // **재발급 자체의 `401` 로는 다시 재발급하지 않는다** — 그 자리가 무한 루프다. 자격 증명을
    // 싣는 두 경로(로그인 · 재발급)의 `401` 은 "액세스 토큰이 낡았다" 가 아니라 "쿠키가 없거나
    // 무효다" 이고, 그것은 재발급이 고칠 수 있는 사실이 아니다.
    if (options.withCredentials === true || !(await renewAccessToken())) {
      // 서버가 이 토큰을 받지 않았다는 것은 **어느 경로에서 들었든 같은 사실**이므로 화면마다
      // 다시 판단하게 두지 않고 여기서 버린다. 계속 들고 있으면 이후 모든 요청이 거절될 토큰을
      // 붙여 나가고, 화면은 로그인된 줄 안다.
      accessToken = null
      throw error
    }
    try {
      // 다시 부르는 것은 **한 번뿐이다.** 새 토큰으로도 `401` 이면 재발급이 고칠 수 있는 문제가
      // 아니다 — 권한이 없거나 회원 상태가 바뀐 것이고, 더 도는 것은 서버를 두드리는 일이다.
      return await send<T>(path, options)
    } catch (retried) {
      if (isUnauthenticated(retried)) {
        accessToken = null
      }
      throw retried
    }
  }
}

/** `401` 인가. 재발급을 시도할 유일한 조건이다 — `403` 은 토큰이 낡은 것이 아니라 자격의 문제다. */
function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

/**
 * 지금 진행 중인 재발급. **동시에 여러 요청이 `401` 을 받아도 재발급은 한 번만 나간다.**
 *
 * 공유하지 않으면 화면 하나가 병렬로 부른 요청 넷이 재발급 넷을 만든다 — 서버의 회전 정책과
 * `429` 를 그만큼 빨리 소모하고, 마지막에 도착한 응답이 앞의 토큰을 덮는다.
 */
let renewal: Promise<boolean> | null = null

/**
 * 리프레시 쿠키로 액세스 토큰을 되찾는다. 성공하면 `true` (ADR-0008, backend #278).
 *
 * 부팅 복원과 `401` 복구가 같은 이것을 부른다 — 두 곳이 각자 재발급을 들고 있으면 새로고침
 * 직후 둘이 동시에 나간다.
 *
 * **`AbortSignal` 을 받지 않는다.** 진행 중인 하나를 여럿이 공유하므로 한 호출자의 취소가
 * 다른 호출자의 재발급을 끊게 된다. 부팅 쪽의 취소는 결과를 버리는 방식으로 처리한다
 * (`useAuthSession` 의 `settled`).
 *
 * **실패의 뜻은 하나다 — 지금 보낼 토큰이 없다.** 무엇이 잘못됐는지를 여기서 화면에 그리지
 * 않는다: 부팅도 `401` 복구도 계약 오류 화면을 띄우는 자리가 아니다 (F-4 의 분기는 그 요청을
 * 실제로 일으킨 화면이 한다). 화면이 재발급을 직접 부르는 경우의 문구는 `refreshToken` 이
 * `ApiError` 로 **서버가 준 그대로** 나른다.
 */
export function renewAccessToken(): Promise<boolean> {
  if (renewal === null) {
    renewal = attemptRenewal()
    // 결과가 나오면 자물쇠를 푼다. `attemptRenewal` 안의 `finally` 로 하면 동기 반환(쿠키가
    // 없는 경우)에서 **대입보다 먼저** 돌아 자물쇠가 영영 잠긴 채 남는다.
    void renewal.finally(() => {
      renewal = null
    })
  }
  return renewal
}

async function attemptRenewal(): Promise<boolean> {
  // 헤더 없이 부르면 계약이 `403` 이다 (ADR-0008). 성립할 수 없는 요청을 보내지 않는다 —
  // 이 경로에도 `429` 가 있고, 익명 방문자의 첫 부팅이 그것을 소모할 이유가 없다.
  const csrfToken = readCsrfToken()
  if (csrfToken === null) {
    return false
  }
  try {
    accessToken = (await refreshToken(csrfToken)).accessToken
    return true
  } catch {
    return false
  }
}

/**
 * 요청 한 번 — 보내고, 응답을 계약의 값이나 `ApiError` 로 옮긴다.
 *
 * **`401` 을 여기서 해석하지 않는다.** 재발급을 시도할지 · 토큰을 버릴지는 이 요청 하나만
 * 보고는 정할 수 없고, 재시도 자체가 이 함수를 다시 부르는 일이다 — 그 판단은 `request` 하나가 한다.
 */
async function send<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (accessToken !== null) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }
  if (options.idempotencyKey !== undefined) {
    headers['Idempotency-Key'] = options.idempotencyKey
  }
  if (options.adminStepUp !== undefined) {
    headers['X-Admin-Step-Up'] = options.adminStepUp
  }
  if (options.csrfToken !== undefined) {
    headers['X-XSRF-TOKEN'] = options.csrfToken
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      // 값을 적지 않으면 브라우저 기본값 `same-origin` 이다. 그것이 이 클라이언트의 기본이며,
      // 예외는 계약이 정한 두 경로뿐이다 (ADR-0008).
      credentials: options.withCredentials === true ? 'include' : undefined,
      signal: options.signal,
    })
  } catch (cause) {
    throw asUnreachable(cause)
  }

  const requestId = response.headers.get(REQUEST_ID_HEADER) ?? undefined

  if (!response.ok) {
    // `401` 을 해석하는 자리는 `request` 하나다 — 재발급을 시도할지, 토큰을 버릴지는 이 요청
    // 하나만 보고는 정할 수 없다. 여기서 버려 버리면 재발급이 성공해도 다시 부를 토큰이 없다.
    throw new ApiError(response.status, ...(await errorOf(response)), requestId)
  }
  if (!hasJsonBody(response)) {
    return undefined as T
  }
  try {
    return (await response.json()) as T
  } catch (cause) {
    // 성공 응답인데 본문이 계약 형태가 아니다 — 프록시가 끼어들었거나 읽는 도중 끊겼다.
    // 여기서 막지 않으면 브라우저의 `SyntaxError: Unexpected end of JSON input` 이 그대로
    // 화면의 `message` 가 된다. 오류 본문 쪽은 `errorOf` 가 이미 같은 일을 하고 있었고,
    // 성공 쪽만 비어 있었다 (#63).
    throw asUnreachable(cause)
  }
}

/**
 * 파싱할 본문이 있는가.
 *
 * **상태 코드로 판단하지 않는다.** `204` 는 언제나 비어 있지만 `202` 는 그렇지 않다 —
 * `createReport` 의 `202` 는 본문이 없고(§13-12) `submitDraft` 의 `202` 는
 * `ReviewStatusResponse` 를 담는다. "202 면 본문 없음" 으로 적으면 둘 중 하나가 반드시
 * 틀린다. 빈 본문에 `response.json()` 을 부르면 던지므로 조용히 넘어가지도 않는다.
 */
function hasJsonBody(response: Response): boolean {
  if (response.status === 204 || response.headers.get('Content-Length') === '0') {
    return false
  }
  return response.headers.get('Content-Type')?.includes('application/json') === true
}

/**
 * 응답이 **오지 않았거나 읽어 낼 수 없는** 실패를 계약 밖 오류로 옮긴다.
 *
 * `errorOf` 의 폴백은 오류 응답의 본문에만 붙는다. 서버가 뜨지 않았거나 · DNS 가 틀렸거나 ·
 * CORS 가 막았거나 · 오프라인이면 `fetch` 가 그 앞에서 던지고, 지금까지는 브라우저의
 * `TypeError: Failed to fetch` 가 그대로 화면에 떴다. 성공 응답의 본문이 파싱되지 않는
 * 경우도 같은 자리다 — 우리가 요청한 것을 받지 못한 것은 마찬가지다.
 *
 * 코드는 **계약의 것을 빌리지 않는다.** `UNKNOWN` 이 이미 같은 취지로 있다 — 계약 밖이라는
 * 사실을 그대로 들고 간다. 상태는 `0` 이다: HTTP 응답이 없었으므로 적을 상태 코드가 없고,
 * 0 을 실제 상태로 오해할 자리도 없다.
 */
function asUnreachable(cause: unknown): unknown {
  // 취소는 오류가 아니다. 화면을 떠나며 **우리가 끊은 것**이므로 그대로 다시 던진다 —
  // 여기서 오류로 바꾸면 이동할 때마다 오류 화면이 뜬다.
  if (cause instanceof Error && cause.name === 'AbortError') {
    return cause
  }
  return new ApiError(0, UNKNOWN_ERROR, UNREACHABLE_MESSAGE, {})
}

/**
 * 오류 본문을 읽는다.
 *
 * 본문이 계약 형태가 아닐 수 있다 — 프록시가 끼어들거나 서버가 뜨지 않았을 때가 그렇다.
 * 그때 파싱 실패를 던지면 **원래 오류가 사라진다.**
 */
async function errorOf(
  response: Response,
): Promise<[errorCode: ClientErrorCode, message: string, details: Record<string, unknown>]> {
  try {
    const body = (await response.json()) as ApiErrorBody
    if (typeof body?.error === 'string') {
      return [body.error, body.message, body.details ?? {}]
    }
  } catch {
    // 계약 형태가 아니다. 아래로 떨어진다.
  }
  return [UNKNOWN_ERROR, `요청이 실패했어요 (HTTP ${response.status})`, {}]
}

/**
 * `request()` 가 거절한 값을 화면이 쓰는 타입으로 좁힌다.
 *
 * **폴백이 아니다.** 위의 약속대로 `request()` 는 `ApiError` 아니면 취소만 던진다 — 계약 밖
 * 실패도, 파싱되지 않는 본문도 여기서 이미 `ApiError` 가 된다. 그래서 아래 갈래에 남는 것은
 * 취소뿐이고, 취소는 부르는 쪽이 `signal.aborted` 로 먼저 거른다.
 *
 * 그런데도 이 함수가 있는 이유는 하나다 — `Promise.catch` 와 `PagedApi.error` 가 `unknown`
 * 을 주므로 **타입을 좁힐 자리**가 필요하다. 그 자리를 화면마다 두면 각자 다른 문구를
 * 짓는다: 실제로 `usePlaySession` 이 여기와 다른 문구를 들고 있었고, 그 문구는 `client.ts`
 * 가 앞에서 `ApiError` 로 바꾸는 바람에 한 번도 화면에 뜨지 못했다 (#63).
 */
export function toApiError(cause: unknown): ApiError {
  if (cause instanceof ApiError) {
    return cause
  }
  return new ApiError(0, UNKNOWN_ERROR, UNREACHABLE_MESSAGE, {})
}
