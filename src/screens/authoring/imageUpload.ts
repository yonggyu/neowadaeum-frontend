import { ApiError } from '../../api/client'
import type {
  ImageCommitResponse,
  ImageContentType,
  ImageUploadResponse,
} from '../../api/endpoints/draftImages'

/**
 * 대표 이미지 자리의 판정 — 화면 없이 정해지는 것들 (7차 와이어프레임 A-2).
 *
 * **상태가 다섯이라 명세가 따로 나왔다**(비어 있음 · 올리는 중 · 확정 중 · 실패 · 올라감).
 * 자리는 둘(커버 · 초상)이고 **같은 컴포넌트**가 둘 다 그린다 — 그 둘이 실제 사용처이므로
 * 공통 모듈이 정당하다 (CLAUDE.md 추상화 제한 1번). 그 이상 일반화하지 않는다: 자리를 임의로
 * 늘릴 수 있는 제네릭 유틸을 만들면 계약이 열거한 둘 밖의 자리가 있는 것처럼 보인다.
 *
 * 판정을 컴포넌트에서 꺼내 두는 이유는 `precheck.ts` 와 같다 — 미리보기 칸 · 파일 입력 ·
 * 다음 버튼 셋이 각자 상태를 해석하면 그중 하나가 언젠가 여섯 번째 상태를 그린다. 이 레포의
 * 러너에 DOM 이 없다는 사실도 같은 방향을 가리킨다.
 */

/**
 * 자리 하나의 상태 — 다섯.
 *
 * **`objectKey` 가 `uploaded` 에만 있다.** 이것이 *"확정하지 않은 키를 원고에 적지 않는다"*
 * (§13-65)를 지키는 방식이며, 규칙을 주석으로 부탁하는 대신 타입으로 막는다. 나머지 네
 * 상태에는 그 값을 꺼낼 자리 자체가 없다.
 */
export type ImageUploadState =
  | { readonly status: 'empty' }
  /** 저장소로 올리는 중. `maxBytes` 는 **발급 응답이 준 값**이다 — 코드에 적힌 숫자가 아니다. */
  | { readonly status: 'uploading'; readonly maxBytes: number }
  /** 저장소는 받았고 서버가 확인하는 중. **아직 원고에 적을 수 없다.** */
  | { readonly status: 'committing' }
  | { readonly status: 'failed'; readonly message: string }
  /** 확정을 통과했다. 원고에 적는 값은 `objectKey` 하나다. */
  | {
      readonly status: 'uploaded'
      readonly objectKey: string
      /** 저장소가 말한 형식. **요청이 말한 값이 아니다.** 다시 열었을 때는 모른다(`null`). */
      readonly contentType: string | null
      /** 저장된 바이트 수. 다시 열었을 때는 모른다(`null`). */
      readonly sizeBytes: number | null
    }

/** 아직 아무것도 고르지 않았다. */
export const EMPTY: ImageUploadState = { status: 'empty' }

/**
 * 발급이 돌아왔다 → 올리는 중.
 *
 * **여기서 `maxBytes` 를 든다.** 화면이 진행률을 서버가 말한 상한에 대고 그릴 수 있게 하기
 * 위해서이고, 그 숫자를 코드에 적지 않기 위해서다 — `5 * 1024 * 1024` 라고 쓰면 서버가
 * 상한을 올리는 날 화면만 옛 숫자를 말한다.
 *
 * **상한을 여기서 강제하지 않는다.** 계약이 크기의 판정을 확정 단계에 두었고(§13-65 — 형식은
 * 서명이, 크기는 확정의 HEAD 가 건다), 그 `400` 에는 **서버가 쓴 `message` 가 실려 온다.**
 * 우리가 먼저 막으면 그 자리에 남는 것은 우리가 지어낸 문장이고, 그때부터 "얼마까지 되는가"
 * 를 말하는 곳이 둘이 된다. 상한은 표시하고, 판정은 서버가 한다.
 */
