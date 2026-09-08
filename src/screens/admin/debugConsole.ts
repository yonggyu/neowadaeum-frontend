import type { AdminSessionDebug, FreeInputRequest } from '../../api/endpoints/admin'

/**
 * Debug 콘솔(`1j`)이 판단하는 것 — 무엇을 처음부터 보여 주는가, 무엇에 확인을 두는가,
 * 계약이 주지 않은 값을 어떻게 말하는가.
 *
 * React 밖에 두는 이유는 `twoFactor.ts` · `reviewQueue.ts` 와 같다. 이 셋이 이 화면의 보안
 * 면 전체이고, 컴포넌트 안에 있으면 렌더링 없이는 확인할 수 없다 — 그러면 **"프롬프트
 * 원문은 접힌 채로 열린다" 와 "되돌릴 수 없는 동작 앞에 확인이 있다" 를 지키는 것이 코드가
 * 아니라 리뷰어가 된다.**
 */

type DebugSession = AdminSessionDebug['session']
export type DebugTurn = DebugSession['recentTurns'][number]
export type AiCall = AdminSessionDebug['aiCalls'][number]

// ── 우측 패널 다섯 ─────────────────────────────────────────────────────

/**
 * `1j` 가 이름까지 적은 다섯 — *"1024px 이하에서는 우측 패널을 탭(State / Summary / Turns /
 * Prompt / Response)으로 접는다."*
 *
 * **검수 큐(`3h`)는 탭으로 접지 않았다** (#68). 그쪽은 목록과 상세라 대등하지 않다 —
 * 목록에서 고르면 상세가 열리는 관계이고, 탭으로 가르면 고를 때마다 탭을 손으로 바꿔야 해서
 * `J`·`K` 가 쓸모를 잃는다. 여기는 **대등한 사실 다섯**이다. 어느 하나가 다른 하나를 열지
 * 않고, 한 번에 하나만 봐도 나머지가 흐려지지 않는다. 그래서 탭이 맞는다.
 */
export type DebugPanel = 'state' | 'summary' | 'turns' | 'prompt' | 'response'

export const DEBUG_PANELS: readonly DebugPanel[] = [
  'state',
  'summary',
  'turns',
  'prompt',
  'response',
]

export const DEBUG_PANEL_LABEL: Record<DebugPanel, string> = {
  state: 'State',
  summary: 'Summary',
  turns: 'Turns',
  prompt: 'Prompt',
  response: 'Response',
}

/**
 * 화면을 열었을 때 서 있는 탭. **`prompt` 가 아니다.**
 *
 * 1024 이하에서 탭 하나가 곧 보이는 전부이므로, 기본 탭을 프롬프트로 두면 아래의
 * `PROMPT_STARTS_OPEN` 을 우회해 원문이 첫 화면이 된다.
 */
export const DEFAULT_PANEL: DebugPanel = 'state'

/**
 * **프롬프트 원문은 접힌 채로 열린다** (`1j` — "AI PROMPT (collapsible · raw)").
 *
 * 프롬프트에는 세이프티 지시가 들어 있다. 콘솔을 여는 것만으로 그것이 화면에 뜨면 어깨너머로
 * 읽히고, **읽힌 지시가 곧 우회 경로가 된다** (S-11). 펼치는 것은 언제나 사람의 행동이어야
 * 하고, 그 행동이 없었다면 원문은 화면에 없다.
 *
 * 상수로 두는 이유는 이것이 화면의 초기값이 아니라 **규칙**이기 때문이다 — 컴포넌트의
 * `useState(false)` 는 다음 사람이 바꿔도 아무 신호를 내지 않는다.
 */
export const PROMPT_STARTS_OPEN = false

// ── 세션이 지금 어디에 있는가 ──────────────────────────────────────────

