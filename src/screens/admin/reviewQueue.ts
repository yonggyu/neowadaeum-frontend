import type { ReviewQueueItem, ReviewVerdictRequest } from '../../api/endpoints/admin'

/**
 * 검수 큐가 판단하는 것 — 무엇을 보여 주는가, 무엇을 보내는가, 키 하나가 무엇을 하는가.
 *
 * React 밖에 두는 이유는 이 셋이 이 이슈의 보안 면 전체이기 때문이다. 컴포넌트 안에 있으면
 * 렌더링 없이는 확인할 수 없고, 그러면 **"반려 사유는 카테고리를 넘지 않는다" 와 "단축키는
 * 글자를 넣는 자리에서 발동하지 않는다" 를 지키는 것이 코드가 아니라 리뷰어가 된다.**
 * `twoFactor.ts` 가 같은 이유로 같은 자리에 있다.
 */

/** 계약 `ReviewQueueItem.reviewStatus` 의 셋. 손으로 적지 않는다 (F-2). */
export type QueueStatus = ReviewQueueItem['reviewStatus']
export type Verdict = ReviewVerdictRequest['verdict']
export type RejectReason = NonNullable<ReviewVerdictRequest['reasons']>[number]

/** 계약 `ReviewVerdictRequest.note.maxLength`. 서버가 자르기 전에 화면이 막는다. */
export const NOTE_MAX_LENGTH = 500

// ── 큐를 무엇으로 나누는가 ─────────────────────────────────────────────

/**
 * 탭은 **계약의 `reviewStatus` 셋 그대로**다. 화면이 새 축을 만들지 않는다.
 *
 * `3h` 는 상단에 "공개 검수 / 신고 / 정지된 작품 / 처리 이력" 네 탭을 그렸지만, 계약이 주는
 * 큐는 하나다 — 그리고 그 하나가 셋을 이미 구분해 놓았다. 정정본 §13-41 이 *"정지된 작품은
 * 검수 큐에 오른다"* 고 적었고, 계약은 그 이유까지 필드 설명에 적었다: 제출을 기다리는 것과
 * 신고로 내려간 것은 **검수자가 다르게 봐야 하는 일**이라는 것이다. 그래서 신고 큐는 별도
 * 목록이 아니라 이 큐의 `suspended` 다.
 *
 * **"처리 이력" 은 큐의 탭이 아니라 상세의 한 면이다** (#86). 계약이 연 것은 **작품 하나의**
 * 이력(`getReviewHistory`)이고, 화면 전체의 처리 이력 — 최근 판정을 작품과 무관하게 시간순으로
 * — 은 답할 경로가 없다 (정정본 §13-63 이 그 갈래를 열지 않기로 적었다). 그래서 네 번째 탭을
 * 만들지 않고, 지금 보는 작품이 전에 무엇으로 걸렸는지를 상세에서 답한다.
 */
export const QUEUE_TABS: readonly QueueStatus[] = ['in_review', 'suspended', 'approved']

export const QUEUE_TAB_LABEL: Record<QueueStatus, string> = {
  in_review: '검수 대기',
  suspended: '신고 정지',
  approved: '사후 검수',
}

/**
 * 이 탭의 작품이 지금 어떤 상태인가 — 검수자가 판정을 다르게 골라야 하는 이유다.
 *
 * **표본이 왜 뽑혔는지는 적지 않는다.** 계약이 이유를 적었다: 검수 비율을 알면 그 아래로
 * 관리할 수 있다 (백엔드 §13-12, S-11). 여기서 필요한 사실은 *이 작품은 내려가 있지 않다*
 * 하나뿐이고, 그것이 판정을 다르게 만든다.
 */
export const QUEUE_TAB_HINT: Record<QueueStatus, string> = {
  in_review: '아직 아무도 보지 못한 작품이에요. 통과하면 이때 전체 공개가 열려요.',
  suspended: '신고로 내려간 작품이에요. 사람들이 이미 본 작품이고, 지금은 내려가 있어요.',
  approved: '게시된 채로 다시 보는 작품이에요. 내려가 있지 않아요.',
}

