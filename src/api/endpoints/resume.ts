import { request } from '../client'
import type { components } from '../schema'

/**
 * 이어하기 요약과 지난 기록 — 화면 2e · 4b 가 쓰는 둘.
 *
 * 세션의 나머지(생성 · `GET /current` · 턴)는 플레이 슬라이스의 것이다. 같은 `/sessions`
 * 아래라는 이유로 한 파일에 모으지 않는다 — 두 슬라이스가 같은 파일에서 만난다.
 */
export type ResumeResponse = components['schemas']['ResumeResponse']
export type SessionState = components['schemas']['SessionState']
export type HistoryResponse = components['schemas']['HistoryResponse']
export type HistoryItem = components['schemas']['HistoryItem']
export type Paragraph = components['schemas']['Paragraph']

/**
 * Resume 요약 (`getResume`).
 *
 * `sessionState` 는 **서버가 판정한 결과 하나**다. 여러 조건이 겹칠 때 무엇을 돌려줄지는
 * 서버의 고정 순서가 정한다 — `deleted → expired → story_suspended → version_changed → valid`
 * (백엔드 §13-26). 프론트가 다시 판정하지 않는다. 화면은 받은 값 하나를 그린다.
 */
export function getResume(sessionId: string, signal?: AbortSignal): Promise<ResumeResponse> {
  return request<ResumeResponse>(`/sessions/${encodeURIComponent(sessionId)}/resume`, { signal })
}

/**
 * 지난 이야기 (`getHistory`).
 *
 * **역순(최신→과거) 커서**다. 화면이 "위로 스크롤해 더 읽기"이므로 이 방향이 맞다.
 * `HistoryItem` 에 **`choiceId` 가 없다** — 읽기 전용이고 과거 선택지는 다시 제출될 수 없다 (I-1).
 */
export function getHistory(
  sessionId: string,
  page: { cursor?: string | null; signal?: AbortSignal } = {},
): Promise<HistoryResponse> {
  const search =
    page.cursor == null || page.cursor === ''
      ? ''
      : `?${new URLSearchParams({ cursor: page.cursor }).toString()}`
  return request<HistoryResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/history${search}`,
    { signal: page.signal },
  )
}
