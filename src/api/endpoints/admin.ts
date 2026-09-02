import { request } from '../client'
import type { components } from '../schema'

/**
 * 관리자 경로 전부와, 그것들이 요구하는 단계 승격.
 *
 * 타입을 손으로 적지 않는다 (F-2) — 전부 `schema.d.ts` 의 별칭이다.
 *
 * **승격이 이 파일 안에 사는 이유.** 계약은 관리자 경로를 역할 · IP · 2FA 의 AND 뒤에
 * 두었다 (backend S-4). 셋 중 프론트가 나르는 것은 마지막 하나뿐이고, 그 값은 `verify` ·
 * `confirm` 이 발급해 `X-Admin-Step-Up` 으로 되돌아간다. 값을 모듈 밖으로 **내보내지
 * 않으면** 로그 · URL · 오류 리포트로 새는 길 자체가 생기지 않는다 — `client.ts` 가
 * 액세스 토큰에 쓴 것과 같은 방식이며(`hasAccessToken`), 여기서는 그 이유가 더 강하다.
 */
export type TotpEnrollment = components['schemas']['TotpEnrollmentResponse']
export type TotpStepUp = components['schemas']['TotpStepUpResponse']
export type TotpCodeRequest = components['schemas']['TotpCodeRequest']

export type AdminSessionDebug = components['schemas']['AdminSessionDebugResponse']
export type RollbackRequest = components['schemas']['RollbackRequest']
export type RollbackResult = components['schemas']['RollbackResult']
export type RegenerateResult = components['schemas']['RegenerateResult']
export type FreeInputRequest = components['schemas']['FreeInputRequest']
export type FreeInputResult = components['schemas']['FreeInputResult']
export type BlocklistEntry = components['schemas']['BlocklistEntry']
export type BlocklistRegisterRequest = components['schemas']['BlocklistRegisterRequest']
export type ReviewQueueItem = components['schemas']['ReviewQueueItem']
export type ReviewVerdictRequest = components['schemas']['ReviewVerdictRequest']
export type ReviewVerdictResult = components['schemas']['ReviewVerdictResult']

/**
 * 지금 들고 있는 승격. **메모리에만 둔다** (F-3 와 같은 이유이고 더 강하다).
 *
 * `localStorage` · `sessionStorage` 에 두면 XSS 하나로 관리자 문이 열린다. 두 번째 요소를
 * 요구하는 이유가 첫 번째 요소가 새는 경우를 대비하는 것인데, 그 결과물을 첫 번째 요소와
 * 같은 자리에 두면 요소가 다시 하나가 된다. 새로고침에 승격이 풀리는 것은 대가가 아니라
 * **의도한 동작**이다.
 *
 * `export` 하지 않는다. 이 모듈 밖에서는 값을 읽을 방법이 없다.
 */
let promotion: { token: string; expiresAt: number } | null = null

/**
 * 승격을 갈아 끼운다. `null` 이면 버린다.
 *
 * 만료 시각은 **서버가 준 `expiresIn` 으로만** 계산한다 (계약 `TotpStepUpResponse`).
 * 프론트가 수명을 정해 두면 서버 정책이 바뀌는 순간 조용히 어긋나고, 그 어긋남은 하던
 * 작업이 `403` 으로 끊기는 형태로 나타난다 — 계약이 이 필드를 준 이유가 그것이다.
 */
export function setAdminStepUp(next: TotpStepUp | null): void {
  const expiresAt = next === null ? 0 : Date.now() + next.expiresIn * 1000
  promotion = next === null ? null : { token: next.stepUpToken, expiresAt }
}

/** 승격을 버린다. 관리자 화면을 떠날 때 · 사용자가 직접 내릴 때. */
export function clearAdminStepUp(): void {
  promotion = null
}

/**
 * 지금 보낼 승격을 들고 있는가.
 *
 * **값을 내주지 않는다** — 묻는 쪽(진입 가드 · 인증 화면)이 알아야 하는 것은 "문을 열 수
 * 있는가" 하나다. 꺼낼 수 있게 만들면 그 값이 로그 · 오류 리포트로 새는 길이 생긴다
 * (보안 hard-stop).
 *
 * 만료된 것은 없는 것으로 답하고 그 자리에서 버린다. 만료를 `403` 으로 처음 겪게 두면
 * 그때는 하던 작업이 이미 끊긴 뒤다.
 */
export function hasAdminStepUp(): boolean {
  if (promotion !== null && Date.now() >= promotion.expiresAt) {
    promotion = null
  }
  return promotion !== null
}

