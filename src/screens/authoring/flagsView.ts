import { chapterField, endingField, type FlagReference } from './outline'

/**
 * Step 3 의 플래그 절이 **화면에 무엇을 적는가** (7차 `A-1` · #125).
 *
 * 값 모형과 판정은 `stepFields.ts` · `outline.ts` 에 있다. 여기 있는 것은 그 판정의 결과를
 * 사람이 읽는 한 줄로 옮기는 일뿐이고, 그래서 React 를 import 하지 않는다 — 이 레포의 테스트
 * 러너에는 DOM 이 없고(`useDialogChrome` 의 주석), 문장은 DOM 없이도 지켜야 하는 것이다.
 *
 * **여기서 계약을 다시 판단하지 않는다.** 이름의 상한도 개수도 `stepFields.ts` 의 상수가
 * 정본이며, 잠금 사유는 `templateBlockedReason` 이 정본이다 — 문구를 화면이 짓기 시작하면
 * 계약이 움직였을 때 갱신되지 않는 문장이 남는다 (표류 37 이 그 자리였다).
 */

/** `챕터 3` · `엔딩 2` — 번호는 자리 + 1 이다 (`writeOutline` 이 번호를 매기는 규칙과 같다). */
export function flagReferenceName(reference: FlagReference): string {
  return `${reference.kind === 'chapter' ? '챕터' : '엔딩'} ${reference.index + 1}`
}

/**
 * D-4 — *"엔딩 2 · 챕터 3 의 조건이 이 이름을 가리킵니다"*. 가리키는 것이 없으면 `null` 이다.
 *
 * **개수를 세어 말하지 않는다** (*"조건 2개가…"*). 작성자가 다음에 할 일은 그 자리로 가는
 * 것이고, 그러려면 어느 자리인지가 이름으로 보여야 한다.
 */
export function flagReferenceNote(references: readonly FlagReference[]): string | null {
  if (references.length === 0) return null
  return `${references.map(flagReferenceName).join(' · ')} 의 조건이 이 이름을 가리킵니다`
}

/**
 * D-5 — 확인 판의 본문. **`null` 이면 판을 띄우지 않는다.**
 *
 * 되돌릴 것이 없는 자리에 판을 띄우면 다음부터 아무도 읽지 않는다. 그래서 가리키는 조건이
 * 없는 플래그는 판 없이 바로 지운다 — 판이 뜨는 것 자체가 *무언가를 잃는다*는 신호다.
 */
export function flagRemovalWarning(references: readonly FlagReference[]): string | null {
  const note = flagReferenceNote(references)
  return note === null ? null : `${note}. 지우면 그 조건이 비워집니다.`
}

/**
 * 이 자리를 지우면 그 **이름이** 원고에서 사라지는가.
 *
 * 같은 이름을 두 번 적는 것을 막지 않는다 — 계약이 막지 않고 화면이 계약보다 좁히지 않는다.
 * 둘 중 하나만 지우면 이름은 남고, 그것을 가리키던 조건도 멀쩡하다. 그때까지 판을 띄우면
 * **잃지 않는 것을 잃는다고 말하는 셈**이고, 실제로 조건을 비우면 거짓말이 참이 된다.
 */
export function flagRemovedEntirely(flags: readonly string[], index: number): boolean {
  const removed = flags[index]
  if (removed === undefined) return false
  return !flags.some((flag, at) => at !== index && flag === removed)
}

/**
 * D-5 의 *[엔딩 3 으로]* 가 데려다 줄 자리 — **계약의 필드 경로**다.
 *
 * 새 장치를 만들지 않는다. 이 레포는 이미 `document.getElementById(<필드 경로>)?.focus()` 로
 * "해당 필드로 이동" 을 하고 (`DraftField` 의 DOM id 가 곧 그 경로다), 우측 검수 패널이
 * 쓰는 것과 같은 길이다.
 *
 * **조건 칸이 아니라 그 카드의 첫 칸을 가리킨다.** 조건 칸의 id 는 `StepOutline` 이 필드
 * 경로에 접미사를 붙여 만드는 화면의 것이라 여기서 다시 조립하면 두 곳이 생기고, 한쪽만
 * 바뀌는 날 초점은 아무 데도 가지 않으면서 조용히 실패한다.
 */
export function flagJumpField(reference: FlagReference): string {
  return reference.kind === 'chapter'
    ? chapterField(reference.index, 'title')
    : endingField(reference.index, 'label')
}

/**
 * 숫자 뒤에 오는 `으로` · `로` (7차 아트보드의 *"엔딩 3 으로"*).
 *
 * 마지막 자리의 **읽는 소리**가 정한다 — 받침이 없거나 `ㄹ` 이면 `로`, 그 밖이면 `으로`.
 * 3(삼) · 6(육) · 0(영 · 십 · 백)만 `으로` 이고 나머지는 `로` 다. 아트보드가 3 하나만
 * 그려서 그 한 글자를 그대로 옮기면 *"엔딩 2 으로"* 가 나오고, 그것은 디자인이 정한 것이
 * 아니라 우리가 만든 오타다.
 */
const NEEDS_EU = new Set(['0', '3', '6'])

/** D-5 의 셋째 버튼 — *[엔딩 3 으로]*. */
export function flagJumpLabel(reference: FlagReference): string {
  const name = flagReferenceName(reference)
  return `${name} ${NEEDS_EU.has(name.slice(-1)) ? '으로' : '로'}`
}