/**
 * 화면에 떠 있는 턴.
 *
 * **배열 순서를 믿지 않는다.** 계약은 `aiCalls` 에만 *"최신이 앞이다"* 를 적었고
 * `recentTurns` 의 순서는 말하지 않았다. 순서를 가정하면 서버가 정렬을 바꾸는 날 콘솔이
 * 조용히 **다른 턴의 본문**을 현재 턴이라고 그린다. `session.turnNo` 가 *"지금 화면에 떠
 * 있는 턴"* 이라고 계약이 적었으니 그것으로 찾는다.
 */
export function currentTurn(session: DebugSession): DebugTurn | null {
  return session.recentTurns.find((turn) => turn.turnNo === session.turnNo) ?? null
}

/** 최근 턴 — 최신이 위로 오게 세운다. 서버가 준 것을 버리지 않고 순서만 정한다. */
export function turnsNewestFirst(session: DebugSession): DebugTurn[] {
  return [...session.recentTurns].sort((a, b) => b.turnNo - a.turnNo)
}

// ── 관리자 동작 셋 ─────────────────────────────────────────────────────

/** `1j` 의 버튼 셋 — SUBMIT TURN / REGENERATE / ROLLBACK. */
export type DebugAction = 'submit' | 'regenerate' | 'rollback'

/**
 * 확인을 한 번 물어야 하는가.
 *
 * **되돌리기와 재생성만이다.** 롤백은 턴 · 스냅샷 · 요약을 함께 접고(R14.4), 재생성은 접은
 * 뒤 AI 를 다시 불러 본문을 갈아 끼운다 (정정본 §13-30) — 둘 다 이 화면에서 되돌릴 방법이
 * 없다. 자유입력은 턴을 **덧붙일** 뿐이라 롤백으로 되돌아간다. 검수 큐가 `HOLD` 앞에 확인을
 * 두지 않은 것과 같은 판단이다: 되돌릴 수 있는 동작 앞에 확인을 두면 확인 자체가 값싸 보인다.
 */
export function needsConfirmation(action: DebugAction): boolean {
  return action !== 'submit'
}

/**
 * 확인 판의 문구. **`ConfirmDialog`(#43·#63)가 그대로 받는다.**
 *
 * 두 번째 확인 판을 만들지 않는다 — 그 컴포넌트가 이미 되돌릴 수 없는 동작 앞의 판 하나로
 * 정해져 있고, 여기 새로 그리면 같은 사건에 두 모양이 생긴다.
 */
export const CONFIRM_COPY: Record<'regenerate' | 'rollback', {
  title: string
  confirmLabel: string
  pendingLabel: string
}> = {
  regenerate: {
    title: '이 턴을 다시 만들까요?',
    confirmLabel: 'REGENERATE',
    pendingLabel: '다시 만드는 중…',
  },
  rollback: {
    title: '이 세션을 되돌릴까요?',
    confirmLabel: 'ROLLBACK',
    pendingLabel: '되돌리는 중…',
  },
}

// ── ROLLBACK 의 목적지 ─────────────────────────────────────────────────

/**
 * `toTurnNo` — 되돌린 뒤 **남아 있을** 턴이다 (계약 `RollbackRequest`).
 *
 * `0` 은 첫 턴까지 접는다는 뜻이며 계약이 허용한다(`minimum: 0`). 현재 턴보다 큰 값은 되돌릴
 * 곳이 아니므로 여기서 막는다 — 서버도 막지만, 그 `400` 은 관리자가 오타를 냈다는 것을
 * 알려 주지 않는다.
 *
 * **읽을 수 없는 값에 기본값을 씌우지 않는다.** 빈 칸을 `0` 으로 읽으면 손이 미끄러진 채
 * 누른 ROLLBACK 이 세션을 첫 턴까지 접는다.
 */
export function rollbackTarget(raw: string, currentTurnNo: number): number | null {
  const text = raw.trim()
  if (!/^\d+$/.test(text)) {
    return null
  }
  const value = Number(text)
  return value <= currentTurnNo ? value : null
}

// ── FREE ACTION INPUT — 관리자 전용 ────────────────────────────────────