/**
 * 요청에 붙일 승격.
 *
 * `export` 하지 않는다 — 아래 호출부들만 부른다. 없으면 헤더를 붙이지 않고, 그때 서버가
 * 무엇으로 답할지는 서버가 정한다. 프론트가 미리 막고 "승격이 필요해요" 같은 문구를 지어
 * 내면 그것이 곧 서버가 하지 않은 말이 된다 (F-4).
 *
 * **`403` 을 만나도 승격을 버리지 않는다.** 관리자 경로의 `403` 은 역할 · IP · 2FA 셋 중
 * 무엇이 어긋났는지 구분하지 않으므로(S-4, S-6), 그것을 만료로 읽으면 프론트가 서버가
 * 하지 않은 판단을 하게 된다. 만료는 위의 시각으로만 다룬다.
 */
function stepUp(): string | undefined {
  return hasAdminStepUp() && promotion !== null ? promotion.token : undefined
}

// ── 2FA ────────────────────────────────────────────────────────────────

/**
 * 등록 시작 (계약 `enrollAdminTotp`).
 *
 * **비밀이 나가는 유일한 응답이다** — 계약이 그렇게 적었다. 돌려받은 값을 호출부가
 * 어디에도 남기지 않아야 하므로 이 함수는 그것을 **저장하지 않는다.** 화면이 자기 상태로만
 * 들고 있다가 화면과 함께 사라지게 한다.
 *
 * 아직 등록하지 않은 관리자는 승격 없이 부를 수 있다. 이미 확정된 등록이 있으면 승격을
 * 요구하므로 들고 있으면 함께 보낸다 — 재등록은 2FA 를 갈아 치우는 행위다.
 */
export function enrollAdminTotp(signal?: AbortSignal): Promise<TotpEnrollment> {
  return request<TotpEnrollment>('/admin/2fa/enroll', {
    method: 'POST',
    adminStepUp: stepUp(),
    signal,
  })
}

/**
 * 등록 확정 (계약 `confirmAdminTotp`).
 *
 * **곧바로 승격을 준다** — 계약이 명시했다. 방금 코드를 맞힌 사람에게 다시 묻는 것은
 * 아무것도 더 확인하지 못한다. 그래서 응답을 여기서 바로 보관한다.
 */
export async function confirmAdminTotp(code: string, signal?: AbortSignal): Promise<void> {
  const granted = await request<TotpStepUp>('/admin/2fa/confirm', {
    method: 'POST',
    body: { code } satisfies TotpCodeRequest,
    signal,
  })
  setAdminStepUp(granted)
}

/**
 * 검증 (계약 `verifyAdminTotp`). 승격을 만들어 내는 유일한 경로다.
 *
 * **같은 코드는 두 번 통하지 않는다** — 코드는 한 스텝 동안 같으므로, 재사용을 막지 않으면
 * 어깨너머로 본 여섯 자리가 그 창 안에서 다시 쓰인다. 그래서 이 함수도, 이 함수를 부르는
 * 화면도 **자동 재시도를 두지 않는다.** 실패하면 사람이 새 코드를 읽어 다시 넣는다.
 */
export async function verifyAdminTotp(code: string, signal?: AbortSignal): Promise<void> {
  const granted = await request<TotpStepUp>('/admin/2fa/verify', {
    method: 'POST',
    body: { code } satisfies TotpCodeRequest,
    signal,
  })
  setAdminStepUp(granted)
}

// ── 관리자 경로 ────────────────────────────────────────────────────────
//
// 화면은 다음 배치다 (3h 검수·신고 큐 · 1j Debug 콘솔). 호출부를 먼저 두는 이유는 승격을
// 붙이는 방식이 여기 한 곳에서 정해져야 하기 때문이다 — 화면마다 헤더를 직접 붙이게 두면
// 빠뜨린 호출이 조용히 통과하고, 그때 `403` 의 원인은 화면 쪽에서 보이지 않는다.

const sessionPath = (sessionId: string): string => `/admin/sessions/${encodeURIComponent(sessionId)}`

/**
 * 세션 디버그 (계약 `getSessionDebug`).
 *
 * **원문을 읽으면 기록된다** (backend R12.3, S-5). 이 호출이 감사 한 줄을 남기므로 목록을
 * 그리려고 미리 불러 두지 않는다 — 열어 본 적 없는 세션이 열람 기록에 남는다.
 */
export function getSessionDebug(
  sessionId: string,
  signal?: AbortSignal,
): Promise<AdminSessionDebug> {
  return request<AdminSessionDebug>(`${sessionPath(sessionId)}/debug`, {
    adminStepUp: stepUp(),
    signal,
  })
}

