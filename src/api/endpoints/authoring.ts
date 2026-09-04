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

/**
 * 화면이 실제로 받는 검수 상태 — `deleted` 를 뺀 나머지.
 *
 * 계약이 이 값에 대해 직접 적었다: *"`deleted` 는 어떤 응답에도 실리지 않는다 … 열거에 두는
 * 것은 상태 머신의 정의가 여기이기 때문이며, **클라이언트가 분기를 만들 값이 아니다**"*
 * (`ReviewStatus`, 정정본 §13-58). 지운 작품은 목록 · 상세 · 이어하기 어디에서도 조회되지
 * 않으므로 이 값을 담을 응답이 없다.
 *
 * **라벨을 지어 두는 대신 타입에서 뺀다.** 라벨을 두면 절대 그려지지 않는 문구가 하나 생기고,
 * `ReviewPhase` 에 갈래를 더하면 절대 들어오지 않는 갈래가 생긴다 — 다음 사람은 그 둘을 보고
 * **지운 작품이 목록에 남는다**고 읽는다. 좁히는 자리가 여기인 이유는 생성 타입이 `api/` 까지
 * 흐르고 그 아래로는 화면이 실제로 쓰는 모양으로 넘어가기 때문이다.
 */
export type VisibleReviewStatus = Exclude<ReviewStatus, 'deleted'>

export type ReviewStatusResponse = Omit<
  components['schemas']['ReviewStatusResponse'],
  'reviewStatus'
> & { reviewStatus: VisibleReviewStatus }

