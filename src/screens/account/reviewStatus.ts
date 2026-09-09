import type { VisibleReviewStatus } from '../../api/endpoints/authoring'
import type { components } from '../../api/schema'

type Visibility = components['schemas']['Visibility']

/**
 * 내가 만든 작품의 배지 (와이어프레임 3g — 화면에 오는 `reviewStatus` 7종).
 *
 * **`deleted` 는 여기 없다.** 계약이 그 값을 어떤 응답에도 싣지 않으므로 화면에 올 수 없고,
 * 라벨을 두면 절대 그려지지 않는 문구가 하나 생긴다 (§13-58 — `VisibleReviewStatus`).
 *
 * `auto_rejected` 를 **`rejected` 와 같은 문구로** 낸다. 계약이 *"내부 기록이며 사용자에게는
 * `rejected` 로 표시한다"* 고 적었다 — 자동인지 사람인지를 알리면 어디까지가 기계 판정인지
 * 드러나고, 그것은 세이프티를 우회하는 실마리가 된다 (F-5 와 같은 이유).
 */
export const REVIEW_STATUS_LABEL: Record<VisibleReviewStatus, string> = {
  draft: '작성 중',
  pending: '접수됨',
  auto_rejected: '반려',
  in_review: '검수 중',
  approved: '공개 중',
  rejected: '반려',
  suspended: '정지됨',
}

/**
 * 배지가 갖는 결 — **여섯이다** (#135).
 *
 * `REVIEW_STATUS_LABEL` 이 일곱 값에 여섯 문구를 내는 것과 같은 접힘이다. 라벨이 같은 두
 * 상태가 서로 다른 색을 가지면 화면이 *자동인지 사람인지*를 색으로 말하게 되고, 그것은
 * 문구로 말하지 않기로 한 것을 옆문으로 내보내는 일이다 (F-5).
 *
 * **`reviewPhase` 를 쓰지 않는 이유** — 그쪽은 다섯이다. `pending` 과 `in_review` 를 한
 * 칸(`waiting`)으로 접는데, 그 접힘은 *우측 패널이 같은 것을 그린다*는 뜻이지 *같아 보여도
 * 된다*는 뜻이 아니다. 배지에서 둘은 갈려야 한다: 접수됨은 아직 아무 일도 일어나지 않은
 * 것이고 검수 중은 사람이 보고 있는 것이다. 두 물음이 다르므로 표도 둘이다.
 */
export type ReviewTone = 'draft' | 'pending' | 'inReview' | 'approved' | 'rejected' | 'suspended'

export const REVIEW_STATUS_TONE: Record<VisibleReviewStatus, ReviewTone> = {
  draft: 'draft',
  pending: 'pending',
  auto_rejected: 'rejected',
  in_review: 'inReview',
  approved: 'approved',
  rejected: 'rejected',
  suspended: 'suspended',
}

/** 화면 문구는 **"링크 공유"** 다 (3f · 6c). 계약의 값 이름(`unlisted`)을 그대로 쓰지 않는다. */
export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: '비공개',
  unlisted: '링크 공유',
  public: '전체 공개',
}

/**
 * **이미 발행된 작품**의 범위를 바꿀 때 각 범위가 뜻하는 것 (`6c`).
 *
 * **§13-83 이 여기 걸리지 않는다.** 그 절이 바꾼 것은 *제출*(`submitDraft`)이고, 승격은
 * `changeStoryVisibility` 가 **`unlisted → public` 만** 재검수를 걸며 이미지를 말하지 않는다.
 * 즉 이 세 줄은 지금도 참이다 — `#178` 이 고친 것은 아래 제출 쪽이다.
 *
 * **한 상수를 두 화면이 나눠 쓰던 것이 그 결함의 뿌리였다.** 이름을 갈라 두면 다음 사람이
 * 제출 화면에서 이것을 집어 들지 않는다.
 */
export const VISIBILITY_CHANGE_HINT: Record<Visibility, string> = {
  private: '나만 플레이 · 검수 없음 · 즉시 사용',
  unlisted: '링크를 가진 사람만 · 자동 검수만 통과하면 즉시',
  public: 'Library 커뮤니티 섹션에 노출 · 운영자 검토 필요',
}

/**
 * **제출**이 인간 검수를 지나는가 (§13-83).
 *
 * `triggersHumanReview` 의 제출 쪽 짝이며, 계약의 문장이 그대로 조건이다 — *"이미지를 실은
 * 제출은 `visibility` 와 무관하게 `in_review` 로 접수되고, 사람이 통과시킬 때 작성자가 요청한
 * `visibility` 로 열린다."* 자동 검수는 **문자열만 보므로** 커버와 초상을 판정할 수 있는
 * 주체가 사람뿐이다.
 *
 * `public` 은 이미지와 무관하게 사람을 지난다 (R8.6) — 그것은 §13-83 이 바꾼 것이 아니다.
 */
export function submissionEntersReview(visibility: Visibility, carriesImage: boolean): boolean {
  return carriesImage || visibility === 'public'
}

/** 제출 전 안내 — `3f` 의 세 줄. 이미지를 올리지 않은 원고에는 그대로다. */
const SUBMIT_HINT: Record<Visibility, string> = {
  private: '나만 플레이 · 검수 없음 · 즉시 사용',
  unlisted: '링크를 가진 사람만 · 자동 검수만 통과하면 즉시',
  public: 'Library 커뮤니티 섹션에 노출 · 운영자 검토 필요',
}