export function uploading(issued: ImageUploadResponse): ImageUploadState {
  return { status: 'uploading', maxBytes: issued.maxBytes }
}

/** 저장소가 받았다 → 확정 중. */
export function committing(): ImageUploadState {
  return { status: 'committing' }
}

/**
 * 확정이 통과했다 → 올라감.
 *
 * **인자가 확정 응답이다.** 다른 값으로는 이 상태를 만들 수 없으므로, 확정을 건너뛴 키가
 * `uploaded` 로 들어오는 경로가 없다.
 */
export function uploaded(commit: ImageCommitResponse): ImageUploadState {
  return {
    status: 'uploaded',
    objectKey: commit.objectKey,
    contentType: commit.contentType,
    sizeBytes: commit.sizeBytes,
  }
}

/**
 * 원고에 이미 적혀 있는 키로 화면을 연다.
 *
 * 원고의 `payload` 에 키가 있다는 것은 **전에 확정을 통과했다**는 뜻이다 — 확정되지 않은 키는
 * 애초에 거기 적히지 않는다. 그래서 이 값은 `uploaded` 로 복원한다. 형식과 크기는 원고가
 * 들고 있지 않으므로 `null` 이고, 화면은 그 둘 없이도 그려져야 한다.
 *
 * 키가 없으면 `empty` 다 — 원고를 다시 여는 자리와 처음 여는 자리가 같은 함수를 쓴다.
 */
export function savedImage(objectKey: string | null | undefined): ImageUploadState {
  if (typeof objectKey !== 'string' || objectKey === '') {
    return EMPTY
  }
  return { status: 'uploaded', objectKey, contentType: null, sizeBytes: null }
}

/**
 * 요청이 서버에 닿았는데 실패했다면 **서버가 준 문구**를, 저장소가 실패했다면 아래의 하나를.
 */
export function failed(error: unknown): ImageUploadState {
  return { status: 'failed', message: failureMessageOf(error) }
}

/**
 * 저장소가 실패했을 때의 문구 — **하나뿐이다.**
 *
 * F-4 는 서버가 준 `message` 를 그대로 보여 주라는 규칙이지, 서버가 아무 말도 하지 않은
 * 자리에서 문구를 지어내라는 뜻이 아니다. 서명된 URL 의 상대는 우리 서버가 아니어서
 * `{error, message, details}` 를 주지 않고, 준 것을 읽어 우리 말로 옮기면 그것이 곧
 * **없는 계약을 지어내는 일**이 된다.
 *
 * 그래서 `errors.ts` 의 `UNREACHABLE_MESSAGE` 와 같은 방식을 쓴다 — **문구를 하나만 두고
 * 원인을 짐작해 늘리지 않는다.** 403(서명 만료) · 413 · CORS · 오프라인을 갈라 적으면
 * 화면마다 다른 추측이 남고, 우리는 그중 무엇이 맞는지 모른다.
 */
export const UPLOAD_FAILED_MESSAGE = '이미지를 올리지 못했어요. 다시 시도해 주세요.'

/**
 * 실패를 화면의 한 줄로 옮긴다.
 *
 * `ApiError` 는 우리 서버가 말한 것이다 — **`message` 를 그대로 나른다** (F-4). 발급의 `404`
 * (남의 원고 · 없는 원고, I-8)도 확정의 `400`(형식 · 상한 위반, 그리고 **서버가 그 객체를
 * 지웠다**)도 여기로 온다. 둘을 구분해 다시 말하지 않는다.
 *
 * 그 밖은 저장소이거나 우리가 모르는 것이고, 모르는 것에 대해서는 위의 한 줄만 말한다.
 */
export function failureMessageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : UPLOAD_FAILED_MESSAGE
}

