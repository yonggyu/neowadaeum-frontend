import type { components } from '../../api/schema'

type ReviewStatus = components['schemas']['ReviewStatus']
type Visibility = components['schemas']['Visibility']

/**
 * 내가 만든 작품의 배지 (와이어프레임 3g — `reviewStatus` 7종).
 *
 * `auto_rejected` 를 **`rejected` 와 같은 문구로** 낸다. 계약이 *"내부 기록이며 사용자에게는
 * `rejected` 로 표시한다"* 고 적었다 — 자동인지 사람인지를 알리면 어디까지가 기계 판정인지
 * 드러나고, 그것은 세이프티를 우회하는 실마리가 된다 (F-5 와 같은 이유).
 */
export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: '작성 중',
  pending: '접수됨',
  auto_rejected: '반려',
  in_review: '검수 중',
  approved: '공개 중',
  rejected: '반려',
  suspended: '정지됨',
}

/** 화면 문구는 **"링크 공유"** 다 (3f · 6c). 계약의 값 이름(`unlisted`)을 그대로 쓰지 않는다. */
export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: '비공개',
  unlisted: '링크 공유',
  public: '전체 공개',
}

/** 각 범위가 무엇을 뜻하는지 — 3f "누구에게 보여줄까요?" 의 세 줄 그대로. */
export const VISIBILITY_HINT: Record<Visibility, string> = {
  private: '나만 플레이 · 검수 없음 · 즉시 사용',
  unlisted: '링크를 가진 사람만 · 자동 검수만 통과하면 즉시',
  public: 'Library 커뮤니티 섹션에 노출 · 운영자 검토 필요',
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

export function reviewPhase(status: ReviewStatus): ReviewPhase {
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
export function isVisibilityReadOnly(status: ReviewStatus): boolean {
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
