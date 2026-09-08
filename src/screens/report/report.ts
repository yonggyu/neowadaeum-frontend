import type { ReportReason, ReportRequest, ReportTargetType } from '../../api/endpoints/reports'

/** 상세는 선택이고 200자다 (3c). */
export const DETAIL_MAX_LENGTH = 200

/**
 * 사유 4종 — 계약 `ReportRequest.reason` 의 enum 그대로이고 순서도 5d 와 같다.
 * 라벨만 여기서 붙인다. 서버로 나가는 것은 언제나 enum 값이다.
 */
export const REPORT_REASONS: readonly { value: ReportReason; label: string }[] = [
  { value: 'inappropriate', label: '부적절한 내용' },
  { value: 'ip_violation', label: '저작권 침해' },
  { value: 'real_person', label: '실존 인물' },
  { value: 'other', label: '기타' },
]

/**
 * 신고 대상 하나.
 *
 * `label` · `hint` 가 있는 이유가 5d 다 — **사용자가 무엇을 신고하는지 알 수 있어야 한다.**
 * 장면 하나와 작품은 같은 요청이 아니다.
 *
 * 그 둘이 운영에서 어떻게 다루어지는지는 **화면에 적지 않는다.** 정지가 어떻게 일어나는지
 * 말해 주는 문장은 그대로 임계를 향한 안내가 된다 (S-11 · F-5).
 */
export interface ReportTarget {
  type: ReportTargetType
  /** '이 장면' · '이 작품' */
  label: string
  /** 어느 장면 · 어느 작품인지 (3c 의 부제) */
  hint: string
  /** "같은 ~은 한 번만 신고할 수 있습니다" 의 자리 */
  noun: string
  /** 계약이 대상을 식별하는 필드만 담는다 */
  identity: Pick<ReportRequest, 'targetType' | 'targetId' | 'sessionId' | 'turnNo'>
}

export function storyTarget(storyId: string, title: string): ReportTarget {
  return {
    type: 'story',
    label: '이 작품',
    hint: `${title} · 작품 전체`,
    noun: '작품',
    identity: { targetType: 'story', targetId: storyId },
  }
}

/**
 * 장면 하나.
 *
 * **계약에 턴 식별자가 없다.** `TurnResponse` 도 `HistoryResponse` 도 턴 ID 를 주지 않고 API
 * 어디에서나 턴의 주소는 `(sessionId, turnNo)` 다 — `ReportRequest` 가 그 둘을 선택 필드로
 * 들고 있는 이유로 보인다. 그래서 `targetId` 에 새 형식을 지어내지 않고(`"{sessionId}:{turnNo}"`
 * 같은 것을 만들면 그것이 곧 계약이 된다) 세션 식별자를 그대로 싣고 턴 번호를 함께 보낸다.
 *
 * **백엔드 확인이 필요하다** — `UNIQUE(reporterRef, targetType, targetId)` 가 세션 단위로
 * 걸리면 한 세션에서 장면을 하나밖에 신고할 수 없다. 고칠 자리가 여기 하나로 남아 있다.
 */
export function turnTarget(sessionId: string, turnNo: number, chapterNo: number): ReportTarget {
  return {
    type: 'turn',
    label: '이 장면',
    hint: `Ch.${chapterNo} · T${turnNo} · 이 장면 하나`,
    noun: '장면',
    identity: { targetType: 'turn', targetId: sessionId, sessionId, turnNo },
  }
}

/**
 * 보낼 본문. 계약이 정한 필드만 담는다 (F-2) — 접수 번호도 `alreadyReported` 도 만들지 않는다.
 *
 * 상세는 **비어 있으면 `null`** 이다. 공백만 남은 문자열을 보내면 서버는 "상세가 있는 신고"로
 * 세고, 검수자가 읽을 것은 아무것도 없다.
 */
export function reportRequest(
  target: ReportTarget,
  reason: ReportReason,
  detail: string,
): ReportRequest {
  const trimmed = detail.trim()
  return { ...target.identity, reason, detail: trimmed === '' ? null : trimmed }
}