/**
 * 원고에 적을 값. **확정된 키만 나온다** — 나머지 네 상태는 전부 `null` 이다 (§13-65).
 *
 * 단계 저장(`patchDraft`)에 실을 값을 만드는 자리가 여기 하나여야 한다. 컴포넌트가
 * `state.status === 'uploaded' ? … ` 를 각자 쓰기 시작하면 그중 하나가 언젠가 `committing`
 * 을 포함시키고, 그때 원고에는 **확인된 적이 없는 키**가 적힌다.
 *
 * **URL 을 만들지 않는다** (I-8). 버킷이 비공개라 영구 공개 URL 이 존재하지 않으므로,
 * 키 앞에 오리진을 붙여 `<img src>` 를 만드는 코드는 반드시 깨진 이미지를 그린다.
 */
export function objectKeyOf(state: ImageUploadState): string | null {
  return state.status === 'uploaded' ? state.objectKey : null
}

/**
 * 진행 중인가 — 새 파일을 고를 수도, 다음 단계로 갈 수도 없는 동안.
 *
 * 확정 중을 포함한다. 그 사이에 다음 단계로 넘어가면 **확정이 끝나기 전의 원고**가 저장되고,
 * 사용자는 올렸다고 믿은 이미지가 없는 채로 다음 화면을 본다.
 */
export function isBusy(state: ImageUploadState): boolean {
  return state.status === 'uploading' || state.status === 'committing'
}

/**
 * 발급 요청에 실을 수 있는 형식 — **계약의 `ImageUploadRequest.contentType` 열거가 정본이다.**
 *
 * 파일을 고르기 *전에* 걸러야 하는 값이라 발급 응답에서 가져올 수 없다(발급은 파일을 고른
 * **뒤에** 한다 — `expiresAt` 이 짧다). 그래서 출처를 요청 쪽 열거로 정했다: 우리가 물어볼 수
 * 있는 형식은 계약이 요청에 허락한 형식과 정확히 같다.
 *
 * **`Record<ImageContentType, true>` 로 적는 것이 근거다.** 계약의 열거가 늘면 키가 모자라
 * 타입검사가 깨지고, 줄면 남는 키가 있어 깨진다 — `npm run api:types` 다음의 `typecheck` 가
 * 이 표와 계약이 갈라지는 것을 막는 게이트다. 배열로 적으면 그 검사가 없어 조용히 어긋난다.
 *
 * 응답 쪽의 `contentType` · `maxBytes` 는 이것과 다른 값이며 여기서 손대지 않는다 —
 * PUT 의 헤더는 `putToStorage` 가 발급 응답에서 그대로 가져가고, 상한은 확정이 판정한다.
 */
const REQUESTABLE: Record<ImageContentType, true> = {
  'image/jpeg': true,
  'image/png': true,
  'image/webp': true,
}

/** `<input type="file" accept>` 에 그대로 넣는 값. 화면이 목록을 다시 적지 않는다. */
export const FILE_ACCEPT = Object.keys(REQUESTABLE).join(',')

/**
 * 고른 파일의 형식이 발급 요청에 실을 수 있는 값인가. 맞으면 **그 값을 그대로** 돌려준다.
 *
 * 돌려주는 값이 곧 발급 요청의 `contentType` 이고, 발급 응답의 `contentType` 이 PUT 의
 * 서명된 헤더가 된다 (§13-65). 셋이 한 값이어야 저장소가 받는다.
 *
 * **이 검사는 방어가 아니다.** `accept` 속성도 이 검사도 우회할 수 있고, 그래서 서명이
 * 형식을 걸고 확정이 바이트를 확인한다. 여기서 거르는 이유는 하나다 — 걸러 내지 않으면
 * 서버가 거절할 형식으로 발급을 부르고, 사용자는 자기가 무엇을 잘못 골랐는지 모른 채
 * `400` 을 본다.
 */
export function requestableContentType(fileType: string): ImageContentType | null {
  return Object.prototype.hasOwnProperty.call(REQUESTABLE, fileType)
    ? (fileType as ImageContentType)
    : null
}
