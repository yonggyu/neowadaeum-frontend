import type {
  AutoCheckSummary,
  ManuscriptEnding,
  ReasonCount,
  ReportItem,
  ReviewHistoryEntry,
} from '../../api/endpoints/admin'
import { REPORT_REASONS } from '../report/report'
import { REJECT_REASON_LABEL, type QueueStatus } from './reviewQueue'

/**
 * 검수 상세 패널이 판단하는 것 — 어떤 면을 열 수 있는가, 계약의 값이 무엇이라 읽히는가.
 *
 * React 밖에 두는 이유는 `reviewQueue.ts` 와 같다. 이 파일이 지키는 것은 셋이다.
 *
 * 1. **감사가 걸린 문을 언제 여는가.** 원고와 신고는 부르는 것만으로 기록이 남는다
 *    (backend R12.3 · R14.5). 어떤 패널이 어떤 상태에서 열리는지가 곧 *어떤 작품이 열람
 *    기록에 남는가*이고, 그 판단이 컴포넌트 안에 있으면 렌더링 없이는 확인되지 않는다.
 * 2. **없는 것을 채우지 않는다.** 신고자 · 신고자의 자유 문장 · `player_ref` 는 계약에
 *    없다 (backend I-3, 정정본 §13-62). 여기에 그 자리를 만들지 않는 것이 보장이다.
 * 3. **사유는 카테고리 이름까지다** (R8.7, S-11). 어디가 왜 걸렸는지를 문구가 덧붙이지
 *    않는다 — 덧붙이는 순간 그 문구가 우회 사전이 된다.
 */

// ── 상세의 세 면 ───────────────────────────────────────────────────────

/**
 * `3h` 의 우측 패널이 답하는 세 가지 — 무엇이 쓰였나 · 무엇이 신고됐나 · 전에 무엇이었나.
 *
 * **한 화면 안의 면이지 별도 화면이 아니다.** `3h` 가 신고 큐를 "동일 레이아웃"이라고
 * 적었고 정정본 §13-41 이 같은 큐에 올린다 — 목록도 판정도 하나다.
 */
export type DetailPanel = 'manuscript' | 'reports' | 'history'

export const DETAIL_PANEL_LABEL: Record<DetailPanel, string> = {
  manuscript: '원고',
  reports: '신고',
  history: '지난 판정',
}

/** 상세를 열면 원고가 먼저다 — 판정의 대상이 그것이고, 나머지 둘은 그 판정의 재료다. */
export const DEFAULT_DETAIL_PANEL: DetailPanel = 'manuscript'

/**
 * 이 작품에서 열 수 있는 면.
 *
 * **신고는 `suspended` 에서만 연다.** 임계에 닿아 내려간 작품이 곧 신고가 쌓인 작품이고
 * (정정본 §13-41, R8.9), 그 갈래에서만 *무엇이 몇 건인가*가 판정의 재료다. 세 탭 모두에
 * 열어 두면 신고가 한 건도 없는 작품들까지 `listStoryReports` 를 부르게 되고, 그 호출은
 * 아무것도 답하지 못한 채 감사 기록만 남긴다 (R14.5).
 *
 * **지난 판정은 어디서나 연다.** 감사를 남기지 않으며(§13-63), *전에 무엇으로 걸렸던
 * 작품인가*는 세 갈래 모두에서 이번 판정에 직접 쓰인다.
 */
export function panelsFor(status: QueueStatus): readonly DetailPanel[] {
  return status === 'suspended'
    ? ['manuscript', 'reports', 'history']
    : ['manuscript', 'history']
}

/** 탭을 옮겼는데 그 면이 이 작품에 없으면 기본으로 돌린다 — 빈 패널을 열어 두지 않는다. */
export function panelInStatus(panel: DetailPanel, status: QueueStatus): DetailPanel {
  return panelsFor(status).includes(panel) ? panel : DEFAULT_DETAIL_PANEL
}

// ── 원고 ───────────────────────────────────────────────────────────────

/**
 * 작성자 자리에 무엇을 적는가 — **표시명 하나뿐이다** (F-6, backend I-3).
 *
 * 계약이 `null` 을 주는 이유를 그대로 적었다: *"설정하지 않은 작성자는 `null` 이다 — 서버가
 * 이름을 지어내지 않는다."* 화면도 지어내지 않는다. 식별자를 대신 넣는 것은 더 나쁘다 —
 * 그 값이 `player_ref` 이고, 그것이 화면에 뜨는 순간 F-6 이 깨진다.
 */
export function authorLabel(authorDisplayName: string | null): string {
  return authorDisplayName ?? '표시명 없음'
}

/**
 * 엔딩에 붙는 표식. 계약의 boolean 둘을 그대로 읽는다.
 *
 * 조건식은 담기지 않는다 — 계약이 *"판정 로직이지 사람이 읽는 문장이 아니다"* 로 뺐다.
 * 그래서 화면도 "어떤 조건에서 열리는가" 를 추측해 적지 않는다.
 */
export function endingBadges(ending: ManuscriptEnding): readonly string[] {
  const badges: string[] = []
  if (ending.secret) {
    badges.push('숨은 엔딩')
  }
  if (ending.defaultEnding) {
    badges.push('기본 엔딩')
  }
  return badges
}

/**
 * 자동 검수 판정. **`hold` 는 "사람이 봐야 한다" 는 표식이다** (정정본 §13-42) — 그것을
 * "보류"로만 적으면 검수자는 기계가 이미 판단을 끝냈다고 읽는다.
 */
export const AUTO_CHECK_VERDICT_LABEL: Record<AutoCheckSummary['verdict'], string> = {
  pass: '자동 검수 통과',
  reject: '자동 검수 반려',
  hold: '사람이 봐야 함',
}

