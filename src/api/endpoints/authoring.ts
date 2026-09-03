import { request } from '../client'
import type { components } from '../schema'

/**
 * 작품 만들기 슬라이스의 계약 (`tags: [authoring]`) — 원고 다섯 경로와 내 작품의 공개 범위.
 *
 * `me.ts` 에 두지 않는다 — 그 파일은 `/me/**` 를 부르는 자리이고 이것은 `/authoring/**` ·
 * `/stories/{id}` 다. 같은 화면이 쓴다는 이유로 한 파일에 모으면 경로와 파일의 대응이 한 번
 * 깨지고, 그다음부터는 어디를 열어야 하는지 매번 찾아야 한다.
 *
 * **`Idempotency-Key` 를 여기서 붙이지 않는다.** 계약이 그 헤더를 선언한 오퍼레이션은
 * 턴 생성 하나뿐이다 (R6.2). 선언되지 않은 경로에 붙이면 서버는 무시하고, 무시된 헤더는
 * "중복이 막히고 있다"는 잘못된 안심을 준다 — F-7 의 대상은 계약이 그렇게 정한 자리다.
 */
export type Visibility = components['schemas']['Visibility']
export type ReviewStatus = components['schemas']['ReviewStatus']
export type ReviewStatusResponse = components['schemas']['ReviewStatusResponse']

export type Draft = components['schemas']['DraftResponse']
export type DraftPatchRequest = components['schemas']['DraftPatchRequest']
export type SafetyState = components['schemas']['SafetyState']
export type Finding = components['schemas']['Finding']
export type PrecheckRequest = components['schemas']['PrecheckRequest']
export type PrecheckResponse = components['schemas']['PrecheckResponse']
export type OutlineResponse = components['schemas']['OutlineResponse']
export type OutlineChapter = components['schemas']['OutlineChapter']
export type OutlineEnding = components['schemas']['OutlineEnding']
export type PreviewResponse = components['schemas']['PreviewResponse']

/** 원고의 단계별 입력 원문 (§8.1). 계약이 `additionalProperties: true` 로 열어 둔 자리다. */
export type DraftPayload = Draft['payload']

/**
 * 챕터 전환 · 엔딩 도달 조건의 템플릿 키 넷 (정정본 §13-35).
 *
 * **계약에 이 목록을 주는 경로가 없다** (백엔드 #282). `OutlineChapter.conditionTemplateKey` ·
 * `OutlineEnding.conditionTemplateKey` 는 `string` 일 뿐이라 생성 타입이 값을 좁혀 주지
 * 않는다. 그래서 여기 상수로 든다 — 목록 오퍼레이션이 생기면 이 상수를 지우고 그것을 부른다.
 *
 * 손으로 적은 API 타입이 아니다 (F-2 위반이 아니다). 계약이 문자열로 열어 둔 값의 **허용
 * 집합**이며, 그 집합을 정한 것은 정정본이다 — *"채택: 넷. `affinity_at_least` ·
 * `has_flag` · `lacks_flag` · `turn_at_least`."* §4.5 · §4.6 의 조건 DSL 전체는 노출하지
 * 않는다: 열면 아무도 못 쓰는 화면이 되거나, 쓸 수 있는 사람이 조건 평가기의 미정의 동작을
 * 찾아낸다.
 *
 * **화면 문구를 여기 함께 적지 않는다.** 정정본이 정한 것은 키까지이고, 라벨은 조건 선택
 * UI(Step 4)를 만드는 이슈가 디자인과 함께 정한다 — 지금 지어 두면 그것이 기본값이 된다.
 */
export const CONDITION_TEMPLATE_KEYS = [
  'affinity_at_least',
  'has_flag',
  'lacks_flag',
  'turn_at_least',
] as const

export type ConditionTemplateKey = (typeof CONDITION_TEMPLATE_KEYS)[number]

const drafts = '/authoring/drafts'
const draft = (draftId: string): string => `${drafts}/${encodeURIComponent(draftId)}`

/**
 * 내 원고 목록 (`listDrafts`). 최근 것부터, **커서가 없다** — 배열 하나가 통째로 온다.
 *
 * **내 것만 나온다** (I-8). 검수 전 UGC 는 작성자 말고는 볼 수 없으므로 이 목록에 남의
 * 원고가 섞이는 경우를 화면이 다룰 필요가 없다.
 *
 * 응답에 `noticeText` 가 없다 — 작품 만들기는 창작 도구이지 감상 화면이 아니라서 AI 사전
 * 고지의 자리가 아니다. 목록 화면이 `AiNoticeFooter` 를 그리지 않는 근거가 이것이다.
 */
export function listDrafts(signal?: AbortSignal): Promise<Draft[]> {
  return request<Draft[]>(drafts, { signal })
}

/**
 * 드래프트 생성 (`createDraft`). 본문이 없다 — 계약에 `requestBody` 가 없다.
 *
 * **작성자당 개수 상한이 있다** (R8.12, §13-32). 닿으면 `409` 이며, 계약이 그 자리에 답도
 * 적어 두었다 — *"지우면 자리가 난다."* 화면은 그 문장을 행동으로 옮길 수 있어야 한다.
 * **상한 숫자를 화면이 말하지 않는다** — 계약이 값을 주지 않는다.
 */
export function createDraft(signal?: AbortSignal): Promise<Draft> {
  return request<Draft>(drafts, { method: 'POST', signal })
}

/**
 * 원고 조회 (`getDraft`).
 *
 * **남의 원고는 없는 것과 구분되지 않는다** (I-8) — `403` 이 아니라 `404` 다. 화면이 둘을
 * 구분해 말하면 그 방어가 무너진다: 존재 여부가 새면 원고 id 를 훑어 남이 무엇을 쓰고
 * 있는지 알 수 있다. 그래서 이 함수도 두 경우를 구분하지 않고, 호출부에 넘기는 것은
 * `ApiError` 하나다.
 */
