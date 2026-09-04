import type { BlocklistEntry, BlocklistRegisterRequest } from '../../api/endpoints/admin'

/**
 * 블록리스트 화면(8차 아트보드 `Blocklist` · `BlocklistMobile`)이 판단하는 것.
 *
 * **이 파일이 화면의 보안 면 전체다.** 무엇을 가리는가 · 무엇을 펼치는가 · 어느 줄에
 * [지우기]가 있는가 · 요청에 무엇을 싣는가. 컴포넌트 안에 있으면 렌더링 없이는 확인할 수
 * 없고, 그러면 *"가려 둔다"* 를 지키는 것이 코드가 아니라 리뷰어가 된다.
 *
 * **여기에도 실제 항목을 적지 않는다** (S-11 — 이 레포는 공개다). 라벨과 자리표시만 있다.
 */

/** 요청이 쓰는 표기 — **대문자다** (계약 `BlocklistRegisterRequest`). */
export type BlocklistKind = BlocklistRegisterRequest['kind']
export type BlocklistSeverity = BlocklistRegisterRequest['severity']

/** 응답이 쓰는 표기 — **소문자다** (계약 `BlocklistEntry`). 같은 값이고 표기만 다르다. */
export type BlocklistEntryKind = BlocklistEntry['kind']
export type BlocklistEntrySeverity = BlocklistEntry['severity']

/**
 * 표기 둘을 잇는 다리.
 *
 * **이 화면의 함정이 여기 있다.** 계약은 같은 값을 요청에서 `REAL_PERSON` 으로, 응답에서
 * `real_person` 으로 적는다. 라벨 맵을 한 쪽 표기로만 만들면 다른 쪽 조회가 `undefined` 가
 * 되고, 그것은 오류가 아니라 **빈 칸**으로 나타난다 — 목록의 종류 칸이 비어 있어도 화면은
 * 정상으로 보인다.
 *
 * `toUpperCase()` 로 옮기지 않는 이유는 그것이 문자열 연산이라 **계약이 값을 하나 늘려도
 * 타입검사가 아무 말도 하지 않기** 때문이다. `Record` 로 적어 두면 그때 여기서 멈춘다.
 */
const KIND_OF_ENTRY: Record<BlocklistEntryKind, BlocklistKind> = {
  ip_title: 'IP_TITLE',
  character: 'CHARACTER',
  real_person: 'REAL_PERSON',
  phrase: 'PHRASE',
}

const SEVERITY_OF_ENTRY: Record<BlocklistEntrySeverity, BlocklistSeverity> = {
  block: 'BLOCK',
  warn: 'WARN',
}

/** 고르는 자리의 넷. **계약의 값이고 화면이 늘리지 않는다** (아트보드). */
export const BLOCKLIST_KINDS: readonly BlocklistKind[] = [
  'IP_TITLE',
  'CHARACTER',
  'REAL_PERSON',
  'PHRASE',
]

export const KIND_LABEL: Record<BlocklistKind, string> = {
  IP_TITLE: '작품명',
  CHARACTER: '등장인물',
  REAL_PERSON: '실존 인물',
  PHRASE: '표현',
}

export const BLOCKLIST_SEVERITIES: readonly BlocklistSeverity[] = ['BLOCK', 'WARN']

/** 고르는 자리의 이름. 목록의 이름과 다르다 — 아래 `severityLabel` 이 그 이유를 적었다. */
export const SEVERITY_CHOICE_LABEL: Record<BlocklistSeverity, string> = {
  BLOCK: '차단',
  WARN: '경고',
}

/** 어느 표기로 와도 같은 이름을 답한다. */
export function kindLabel(kind: BlocklistKind | BlocklistEntryKind): string {
  const request =
    kind in KIND_OF_ENTRY ? KIND_OF_ENTRY[kind as BlocklistEntryKind] : (kind as BlocklistKind)
  return KIND_LABEL[request]
}

/**
 * 목록에서 심각도를 무엇이라 부르는가.
 *
 * **`warn` 은 "경고" 로만 적지 않는다.** 계약이 *"`severity: warn` 은 판정으로 나가지
 * 않는다"* 라고 적었고 (§13-31), 목록에서 "경고" 한 낱말만 보면 등록해 둔 것이 약하게라도
 * 걸리는 줄 안다 — 걸리지 않는다.
 */
export function severityLabel(severity: BlocklistSeverity | BlocklistEntrySeverity): string {
  const request =
    severity in SEVERITY_OF_ENTRY
      ? SEVERITY_OF_ENTRY[severity as BlocklistEntrySeverity]
      : (severity as BlocklistSeverity)
  return request === 'WARN' ? '경고 · 판정 안 함' : '차단'
}

/** 고르는 자리에 서 있어야 하는 문장 (§13-31). 없으면 운영자는 등록했다고 믿는다. */
export const WARN_NOTICE = '경고를 고르면 지금은 아무것도 막지 않습니다'