// ── 신고 ───────────────────────────────────────────────────────────────

type ReportReason = ReasonCount['reason']

/**
 * 신고 사유 라벨 — **신고 화면(`5d`)과 같은 문구**를 쓴다.
 *
 * 여기서 새로 짓지 않는 이유는 마크업이 닮아서가 아니라 **같은 enum 의 같은 뜻**이기
 * 때문이다. 따로 적으면 이용자가 고른 항목의 이름과 검수자가 읽는 이름이 갈라지고,
 * 그 어긋남은 "무엇이 신고됐는가" 를 답해야 하는 자리에서 나타난다.
 */
export const REPORT_REASON_LABEL: Record<ReportReason, string> = Object.fromEntries(
  REPORT_REASONS.map((reason) => [reason.value, reason.label]),
) as Record<ReportReason, string>

const REPORT_REASON_ORDER: readonly ReportReason[] = REPORT_REASONS.map((reason) => reason.value)

/**
 * 집계를 그리는 순서 — 많은 것부터, 같으면 `5d` 의 순서대로.
 *
 * **합계를 만들지 않는다.** 계약이 `count` 를 *"이 사유로 신고한 **사람 수**"* 로 정의했고,
 * 한 사람이 두 사유로 신고했으면 그 사람은 두 줄에 각각 한 번씩 세어진다 — 더한 값은
 * *신고한 사람 수*가 아니다. 화면이 그것을 "총 N 명" 이라고 적으면 서버가 하지 않은 말이
 * 되고, 그 숫자는 정지 임계와도 다르다.
 *
 * **없는 사유를 0 으로 채우지도 않는다.** 계약이 준 것만 그린다.
 */
export function reasonCountsForDisplay(counts: readonly ReasonCount[]): ReasonCount[] {
  return [...counts].sort(
    (left, right) =>
      right.count - left.count ||
      REPORT_REASON_ORDER.indexOf(left.reason) - REPORT_REASON_ORDER.indexOf(right.reason),
  )
}

/** 개별 신고의 처리 상태. 계약 `ReportItem.status` 의 넷 그대로다. */
export const REPORT_STATUS_LABEL: Record<ReportItem['status'], string> = {
  open: '접수됨',
  reviewing: '확인 중',
  actioned: '조치됨',
  dismissed: '기각됨',
}

/**
 * 개별 신고의 대상 턴.
 *
 * **`null` 이 정상이다** — 계약이 *"작품 신고에는 없으므로 `null` 이 정상이다"* 라고 적었고,
 * 지금 이 경로에 오는 것은 작품 신고뿐이다 (정정본 §13-62). 그러므로 "턴 정보 없음" 을
 * 결함처럼 적지 않는다. 키 존재 여부로 분기하지도 않는다 — 계약이 키를 생략하지 않는다.
 */
export function reportTargetLabel(turnNo: number | null): string {
  return turnNo === null ? '작품 전체' : `${turnNo}번째 장면`
}

// ── 지난 판정 ──────────────────────────────────────────────────────────

type HistoryReason = ReviewHistoryEntry['reasons'][number]

/**
 * **자동과 사람을 섞지 않는다** (R8.6, §13-63). 자동 통과는 사람이 본 것이 아니며, 그
 * 구분이 없으면 화면은 아무도 보지 않은 작품을 승인된 작품으로 적는다.
 */
export const HISTORY_STAGE_LABEL: Record<ReviewHistoryEntry['stage'], string> = {
  auto: '자동',
  human: '사람',
}

/** `hold` 는 아무것도 바꾸지 않았다 — 봤고 판단을 미뤘다는 기록이다 (계약). */
export const HISTORY_VERDICT_LABEL: Record<ReviewHistoryEntry['verdict'], string> = {
  pass: '통과',
  reject: '반려',
  hold: '보류',
}

/**
 * 이력의 사유 — **판정 화면과 같은 카테고리**다. 계약의 표기만 소문자로 다르다.
 *
 * 문구를 다시 적지 않고 `REJECT_REASON_LABEL` 을 가리킨다. 두 곳에 적으면 카테고리 하나의
 * 이름이 화면에 따라 달라지고, 그러면 검수자는 지난 반려와 지금 고르는 사유가 같은 것인지
 * 알 수 없다. 두 `Record` 가 모두 완전해야 하므로 계약에 카테고리가 늘면 **양쪽 다** 타입이
 * 막는다 — 한쪽만 조용히 빠지지 않는다.
 */
export const HISTORY_REASON_LABEL: Record<HistoryReason, string> = {
  minor_sexual: REJECT_REASON_LABEL.MINOR_SEXUAL,
  real_person_harm: REJECT_REASON_LABEL.REAL_PERSON_HARM,
  non_consensual: REJECT_REASON_LABEL.NON_CONSENSUAL,
  ip_replication: REJECT_REASON_LABEL.IP_REPLICATION,
  rating_exceeded: REJECT_REASON_LABEL.RATING_EXCEEDED,
  hate_speech: REJECT_REASON_LABEL.HATE_SPEECH,
  third_party_personal_data: REJECT_REASON_LABEL.THIRD_PARTY_PERSONAL_DATA,
}

/**
 * 이력 한 줄에 `note` 를 그리는가.
 *
 * **관리자 화면에서만 그린다** (R8.7 · S-11, §13-63). 이 값을 담는 응답은 이 경로 하나이며,
 * 작성자가 보는 검수 상태(`MyStoryReviewScreen`)는 카테고리만 받는다 — 두 화면이 같은
 * 데이터를 쓰지 않는 것이 그 보장이다. 자동 판정에는 사람이 없어 `null` 이다.
 */
export function hasNote(entry: ReviewHistoryEntry): boolean {
  return entry.note !== null && entry.note.trim().length > 0
}