/**
 * 이미지를 실은 원고의 안내.
 *
 * **`public` 은 위와 같다.** 그 줄은 이미 사람을 말하고 있고, 이미지가 그것을 바꾸지 않는다 —
 * 여기서 문장을 다시 지으면 같은 사실을 두 문구가 말하게 된다.
 */
const SUBMIT_HINT_WITH_IMAGE: Record<Visibility, string> = {
  private: '나만 플레이 · 이미지가 있어 검수를 거쳐요',
  unlisted: '링크를 가진 사람만 · 이미지가 있어 검수를 거쳐요',
  public: SUBMIT_HINT.public,
}

/**
 * 누르기 **전에** 하는 고지 (#178).
 *
 * **`F-4` 의 문제가 아니다.** 그것이 막는 것은 *서버가 준 오류*를 프론트가 제 문장으로 바꾸는
 * 일이고, 여기 있는 것은 누르기 전의 안내다 — `triggersHumanReview` 가 승격에 대해 하는 것과
 * 같은 종류이며, 그 주석의 문장이 여기서도 그대로 참이다: **누르고 나서 목록에서 사라진 것을
 * 발견하게 두면 그것은 고지가 아니다.**
 *
 * **화면이 아는 사실로만 말한다.** 이미지를 올렸는지는 마법사가 들고 있는 값이고 추측이 아니다
 * (`carriesImage`). 정적으로 *"이미지가 있으면"* 이라고만 적으면 **이미지를 올리지 않은
 * 작성자에게 자기와 무관한 조건을 읽히게 되고**, 그 사람에게 `private` 은 정말로 즉시다.
 */
export function submitVisibilityHint(visibility: Visibility, carriesImage: boolean): string {
  return carriesImage ? SUBMIT_HINT_WITH_IMAGE[visibility] : SUBMIT_HINT[visibility]
}

/** 고르는 순서도 3f 그대로 — 좁은 것에서 넓은 것으로. */
export const VISIBILITY_OPTIONS: readonly Visibility[] = ['private', 'unlisted', 'public']

/**
 * 우측 패널이 갈리는 갈래 — `3f` 가 그린 **넷**과, 아직 제출하지 않은 `draft`.
 *
 * `auto_rejected` 와 `rejected` 가 같은 칸으로 접히는 것이 이 함수의 존재 이유다 — 두 값을
 * 화면 여러 곳에서 각각 비교하면 언젠가 한 곳이 빠지고, 그 한 곳이 "자동 반려"라고 말한다.
 */
export type ReviewPhase = 'draft' | 'waiting' | 'approved' | 'rejected' | 'suspended'

export function reviewPhase(status: VisibleReviewStatus): ReviewPhase {
  switch (status) {
    case 'draft':
      return 'draft'
    case 'pending':
    case 'in_review':
      return 'waiting'
    case 'approved':
      return 'approved'
    case 'auto_rejected':
    case 'rejected':
      return 'rejected'
    case 'suspended':
      return 'suspended'
  }
}

/**
 * 공개 범위 컨트롤을 읽기 전용으로 둘 것인가 — **정지 상태에서 그렇다** (6c 의 "주의").
 *
 * 정지는 신고로 내려간 것이고, 그 상태에서 작성자가 범위를 바꿀 수 있으면 정지가 정지가
 * 아니게 된다. 계약도 정지를 `review_status` 로만 다루며 `visibility` 는 건드리지 않는다.
 */
export function isVisibilityReadOnly(status: VisibleReviewStatus): boolean {
  return reviewPhase(status) === 'suspended'
}

/**
 * 이 변경이 **인간 재검수를 트리거하는가.**
 *
 * 계약: *"`unlisted → public` 승격은 재검수를 강제 트리거한다. 자동 검수만 받은 작품이 공개
 * 섹션에 올라오는 경로를 막는다."* 화면은 누르기 **전에** 그 사실을 말해야 한다 — 누르고 나서
 * 목록에서 사라진 것을 발견하게 두면 그것은 고지가 아니다.
 */
export function triggersHumanReview(current: Visibility, target: Visibility): boolean {
  return target === 'public' && current !== 'public'
}

/**
 * 고를 수 없는 선택지와 그 이유.
 *
 * `private → public` 은 **이 오퍼레이션의 경로가 아니다** (정정본 §13-48) — 아무에게도 보인
 * 적 없는 작품을 공개하는 것은 승격이 아니라 제출이고, 그 길은 `submitDraft` 에 있다. 서버가
 * 거절할 것을 알면서 누를 수 있게 두지 않고, 두 단계로 가는 길을 말한다. `unlisted` 는 인간
 * 검수를 요구하지 않으므로 (R8.6) 그 두 단계가 우회가 아니다.
 */
export function visibilityBlockedReason(current: Visibility, target: Visibility): string | null {
  if (target === 'public' && current === 'private') {
    return '비공개 작품은 링크 공유를 거친 뒤 전체 공개를 신청합니다.'
  }
  return null
}

/**
 * 되돌릴 수 없는 쪽인가 — 확인을 물어야 하는가.
 *
 * 노출을 **좁히는** 변경이 그렇다 (전체 공개 → 링크 공유 · 비공개). 3f 의 "공개 중지"가 이
 * 자리다. 다시 넓히려면 검수를 처음부터 다시 받아야 하므로 한 번의 오클릭으로 며칠을 잃는다.
 */
export function narrowsExposure(current: Visibility, target: Visibility): boolean {
  return EXPOSURE_RANK[target] < EXPOSURE_RANK[current]
}

const EXPOSURE_RANK: Record<Visibility, number> = { private: 0, unlisted: 1, public: 2 }
