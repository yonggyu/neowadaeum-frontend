import { request } from '../client'
import type { components } from '../schema'

/**
 * 대표 이미지 업로드 — 발급 · **저장소로 직접 PUT** · 확정 (백엔드 #315, 정정본 §13-65).
 *
 * **`authoring.ts` 에 두지 않았다.** 그 파일이 지키는 규칙은 *경로 하나 = 파일 하나*이고
 * 이 두 오퍼레이션은 분명히 `/authoring/**` 아래다. 그런데도 나눈 이유는 경로가 아니라
 * **가운데 걸음** 때문이다 — 이 흐름에는 우리 API 클라이언트를 타지 않고 **남의 오리진으로
 * 나가는 요청**이 하나 들어 있다. 그것이 이 레포에서 유일하므로, 다음 사람이 *"우리 토큰이
 * 나가지 않는 자리가 어디인가"* 를 물었을 때 열 파일이 하나여야 한다. 280줄짜리 파일의
 * 한 문단으로 두면 그 사실은 읽히지 않고, 아래의 소스 검사(`draftImages.test.ts`)도
 * "`authoring.ts` 는 예외" 라는 넓은 구멍으로 바뀐다.
 *
 * **세 걸음을 한 함수(`uploadDraftImage`)로 묶는다.** 셋을 따로 내놓으면 호출부가 확정을
 * 빠뜨릴 수 있고, 확정되지 않은 키는 **확인된 적이 없는 키**여서 원고에 적을 값이 아니다
 * (§13-65). 순서를 문서로 부탁하는 대신 구조로 막는다.
 */

/** 자리 둘 — 커버(1단계) · 초상(3단계). **키(경로)는 서버가 정한다.** */
export type ImageSlot = components['schemas']['ImageUploadRequest']['slot']

/**
 * 발급 요청에 실을 수 있는 형식.
 *
 * **손으로 적지 않는다** (F-2). 이 열거가 늘거나 줄면 타입이 먼저 깨지고, 그것을 받는 자리는
 * `screens/authoring/imageUpload.ts` 하나다.
 */
export type ImageContentType = components['schemas']['ImageUploadRequest']['contentType']

export type ImageUploadRequest = components['schemas']['ImageUploadRequest']
export type ImageUploadResponse = components['schemas']['ImageUploadResponse']
export type ImageCommitRequest = components['schemas']['ImageCommitRequest']
export type ImageCommitResponse = components['schemas']['ImageCommitResponse']

const images = (draftId: string): string =>
  `/authoring/drafts/${encodeURIComponent(draftId)}/images`

/**
 * 업로드 자리 발급 (`issueDraftImageUpload`).
 *
 * **요청이 고르는 것은 자리와 형식뿐이다.** 파일 이름도 확장자도 경로도 보내지 않는다 —
 * 클라이언트가 경로를 정하면 **남의 원고 자리에 덮어쓸 수 있고**, 그때 잃는 것은 남의 원고다
 * (§13-65). 그래서 이 함수의 매개변수에 키를 받을 자리가 없다.
 *
 * **파일을 고른 뒤에 부른다.** 돌아오는 `uploadUrl` 은 짧게 만료된다(`expiresAt`) — 화면을
 * 열 때 미리 받아 두면 사용자가 파일 고르기를 미루는 동안 만료된다.
 *
 * 남의 원고는 `403` 이 아니라 `404` 다 (I-8) — `getDraft` 와 같은 이유로 이 함수도 없는
 * 원고와 구분하지 않는다.
 */
export function issueDraftImageUpload(
  draftId: string,
  slot: ImageSlot,
  contentType: ImageContentType,
  signal?: AbortSignal,
): Promise<ImageUploadResponse> {
  const body: ImageUploadRequest = { slot, contentType }
  return request<ImageUploadResponse>(images(draftId), { method: 'POST', body, signal })
}