/** 세션 되돌리기 (계약 `rollbackSession`). `toTurnNo` 는 되돌린 뒤 **남아 있을** 턴이다. */
export function rollbackSession(
  sessionId: string,
  body: RollbackRequest,
  signal?: AbortSignal,
): Promise<RollbackResult> {
  return request<RollbackResult>(`${sessionPath(sessionId)}/rollback`, {
    method: 'POST',
    body,
    adminStepUp: stepUp(),
    signal,
  })
}

/**
 * 턴 재생성 (계약 `regenerateTurn`).
 *
 * `Idempotency-Key` 를 붙이지 않는다. F-7 은 **재시도가 중복 과금이 되는** 사용자 턴 생성의
 * 규칙이고, 재생성은 반대로 *같은 지점을 일부러 다시 부르는* 요청이다 — 키를 붙이면 두 번째
 * 호출이 첫 번째 결과를 되돌려받고, 그러면 이 경로가 하려는 일 자체가 일어나지 않는다.
 */
export function regenerateTurn(
  sessionId: string,
  turnNo: number,
  signal?: AbortSignal,
): Promise<RegenerateResult> {
  return request<RegenerateResult>(`${sessionPath(sessionId)}/turns/${turnNo}/regenerate`, {
    method: 'POST',
    adminStepUp: stepUp(),
    signal,
  })
}

/**
 * 관리자 자유입력 (계약 `submitAdminFreeInput`).
 *
 * **테스트 세션에서만 열린다** (backend I-18) — 그 판단은 서버가 한다. L1 에 걸리면 `422`
 * 이고 **어디에 걸렸는지는 오지 않는다** (F-5).
 */
export function submitAdminFreeInput(
  sessionId: string,
  body: FreeInputRequest,
  signal?: AbortSignal,
): Promise<FreeInputResult> {
  return request<FreeInputResult>(`${sessionPath(sessionId)}/turns/free`, {
    method: 'POST',
    body,
    adminStepUp: stepUp(),
    signal,
  })
}

/** 블록리스트 목록 (계약 `listBlocklist`). **이 응답을 관리자 화면 밖으로 내보내지 않는다** (S-11). */
export function listBlocklist(signal?: AbortSignal): Promise<BlocklistEntry[]> {
  return request<BlocklistEntry[]>('/admin/blocklist', { adminStepUp: stepUp(), signal })
}

/** 블록리스트 등록 (계약 `registerBlocklistEntry`). **정규화는 서버가 한다** (backend R2.5). */
export function registerBlocklistEntry(
  body: BlocklistRegisterRequest,
  signal?: AbortSignal,
): Promise<BlocklistEntry> {
  return request<BlocklistEntry>('/admin/blocklist', {
    method: 'POST',
    body,
    adminStepUp: stepUp(),
    signal,
  })
}

/** 블록리스트 삭제 (계약 `removeBlocklistEntry`). **없어도 성공이다** — `204`, 본문 없음. */
export function removeBlocklistEntry(entryId: string, signal?: AbortSignal): Promise<void> {
  return request<void>(`/admin/blocklist/${encodeURIComponent(entryId)}`, {
    method: 'DELETE',
    adminStepUp: stepUp(),
    signal,
  })
}

/**
 * 인간 검수 큐 (계약 `listReviewQueue`). 오래 기다린 것부터 온다.
 *
 * **전체 길이가 오지 않는다** — 계약이 담지 않았다. 화면이 밀린 건수를 만들어 내면 그것은
 * 서버가 하지 않은 말이다.
 */
export function listReviewQueue(signal?: AbortSignal): Promise<ReviewQueueItem[]> {
  return request<ReviewQueueItem[]>('/admin/reviews', { adminStepUp: stepUp(), signal })
}

/**
 * 검수 판정 (계약 `decideReview`).
 *
 * `reasons` 는 **카테고리만**이다 (backend R8.7) — 계약이 자유 문자열을 받지 않는 것이 그
 * 보장이다. `note` 는 내부 기록이고 작성자에게 가지 않는다.
 */
export function decideReview(
  storyId: string,
  body: ReviewVerdictRequest,
  signal?: AbortSignal,
): Promise<ReviewVerdictResult> {
  const path = `/admin/reviews/${encodeURIComponent(storyId)}/verdict`
  return request<ReviewVerdictResult>(path, { method: 'POST', body, adminStepUp: stepUp(), signal })
}