export type AppealRequest = components['schemas']['AppealRequest']

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
 * 작품 만들기 메타데이터 — 장르와 조건 템플릿 (`getAuthoringMetadata`, backend #282 · #315).
 *
 * **둘의 정본이 서로 다르다** (정정본 §13-56). 장르는 `catalog` 의 표이고 운영이 늘릴 수
 * 있으며, 조건 템플릿 넷은 조건 평가기가 지원하는 형태라 코드의 열거형이다. **그래도 화면이
 * 읽는 자리는 하나다** — 같은 화면이 같은 시점에 둘 다 필요로 하고, 나누면 왕복이 둘이 된다.
 *
 * **라벨은 어느 쪽이든 서버의 것이다.** 프론트가 `affinity_at_least` 를 "호감도 이상" 으로
 * 옮기기 시작하면 표시 문구의 정본이 하나 더 생긴다 — `noticeText`(#257) ·
 * `ConsentItem.version`(#261) 과 같은 종류의 문제이며 그 둘은 같은 이유로 닫혔다.
 */
export type AuthoringMetadata = components['schemas']['AuthoringMetadataResponse']
export type AuthoringGenre = components['schemas']['AuthoringGenre']
export type ConditionTemplateSpec = components['schemas']['ConditionTemplateSpec']
export type ConditionTemplateParameter = components['schemas']['ConditionTemplateParameter']

/** 조건 템플릿 키 넷 (R7.16, 정정본 §13-35). **타입은 계약에서 온다** (F-2). */
export type ConditionTemplateKey = ConditionTemplateSpec['key']

/**
 * 화면이 채워야 하는 입력의 종류 — `character` · `flag` · `integer`.
 *
 * **자유 텍스트가 없다.** 계약이 그렇게 정했다: *"셋 다 고르는 것이다."* 입력창을 그리면
 * 작성자가 조건식을 직접 쓰는 것과 같아진다.
 */
export type ConditionParameterType = ConditionTemplateParameter['type']

/**
 * 작성 메타데이터 (`getAuthoringMetadata`). **작성자 경로라 토큰이 필요하다.**
 *
 * **순서를 화면이 정하지 않는다.** 장르는 `display_order` 로 오고 라이브러리와 같은 순서다 —
 * 여기서 다시 정렬하면 두 화면이 다른 순서를 보여 준다.
 */
export function getAuthoringMetadata(signal?: AbortSignal): Promise<AuthoringMetadata> {
  return request<AuthoringMetadata>('/authoring/metadata', { signal })
}

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
 * 한다 (R7.16) — 이 응답의 `conditionTemplates` 가 **이 원고에서 고를 수 있는 키**이고,
 * 그 키를 사람이 읽는 문구와 필요한 입력으로 옮기는 것은 `getAuthoringMetadata` 다 (§13-56).
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
 * 검수 상태 조회 (`getDraftReview`). **원고 쪽의 검수 상태다.**
 *
 * 내 작품 목록의 한 줄(`MyStoryItem`)은 catalog 가 그 쪽을 만들 때의 값이고, 이것은 작성자가
 * 이어서 고칠 **원고**에게 직접 묻는 값이다. 반려 화면에서 다음에 할 일이 원고를 고치는
 * 것이므로 그 원고가 지금 무엇을 들고 있는지는 원고에게 묻는다 — 둘이 어긋나면 이어서 쓸
 * 대상은 원고 쪽이다.
 *
 * **가는 길은 `MyStoryItem.draftId` 하나다** (backend #340, 정정본 §13-66). 제목 같은 것으로
 * 짝짓지 않는다 — 같은 제목의 원고가 둘이면 조용히 남의 것을 연다. 그래서 이 함수는
 * `draftId` 밖에 받지 않고, `draftId` 가 `null` 인 작품에는 이 경로가 **없다**
 * (미리보기가 만든 임시 작품, §13-5 · §13-37).
 *
 * `rejectReasons` 는 **카테고리만** 담는다 (R8.7) — 화면이 그 이상을 추측하지 않는다 (F-5).
 * 남의 원고는 `403` 이 아니라 `404` 이고 그것이 방어다 (I-8) — `getDraft` 와 같은 이유로
 * 화면도 없는 원고와 구분해 말하지 않는다.
 */
export function getDraftReview(draftId: string, signal?: AbortSignal): Promise<ReviewStatusResponse> {
  return request<ReviewStatusResponse>(`${draft(draftId)}/review`, { signal })
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

/**
 * 작품 삭제 (`deleteStory`, backend #290). `204` · 본문 없음.
 *
 * **작성자 본인만이다.** 공식 작품(`authorType = official`)은 작성자가 없어 어떤 요청자와도
 * 일치하지 않으므로 이 경로로 지워지지 않는다 (정정본 §13-58). 상태는 가리지 않는다 —
 * 정지된 작품을 지우는 것은 정지를 푸는 일이 아니라 더 내리는 일이다.
 *
 * **되돌릴 수 없다.** 복구 경로가 계약에 없다 — 사용자에게 '삭제' 라고 말한 이상 되돌리는
 * 문을 함께 두는 쪽이 거짓말이라는 것이 그 결정의 근거다.
 *
 * **화면이 결과를 단정하면 안 되는 자리가 여기다.** 지워지는 것은 목록 · 상세 · 이어하기이고,
 * 세션 · 턴 · GameState 스냅샷 · 엔딩 도달률 · 신고 · 검수 이력은 **남는다** — 그것은
 * 플레이한 사람들과 검수의 기록이지 작성자의 것이 아니다. 진행 중이던 세션은 없어진 작품과
 * 같은 답을 받는다(다음 턴은 `423`, `resume` 은 `storySuspended`). 그래서 확인 문구가
 * "완전히 삭제됩니다" 라고 말하면 계약과 어긋난다 (`screens/account/storyActions.ts`).
 *
 * **이미 지운 작품을 다시 지우면 `404` 다.** 없는 작품 · 남의 작품과 구분하지 않으므로
 * 화면도 구분해 알리지 않는다 (I-8).
 */
export function deleteStory(storyId: string, signal?: AbortSignal): Promise<void> {
  return request<void>(`/stories/${encodeURIComponent(storyId)}`, { method: 'DELETE', signal })
}

/**
 * 정지된 작품의 재검토 요청 (`appealStorySuspension`, backend #290). `202` · 본문 없음.
 *
 * **이 요청은 작품의 상태를 바꾸지 않는다** (I-8, 정정본 §13-59). 정지된 작품은 **이미**
 * 인간 검수 큐에 있다 — 여기서 `reviewStatus` 를 움직이면 작성자가 검수 결과를 되돌리는
 * 길이 된다. 바뀌는 것은 둘이다: **기록**(작성자가 다투었다는 사실과 사유)과 **신호**(검수
 * 큐의 `appealed`). 그래서 화면이 "재검토 중" 으로 상태를 바꿔 그리지 않는다.
 *
 * **순서도 바꾸지 않는다.** 요청은 공짜이므로 앞세우면 줄을 사는 길이 된다.
 *
 * **사유는 필수이고 검수자만 읽는다** (S-11). 응답에도, 검수 큐의 한 줄에도, 다른 사용자가
 * 보는 어떤 화면에도 실리지 않는다 — 그래서 이 함수는 보낸 사유를 돌려주지 않으며 화면도
 * 그것을 다시 그리지 않는다.
 *
 * **정지 건마다 한 번이다.** 답을 받기 전 두 번째 요청은 `409 ALREADY_EXISTS` 이고,
 * 내려가지 않은 작품은 `409 STORY_NOT_SUSPENDED` 다. 남의 작품은 `404` 다. 셋 다 화면이
 * 문구를 짓지 않고 서버의 `message` 를 그대로 낸다 (F-4).
 */
export function appealStorySuspension(
  storyId: string,
  reason: string,
  signal?: AbortSignal,
): Promise<void> {
  const body: AppealRequest = { reason }
  return request<void>(`/stories/${encodeURIComponent(storyId)}/appeal`, {
    method: 'POST',
    body,
    signal,
  })
}
