import { request } from '../client'
import type { components } from '../schema'

/**
 * 플레이 파이프라인이 부르는 계약 경로 셋.
 *
 * 타입을 손으로 적지 않는다 (F-2) — 전부 `schema.d.ts` 의 별칭이다. 화면이
 * `components['schemas'][...]` 를 직접 파고들지 않도록 이름만 여기서 붙인다.
 */
export type Turn = components['schemas']['TurnResponse']
export type Choice = components['schemas']['Choice']
export type Paragraph = components['schemas']['Paragraph']
export type StartSessionResult = components['schemas']['StartSessionResponse']

/**
 * 턴 제출 본문. **필드가 둘뿐이다** (계약 `TurnRequest`).
 *
 * `text` 를 담는 필드가 계약에 없다 — 선택지는 서버가 발급한 `choiceId` 로만 제출한다 (F-1).
 * `turnNo` 는 *지금 화면에 떠 있는 턴*이며 낙관적 잠금 키다 (I-6).
 */
export type TurnRequest = components['schemas']['TurnRequest']

const session = (sessionId: string): string => `/sessions/${encodeURIComponent(sessionId)}`

/** 세션 생성. 턴 1 이 함께 온다 — 시작 직후 별도 턴 요청이 필요 없다. */
export function startSession(
  storyId: string,
  options: { restart?: boolean; signal?: AbortSignal } = {},
): Promise<StartSessionResult> {
  const restart = options.restart === true ? '?restart=true' : ''
  return request<StartSessionResult>(`/stories/${encodeURIComponent(storyId)}/sessions${restart}`, {
    method: 'POST',
    signal: options.signal,
  })
}

/** 마지막 턴 복원. Resume 진입과 409 이후의 화면 교체가 같은 경로를 쓴다. */
export function getCurrentTurn(sessionId: string, signal?: AbortSignal): Promise<Turn> {
  return request<Turn>(`${session(sessionId)}/current`, { signal })
}

/**
 * 다음 턴.
 *
 * `idempotencyKey` 가 **필수 인자다** (F-7). 선택 사항으로 두면 빠뜨린 호출이 조용히 통과하고,
 * 그 대가는 재시도마다 Provider 가 한 번 더 불려 **두 번 청구되는 것**이다 (R6.2).
 * 같은 선택의 재시도는 같은 키를 다시 보내야 하므로 키를 여기서 만들지 않는다 —
 * 호출부가 선택 하나에 키 하나를 만들어 들고 있는다.
 */
export function advanceTurn(
  sessionId: string,
  body: TurnRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<Turn> {
  return request<Turn>(`${session(sessionId)}/turns`, {
    method: 'POST',
    body,
    idempotencyKey,
    signal,
  })
}