/** 출처가 없을 때. 계약이 `null` 을 허용하고, 없는 것을 지어내지 않는다. */
export const MISSING_SOURCE = '—'

export function sourceLabel(source: string | null | undefined): string {
  return source == null || source === '' ? MISSING_SOURCE : source
}

// ── 가리기와 펼치기 ────────────────────────────────────────────────────

/**
 * 가린 값. **길이를 따라 그리지 않는다.**
 *
 * 아트보드는 줄마다 다른 개수의 점을 그렸지만, 점 개수가 값의 길이를 따라가면 가린 값에서
 * 길이 하나가 그대로 새 나간다 — 이 화면은 화면 공유 · 스크린샷 · 버그 리포트에 함께 실린다
 * (S-11). 고정 개수는 아무것도 말하지 않는다.
 */
export const MASKED_VALUE = '●●●●●●●●'

/**
 * 지금 펼쳐 둔 줄을 바꾼다 — **한 번에 하나뿐이다.**
 *
 * 반환이 `id` 하나이므로 *'모두 펼치기'* 를 만들 자리가 없다. 목록 전체를 펼치는 버튼이
 * 있으면 가린 적이 없는 것과 같고, 그 버튼은 언제나 "한 번만 누르면 되는데" 로 정당화된다.
 * 그래서 화면이 그 버튼을 안 그리는 것이 아니라 **상태가 그것을 담지 못한다.**
 *
 * 같은 줄을 다시 누르면 접힌다. 펼치기는 로컬 상태이고 서버를 다시 부르지 않는다.
 */
export function toggleExpanded(current: string | null, id: string): string | null {
  return current === id ? null : id
}

/** 한 줄이 지금 무엇을 보이는가. */
export interface RowState {
  /** 값을 그대로 보이는가. 아니면 `MASKED_VALUE` 다 */
  revealed: boolean
  /** **[지우기]는 펼친 줄에만 있다** — 가려진 값을 잘못 눌러 지우는 일이 구조적으로 없어진다 */
  canRemove: boolean
}

export function rowState(entry: BlocklistEntry, expandedId: string | null): RowState {
  const revealed = entry.id === expandedId
  return { revealed, canRemove: revealed }
}

/** 그 줄에 그릴 값. 가려져 있으면 값 자체가 화면에 오지 않는다. */
export function displayedValue(entry: BlocklistEntry, expandedId: string | null): string {
  return rowState(entry, expandedId).revealed ? entry.value : MASKED_VALUE
}

// ── 등록 ───────────────────────────────────────────────────────────────

/** 계약 `BlocklistRegisterRequest` 의 `maxLength`. 손으로 정한 값이 아니다. */
export const VALUE_MAX_LENGTH = 200
export const SOURCE_MAX_LENGTH = 200

export interface RegisterDraft {
  kind: BlocklistKind
  value: string
  severity: BlocklistSeverity
  source: string
}

export const EMPTY_DRAFT: RegisterDraft = {
  kind: 'PHRASE',
  value: '',
  severity: 'BLOCK',
  source: '',
}

/**
 * 지금 이 값을 보낼 수 있는가 — **길이만 본다.**
 *
 * `trim()` 하지 않는다. 계약이 *"정규화는 서버가 한다"* 라고 적었고 (R2.5), 화면이 먼저
 * 다듬으면 서버가 보는 값과 사람이 넣은 값이 갈라진다. 공백만 넣은 입력은 서버가 `400` 으로
 * 답하며 (*"정규화하면 빈 값이 되는 입력"*), 그 문장이 그대로 화면에 온다 (F-4) — 여기서
 * 먼저 막으면 서버가 하지 않은 말을 화면이 하게 된다.
 *
 * 빈 문자열만 막는 이유는 계약의 `minLength: 1` 이다. 보낼 것이 없는 요청을 보내지 않는다.
 */
export function canRegister(draft: RegisterDraft, pending: boolean): boolean {
  return !pending && draft.value.length > 0 && draft.value.length <= VALUE_MAX_LENGTH
}

/**
 * 요청 본문. **값을 화면이 다듬지 않는다** — 공백도 대소문자도 그대로다.
 *
 * **정규화 값을 싣지 않는다.** 계약이 그 필드를 받지 않는 이유가 *"클라이언트가 보낸 정규화
 * 값을 믿으면 그것을 비워 보내는 것만으로 걸리지 않는 항목을 등록할 수 있다"* 이다.
 *
 * 출처는 비었으면 `null` 이다 — 빈 문자열을 보내면 "빈 출처" 라는 없는 값이 저장된다.
 */
export function buildRegisterRequest(draft: RegisterDraft): BlocklistRegisterRequest {
  return {
    kind: draft.kind,
    value: draft.value,
    severity: draft.severity,
    source: draft.source === '' ? null : draft.source,
  }
}

/** 남은 글자. 아트보드의 "0 / 200" 이다. */
export function valueCounter(value: string): string {
  return `${value.length} / ${VALUE_MAX_LENGTH}`
}
