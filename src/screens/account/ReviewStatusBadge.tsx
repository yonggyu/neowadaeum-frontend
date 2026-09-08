import type { VisibleReviewStatus } from '../../api/endpoints/authoring'
import shared from './account.module.css'
import { REVIEW_STATUS_LABEL, REVIEW_STATUS_TONE, type ReviewTone } from './reviewStatus'

/**
 * 검수 상태 배지 (#135).
 *
 * **컴포넌트가 된 것은 쓰는 곳이 셋이기 때문이다** — 내가 만든 작품 목록의 카드와, 상태
 * 화면의 좌측 목록 · 우측 머리. 상태에서 결로, 결에서 클래스로 가는 두 걸음을 화면마다
 * 적으면 언젠가 한 곳이 빠지고, **빠진 그 한 곳은 뉴트럴 배지로 되돌아간다.** 이 이슈가
 * 고치려던 상태(일곱이 한 판을 나눠 쓰던 것)가 그렇게 한 화면씩 돌아온다.
 *
 * 공개 범위 배지는 여기 오지 않는다 — 그쪽은 색을 갖지 않는 `shared.badge` 그대로다.
 */
export function ReviewStatusBadge({ status }: { status: VisibleReviewStatus }) {
  const classes = [shared.badge, shared.statusBadge, TONE_CLASS[REVIEW_STATUS_TONE[status]]]
  return <span className={classes.join(' ')}>{REVIEW_STATUS_LABEL[status]}</span>
}

/**
 * 결 → 클래스. **여섯을 여기서 한 번만 잇는다.**
 *
 * 값(색 · 점 · 테두리)은 `src/styles/tokens.css` 가 갖고 그리는 규칙은
 * `account.module.css` 가 갖는다. 이 표는 그 둘을 잇기만 한다.
 *
 * 형이 `string | undefined` 인 것은 CSS 모듈의 타입이 그렇기 때문이고, 이름을 잘못 적으면
 * 배지가 조용히 뉴트럴로 돌아간다 — 그 자리는 `reviewStatus.test.ts` 가 여섯 클래스가
 * 실제로 스타일시트에 있는지 보는 것으로 막는다.
 */
const TONE_CLASS: Record<ReviewTone, string | undefined> = {
  draft: shared.statusDraft,
  pending: shared.statusPending,
  inReview: shared.statusInReview,
  approved: shared.statusApproved,
  rejected: shared.statusRejected,
  suspended: shared.statusSuspended,
}