export function getDraft(draftId: string, signal?: AbortSignal): Promise<Draft> {
  return request<Draft>(draft(draftId), { signal })
}

/**
 * 단계별 저장 (`patchDraft`). 응답은 **저장된 원고 전체**다.
 *
 * `safetyState` 가 `blocked` 이면 **서버가 다음 단계 진행을 거부한다** (R8.3) — 화면의
 * 비활성 버튼은 안내이지 방어가 아니다. 클라이언트 검증에만 의존하지 않는다.
 */
export function updateDraft(
  draftId: string,
  body: DraftPatchRequest,
  signal?: AbortSignal,
): Promise<Draft> {
  return request<Draft>(draft(draftId), { method: 'PATCH', body, signal })
}

/**
 * 원고 삭제 (`deleteDraft`). `204` · 본문 없음.
 *
 * **없어도 성공이다** — 삭제는 상태를 맞추는 요청이고, 두 번째 호출이 실패하면 클라이언트가
 * 재시도할 방법이 없다. 남의 원고는 지워지지 않으며 그 사실도 알리지 않는다.
 */
export function deleteDraft(draftId: string, signal?: AbortSignal): Promise<void> {
  return request<void>(draft(draftId), { method: 'DELETE', signal })
}

/**
 * 입력 중 실시간 검수 (`precheckDraft`, L0).
 *
 * 제출 후 반려가 아니라 **입력 중 피드백**이다 (R8.1). 요청은 `필드 경로 → 값` 하나이고
 * **`step` 을 담지 않는다.** 응답의 `state` 는 `clean` · `blocked` 로 오며(§13-33),
 * 진행 가능 여부를 서버가 boolean 으로 주지 않으므로 화면이 `state` 로 판정한다.
 *
 * 계정당 분당 20회 제한이 있다 (R8.4) — `429` 는 오류 화면이 `retryAfterSeconds` 로 다룬다.
 */
export function precheckDraft(
  draftId: string,
  body: PrecheckRequest,
  signal?: AbortSignal,
): Promise<PrecheckResponse> {
  return request<PrecheckResponse>(`${draft(draftId)}/precheck`, { method: 'POST', body, signal })
}

/**
 * 챕터·엔딩 AI 초안 (`outlineDraft`). 본문이 없다.
 *
 * **모델을 기다린다** — `504 GENERATION_TIMEOUT` 과 `502 PROVIDER_ERROR` 가 정상 응답의
 * 일부이며, 로딩이 이 호출의 기본 상태다. 조건은 사용자가 직접 쓰지 않고 **템플릿 선택만**
 * 한다 (R7.16) — `CONDITION_TEMPLATE_KEYS` 가 그 목록이다.
 */
export function outlineDraft(draftId: string, signal?: AbortSignal): Promise<OutlineResponse> {
  return request<OutlineResponse>(`${draft(draftId)}/outline`, { method: 'POST', signal })
}

/**
 * 미리보기 세션 (`previewDraft`). `201`.
 *
 * **상한을 응답이 알려 준다** (`turnLimit`) — 프론트가 3턴이라고 적지 않는다. 모르면
 * 작성자는 네 번째 턴에서 왜 막혔는지를 `403` 으로 처음 겪는다 (§13-36).
 */
export function previewDraft(draftId: string, signal?: AbortSignal): Promise<PreviewResponse> {
  return request<PreviewResponse>(`${draft(draftId)}/preview`, { method: 'POST', signal })
}

/**
 * 제출 (`submitDraft`). `202` 이고 **본문이 있다** — 검수 상태가 함께 온다.
 *
 * `visibility = public` 은 **인간 검수 필수**이며 (R8.6), 재제출은 작품을 늘리지 않는다
 * (R8.8) — 같은 작품에 새 버전을 얹는다. 재검수 동안 작품은 목록에서 내려간다 (§13-40).
 * 반려 사유는 **카테고리만** 온다 (R8.7) — 화면이 그 이상을 추측하지 않는다 (F-5).
 */
export function submitDraft(
  draftId: string,
  visibility: Visibility,
  signal?: AbortSignal,
): Promise<ReviewStatusResponse> {
  return request<ReviewStatusResponse>(`${draft(draftId)}/submit`, {
    method: 'POST',
    body: { visibility },
    signal,
  })
}

/**
 * 공개 범위 변경 (`changeStoryVisibility`). 응답은 **변경 후 상태**다.
 *
 * `unlisted → public` 승격은 **재검수를 강제 트리거한다** — 계약이 이유를 적었다:
 * *"자동 검수만 받은 작품이 공개 섹션에 올라오는 경로를 막는다."* 그래서 이 호출의 응답으로
 * `reviewStatus` 가 검수 중으로 되돌아오는 일이 정상이며, 화면은 그것을 실패로 읽지 않는다.
 * 서버가 준 상태 하나가 진실이고 프론트가 다시 판정하지 않는다.
 *
 * 응답의 `rejectReasons` 는 **카테고리만** 담는다 (백엔드 R8.7) — 화면이 그 이상을 추측하지
 * 않는다 (F-5).
 */
export function changeStoryVisibility(
  storyId: string,
  visibility: Visibility,
  signal?: AbortSignal,
): Promise<ReviewStatusResponse> {
  return request<ReviewStatusResponse>(`/stories/${encodeURIComponent(storyId)}/visibility`, {
    method: 'PATCH',
    body: { visibility },
    signal,
  })
}
