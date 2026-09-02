import { API_BASE_URL, API_PREFIX } from './config'
import { UNKNOWN_ERROR, type ClientErrorCode, type ErrorCode } from './errors'

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
 * 토큰을 메모리에만 둔다.
 *
 * `localStorage` 에 두면 XSS 하나로 토큰이 나간다. 새로고침에 로그인이 풀리는 것은 대가다 —
 * `GET /me` 가 생겼어도 **물어볼 토큰이 남아 있지 않으므로** 그 대가는 아직 그대로다.
 * 리프레시 토큰을 브라우저가 어떻게 들고 있을 것인가는 쿠키를 쓰지 않기로 한 전제(B-12)를
 * 건드리는 결정이라 ADR 이 먼저다 (backend #278). **지금 편한 쪽으로 정해 두면 나중에
 * 그것이 기본값이 된다.**
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
  signal?: AbortSignal
}

/**
 * 계약 경로 하나를 부른다.
 *
 * 자격 증명을 보내지 않는다 (`credentials` 기본값 `same-origin`). 인증은 `Authorization`
 * 헤더의 Bearer 토큰이고 서버도 쿠키를 받지 않는다 (backend B-12).
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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

  const response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })

  const requestId = response.headers.get(REQUEST_ID_HEADER) ?? undefined

  if (!response.ok) {
    if (response.status === 401) {
      // 401 을 만나는 자리가 여기 하나다. 서버가 이 토큰을 받지 않았다는 것은 **어느 경로에서
      // 들었든 같은 사실**이므로, 화면마다 다시 판단하게 두지 않고 여기서 버린다. 계속 들고
      // 있으면 이후 모든 요청이 거절될 토큰을 붙여 나가고, 화면은 로그인된 줄 안다.
      //
      // 재발급을 시도하지 않는다 — `POST /auth/refresh` 에는 리프레시 토큰이 필요한데
      // 그것을 어디에 둘 것인가가 아직 결정되지 않았다 (F-3, backend #278).
      accessToken = null
    }
    throw new ApiError(response.status, ...(await errorOf(response)), requestId)
  }
  if (!hasJsonBody(response)) {
    return undefined as T
  }
  return (await response.json()) as T
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
