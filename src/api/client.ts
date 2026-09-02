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
 * `localStorage` 에 두면 XSS 하나로 토큰이 나간다. 새로고침에 로그인이 풀리는 것은 대가이며,
 * 그 대가를 어떻게 다룰지는 인증 화면을 붙일 때 정한다 — **지금 편한 쪽으로 정해 두면
 * 나중에 그것이 기본값이 된다.**
 */
export function setAccessToken(token: string | null): void {
  accessToken = token
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
    throw new ApiError(response.status, ...(await errorOf(response)), requestId)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
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