/**
 * 계약 `FreeInputRequest.action.maxLength`. 손으로 정한 값이 아니다.
 *
 * 서버가 자르기 전에 화면이 막는다 — 계약이 길이를 제한한 이유가 *"길어질수록 프롬프트에서
 * 차지하는 몫이 커져 세계관과 최근 턴을 밀어낸다"* 이고, 잘린 문장으로 만들어진 턴은 관리자가
 * 재현하려던 것이 아니다.
 */
export const FREE_ACTION_MAX_LENGTH = 200

/**
 * 지금 자유 행동을 보낼 수 있는가.
 *
 * **`testSession` 이 아니면 보내지 않는다** (계약 I-18, R14.3). 사용자 소유 세션에서 이
 * 경로는 `403` 이며, 그런 세션에 대해 관리자가 할 수 있는 것은 읽기 전용 디버그까지다 —
 * *남의 이야기에 관리자가 문장을 넣는 것은 디버그가 아니라 개입이다.* 서버가 막는 것을 화면이
 * 한 번 더 막는 이유는 그 문장이 **이미 남의 세션을 향해 떠난 뒤**에 거절당하기 때문이다.
 *
 * **이 판단은 이 화면 밖으로 나가지 않는다.** 일반 Play 에 자유입력이 없는 것은 계약이 정한
 * 것이다 — 사용자 입력면은 `choiceId` 하나뿐이다 (F-1).
 */
export function canSubmitFreeAction(input: {
  action: string
  testSession: boolean
  pending: boolean
}): boolean {
  if (input.pending || !input.testSession) {
    return false
  }
  const action = input.action.trim()
  return action.length > 0 && action.length <= FREE_ACTION_MAX_LENGTH
}

/** 보낼 것을 만든다. 계약이 받는 필드는 `action` 하나다. */
export function buildFreeInput(action: string): FreeInputRequest {
  return { action: action.trim() }
}

// ── USAGE — 없는 값을 지어내지 않는다 ──────────────────────────────────

/** 계약이 `null` 을 줄 수 있다고 적은 자리. 0 으로도 `-` 로도 바꾸지 않고 없다고 적는다. */
const ABSENT = '없음'

/** 수치 하나 — Provider 가 usage 를 주지 않으면 `null` 이다 (계약 `AdminAiCall`). */
export function formatTokens(count: number | null | undefined): string {
  return typeof count === 'number' ? count.toLocaleString('ko-KR') : ABSENT
}

/**
 * `latencyMs` 는 **호출 하나**의 시간이다 (계약). 턴 전체의 지연이 아니다 — 합쳐 보이면
 * 관리자가 사용자가 겪은 대기 시간으로 읽는다.
 */
export function formatLatency(latencyMs: number | null | undefined): string {
  return typeof latencyMs === 'number' ? `${(latencyMs / 1000).toFixed(1)}s` : ABSENT
}

/**
 * **비용을 수치로 그리지 않는다.**
 *
 * `1j` 는 `cost $0.041` 을 그렸지만 계약의 `costMicro` 는 *"통화가 정해지지 않았다"* 고
 * 명시한다 (정정본 §13-53, 백엔드 #311). 단위 없는 정수에 통화 기호를 붙이는 것은 화면이
 * 계약에 없는 사실을 만드는 일이고, 그 화면을 보고 정산을 하면 **한쪽은 USD 한쪽은 KRW** 인
 * 합계가 나온다. 통화가 정해지기 전까지 이 자리는 그 사실을 말한다.
 */
export const COST_NOTE = 'cost — 계약이 통화를 정하지 않았어요 (백엔드 #311)'

/**
 * 호출 하나를 고르는 목록에 적을 한 줄.
 *
 * `purpose` · `attemptNo` 를 계약의 값 그대로 쓴다 — 번역하면 어느 필드를 보고 있는지가
 * 흐려지고, 이 화면은 저장된 것을 그대로 보는 자리다.
 */
export function callLabel(call: AiCall): string {
  const fallback = call.fallbackFrom == null ? '' : ` · fallback from ${call.fallbackFrom}`
  return `${call.purpose} · try ${call.attemptNo} · ${call.modelId}${fallback}`
}
