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

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: '비공개',
  unlisted: '링크 공개',
  public: '전체 공개',
}