/**
 * 업로드 확정 (`commitDraftImageUpload`).
 *
 * 서버가 저장소에 물어 **실제로 올라온 바이트의 형식과 크기**를 확인한다. 브라우저가 직접
 * 올리므로 서버는 본문을 보지 못했고, 확인하지 않으면 5 MiB 상한은 *클라이언트가 지키기로 한
 * 약속*일 뿐이다 (§13-65).
 *
 * **`400` 은 "다시 눌러 보세요" 가 아니다.** 형식이 목록 밖이거나 상한을 넘었으면 서버가
 * **그 객체를 지우고** `400` 을 준다 — 지워진 뒤이므로 같은 키로 확정을 다시 부를 수 없고,
 * 화면도 그 상태를 "올라갔다" 로 그리지 않는다. 다시 하려면 발급부터다.
 */
export function commitDraftImageUpload(
  draftId: string,
  objectKey: string,
  signal?: AbortSignal,
): Promise<ImageCommitResponse> {
  const body: ImageCommitRequest = { objectKey }
  return request<ImageCommitResponse>(`${images(draftId)}/commit`, {
    method: 'POST',
    body,
    signal,
  })
}

/**
 * 저장소가 우리 오류 형태로 말하지 않았다.
 *
 * 서명된 URL 의 상대는 **우리 서버가 아니다.** 실패하면 돌아오는 것은 `{error, message,
 * details}` 가 아니라 저장소의 XML 이거나, 아무것도 아니거나(CORS · 네트워크), 우리가 읽을
 * 자격이 없는 무엇이다. 그것을 `ApiError` 로 옮기면 **화면이 서버가 하지 않은 말을 하게
 * 된다** — `errors.ts` 가 `UNKNOWN_ERROR` 를 따로 둔 것과 같은 판단이고, 여기서는 계약 밖인
 * 정도가 아니라 **상대가 다르다.**
 *
 * 그래서 이 오류는 사용자에게 보일 문구를 들고 있지 않다. `status` 는 진단용이며, 화면에 낼
 * 말은 `screens/authoring/imageUpload.ts` 가 한 곳에서 정한다 (F-4).
 */
export class StorageUploadError extends Error {
  /** 저장소가 준 HTTP 상태. 응답 자체가 없었으면(네트워크 · CORS) `null` 이다. */
  readonly status: number | null

  // 매개변수 프로퍼티를 쓰지 않는다 — tsconfig 의 erasableSyntaxOnly 가 금지한다.
  constructor(status: number | null) {
    super(`storage upload failed (${status ?? 'no response'})`)
    this.name = 'StorageUploadError'
    this.status = status
  }
}

/**
 * 서명된 URL 로 파일을 직접 올린다. **우리 API 클라이언트를 타지 않는다.**
 *
 * `api/client.ts` 의 `request` 는 우리 오리진에 말을 거는 함수다 — `Authorization: Bearer`
 * 를 붙이고, `API_BASE_URL` 을 앞에 붙이고, `401` 을 재발급으로 복구하고, 응답을 계약의
 * 오류 형태로 읽는다. **네 가지가 전부 여기서는 틀렸다.** 특히 첫 번째가 그렇다: 서명된 URL
 * 은 제3자의 저장소이고, 거기에 우리 토큰을 실어 보내는 것은 **남에게 자격 증명을 보내는
 * 일**이다. 그 토큰은 우리 API 전체를 여는 값이며, 저장소는 그것을 요구한 적이 없다.
 *
 * `credentials` 도 마찬가지로 붙지 않는다. CLAUDE.md 가 `credentials: 'include'` 를 싣는
 * 경로를 **로그인과 재발급 둘**로 못박았고 `endpoints/auth.test.ts` 가 그 경계를 지킨다 —
 * 저장소는 그 둘이 아니며, 애초에 우리 오리진도 아니다.
 *
 * **`Content-Type` 은 발급받은 값 그대로다.** 그 헤더가 서명에 들어가 있어서(§13-65) 다른
 * 값으로 올리면 저장소가 서명 불일치로 거절한다. 여기서 `file.type` 을 다시 읽지 않는 이유가
 * 그것이다 — 읽으면 발급 때 고른 값과 갈라질 수 있는 자리가 하나 생긴다.
 *
 * **메서드도 우리가 정하지 않는다.** 계약이 `uploadMethod` 를 응답에 실었고 지금은 `PUT`
 * 하나다 — 우리가 `'PUT'` 이라고 적으면 계약이 값을 준 이유가 없어진다.
 */