/** 큐를 탭으로 가른다. 서버가 준 순서(오래 기다린 것부터)를 흐트러뜨리지 않는다. */
export function itemsInTab(queue: readonly ReviewQueueItem[], tab: QueueStatus): ReviewQueueItem[] {
  return queue.filter((item) => item.reviewStatus === tab)
}

// ── 판정 ───────────────────────────────────────────────────────────────

/**
 * 통과가 무엇을 하는가는 **작품이 어디서 왔는지**가 정한다 (계약 `decideReview`, §13-42).
 *
 * `in_review` 만 `public` 을 새로 연다 — 그 상태로 오는 길이 `public` 제출 하나뿐이기
 * 때문이다. 나머지는 있던 자리 그대로 돌아간다. 세 경우에 "승인" 한 단어를 쓰면 검수자는
 * 신고를 기각하면서 자기가 무언가를 공개했다고 믿게 된다.
 */
export function verdictLabel(tab: QueueStatus, verdict: Verdict): string {
  if (verdict === 'REJECT') {
    return '반려'
  }
  if (verdict === 'HOLD') {
    return '보류'
  }
  switch (tab) {
    case 'in_review':
      return '승인 · 전체 공개'
    case 'suspended':
      return '신고 기각 · 원래 자리로'
    case 'approved':
      return '이상 없음 · 유지'
  }
}

/**
 * 되돌릴 수 없는 판정인가 — 확인을 한 번 물어야 하는가.
 *
 * `HOLD` 만 아니다. 계약이 *"`hold` 는 아무것도 바꾸지 않는다"* 고 적었고, 되돌릴 수 있는
 * 동작 앞에 확인을 두면 확인 자체가 값싸 보이게 된다.
 */
export function needsConfirmation(verdict: Verdict): boolean {
  return verdict !== 'HOLD'
}

/**
 * **반려에는 사유가 있어야 한다.**
 *
 * 계약은 `reasons` 를 선택으로 두지만, 사유 없는 반려는 작성자에게 *반려됐다*만 남긴다 —
 * `3f` 가 작성자에게 보여 주는 상자가 통째로 비게 되고, 그러면 고칠 자리를 알 수 없다.
 * 카테고리만 전달하기로 한 이유가 "덜 말하기" 가 아니라 "이만큼은 말하기" 였다 (R8.7).
 */
export function canDecide(input: {
  verdict: Verdict
  reasons: readonly RejectReason[]
  pending: boolean
}): boolean {
  if (input.pending) {
    return false
  }
  return input.verdict !== 'REJECT' || input.reasons.length > 0
}

/**
 * 반려 사유 — **카테고리만**이다 (백엔드 R8.7).
 *
 * 이 값은 작성자에게 **그대로 전달된다.** 계약이 자유 문자열을 받지 않는 것이 그 보장이고,
 * 화면은 그 보장을 무르지 않는다: 검수자가 문장을 적을 수 있으면 걸린 표현이 그 문장에 실려
 * 작성자에게 가고, 그 문장이 곧 우회 사전이 된다 (S-11).
 *
 * 문구는 분류 이름까지다. 어디가 걸렸는지 · 무엇이 걸렸는지를 적지 않는다.
 */
export const REJECT_REASON_LABEL: Record<RejectReason, string> = {
  MINOR_SEXUAL: '미성년자 성적 묘사',
  REAL_PERSON_HARM: '실존 인물 훼손',
  NON_CONSENSUAL: '비동의 성적 묘사',
  IP_REPLICATION: '기존 작품 복제',
  RATING_EXCEEDED: '연령 등급 초과',
  HATE_SPEECH: '혐오 표현',
  THIRD_PARTY_PERSONAL_DATA: '제3자 개인정보',
}

/**
 * 고를 수 있는 사유 전부.
 *
 * 위의 `Record` 에서 만든다 — 배열을 따로 적으면 계약에 카테고리가 하나 늘었을 때 타입은
 * 통과하는데 **화면에서만 고를 수 없는 사유**가 생긴다. 그 빠짐은 아무 신호도 내지 않는다.
 */