export async function putToStorage(
  issued: ImageUploadResponse,
  file: Blob,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response
  try {
    response = await fetch(issued.uploadUrl, {
      method: issued.uploadMethod,
      // 헤더는 이 하나다. `Authorization` 을 붙이지 않는다 — 위의 이유.
      headers: { 'Content-Type': issued.contentType },
      body: file,
      // `credentials` 를 적지 않는다. 브라우저 기본값 `same-origin` 이고, 저장소는
      // same-origin 이 아니므로 쿠키가 나가지 않는다.
      signal,
    })
  } catch (cause) {
    // 취소는 실패가 아니다 — 화면이 파일을 바꿨거나 컴포넌트가 사라진 것이고, 그것을
    // "업로드 실패" 로 그리면 사용자가 하지 않은 일이 화면에 남는다.
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw cause
    }
    throw new StorageUploadError(null)
  }
  if (!response.ok) {
    // 본문을 읽지 않는다. 저장소의 XML 을 사용자에게 보일 수 없고, 읽어서 우리 형태로
    // 옮기는 것은 **없는 계약을 지어내는 일**이다.
    throw new StorageUploadError(response.status)
  }
}

/** 세 걸음 중 어디까지 왔는지. 화면의 다섯 상태 중 진행 중인 둘이 여기서 갈린다. */
export interface UploadProgress {
  /** 발급이 돌아왔다 — 이제 저장소로 올린다. `maxBytes` 는 이 응답의 값이다. */
  onIssued?: (issued: ImageUploadResponse) => void
  /** 저장소가 받았다 — 이제 서버가 확인한다. **아직 원고에 적을 수 없다.** */
  onStored?: () => void
  signal?: AbortSignal
}

/**
 * 발급 → PUT → 확정. **셋이 다 끝나야 `objectKey` 가 원고에 적을 값이 된다** (§13-65).
 *
 * 돌려주는 것은 확정 응답 하나다. 중간의 `objectKey`(발급이 준 것)를 내보내지 않는 이유는,
 * 그 값이 *서버가 자리를 잡아 두었다* 는 뜻일 뿐 **무엇이 올라왔는지도, 올라왔는지도**
 * 말하지 않기 때문이다. 확정을 통과한 키만 확인된 키다.
 *
 * **응답에 이미지 URL 이 없다** (I-8) — 버킷이 비공개라 영구 공개 URL 이 존재하지 않는다.
 * 그래서 이 함수도, 이것을 부르는 어떤 화면도 URL 을 조립하지 않는다. 열람 경로는 소유자 ·
 * 검수자에 한해 백엔드가 뒤에 연다.
 *
 * **`Idempotency-Key` 를 붙이지 않는다.** 계약이 그 헤더를 선언한 오퍼레이션은 턴 생성
 * 하나이고(R6.2), 여기에는 중복 과금이 없다 — 두 번 올리면 키가 둘 생기고 원고에 적히는
 * 것은 마지막 하나다 (`authoring.ts` 와 같은 판단).
 */
export async function uploadDraftImage(
  draftId: string,
  slot: ImageSlot,
  contentType: ImageContentType,
  file: Blob,
  progress: UploadProgress = {},
): Promise<ImageCommitResponse> {
  const issued = await issueDraftImageUpload(draftId, slot, contentType, progress.signal)
  progress.onIssued?.(issued)

  await putToStorage(issued, file, progress.signal)
  progress.onStored?.()

  return commitDraftImageUpload(draftId, issued.objectKey, progress.signal)
}