export const REJECT_REASONS = Object.keys(REJECT_REASON_LABEL) as readonly RejectReason[]

/**
 * 보낼 것을 만든다.
 *
 * **`reasons` 는 반려에만 실린다.** 통과·보류에 남아 있던 체크가 함께 나가면 작성자는
 * 승인 통보와 함께 반려 사유를 받는다 — 이 값이 작성자에게 그대로 가기 때문이다.
 *
 * **`note` 는 `reasons` 근처에도 가지 않는다.** 내부 기록이며 작성자에게 가지 않는다고
 * 계약이 적었다. 두 필드가 각자 자기 자리로만 가는 것이 R8.7 의 실제 내용이다.
 */
export function buildVerdict(input: {
  verdict: Verdict
  reasons: readonly RejectReason[]
  note: string
}): ReviewVerdictRequest {
  const body: ReviewVerdictRequest = { verdict: input.verdict }

  if (input.verdict === 'REJECT' && input.reasons.length > 0) {
    body.reasons = [...input.reasons]
  }

  const note = input.note.trim().slice(0, NOTE_MAX_LENGTH)
  if (note.length > 0) {
    body.note = note
  }

  return body
}

// ── 단축키 ─────────────────────────────────────────────────────────────

/** `3h` 가 적은 다섯 — A 승인 / R 반려 / H 보류 / J·K 이동. */
export type QueueShortcut = Verdict | 'next' | 'previous'

/**
 * 키가 눌린 자리. `KeyboardEvent` 를 그대로 받지 않는 이유는 테스트가 node 에서 돌기 때문이
 * 아니라, **이 판단에 필요한 것이 이 넷뿐**이기 때문이다.
 */
export interface KeyStroke {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  altKey?: boolean
  target: TextEntryTarget | null
}

/** DOM 요소가 이 모양을 이미 만족한다 — `tagName` · `isContentEditable` 둘 다 표준 속성이다. */
export interface TextEntryTarget {
  tagName?: string
  isContentEditable?: boolean
}

/**
 * 사람이 지금 글자를 넣고 있는 자리인가.
 *
 * **이 화면에서 가장 위험한 한 줄이다.** 사유 메모를 쓰다 `A` 를 누르면 승인이 나가고,
 * 승인은 되돌릴 수 없다 — 그 순간 남의 원고가 공개된다. `<select>` 도 함께 막는다:
 * 열린 목록에서 글자 키는 항목을 고르는 키다.
 */
export function isTextEntry(target: TextEntryTarget | null): boolean {
  if (target === null) {
    return false
  }
  if (target.isContentEditable === true) {
    return true
  }
  const tag = (target.tagName ?? '').toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * 이 입력이 무엇을 뜻하는가. 아무것도 아니면 `null`.
 *
 * 수식 키가 눌려 있으면 우리 것이 아니다 — `Cmd+R` 은 새로고침이고, 그것을 반려로 읽으면
 * 검수자가 화면을 되살리려다 남의 작품을 내린다.
 */
export function shortcutFor(stroke: KeyStroke): QueueShortcut | null {
  if (stroke.ctrlKey === true || stroke.metaKey === true || stroke.altKey === true) {
    return null
  }
  if (isTextEntry(stroke.target)) {
    return null
  }
  switch (stroke.key.toLowerCase()) {
    case 'a':
      return 'PASS'
    case 'r':
      return 'REJECT'
    case 'h':
      return 'HOLD'
    case 'j':
      return 'next'
    case 'k':
      return 'previous'
    default:
      return null
  }
}

/**
 * J·K 가 옮기는 자리. 끝에서 멈춘다 — 감싸 돌면 한 바퀴 돈 것을 모르고 같은 작품을 두 번
 * 판정하게 된다.
 */
export function moveSelection(count: number, current: number, shortcut: 'next' | 'previous'): number {
  if (count === 0) {
    return 0
  }
  const next = shortcut === 'next' ? current + 1 : current - 1
  return Math.min(Math.max(next, 0), count - 1)
}
