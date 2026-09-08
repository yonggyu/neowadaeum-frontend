import type { ConsentItem, ConsentTerm, ConsentType } from '../../api/endpoints/auth'

/**
 * 최초 로그인의 추가 정보 — 생년월일과 약관 동의 (와이어프레임 5a · 6b).
 *
 * 화면에서 떼어 낸 순수 부분이다. 여기서 만 나이를 계산하지 않는다 — **연령 판정은 서버의
 * 것**이고(KST 기준 · `minAge = 15`), 프론트가 같은 계산을 한 벌 더 가지면 시간대 하나
 * 어긋나는 날 두 곳이 다른 답을 낸다. 여기서 거르는 것은 **달력에 없는 날짜**뿐이다.
 *
 * **판본도 여기서 정하지 않는다.** `GET /consents` 가 준 것을 그대로 되돌려 보낸다 —
 * 이 파일에 판본 상수가 없다는 것이 규칙이다 (backend #261).
 */

/**
 * 클라이언트가 보내는 동의 — `age` 를 뺀 것들.
 *
 * **`age` 는 사용자가 체크하는 항목이 아니다** (백엔드 §13-24). 서버가 생년월일로 판정한
 * 사실을 스스로 기록한다 — *"만 15세 이상입니다"* 에 체크했다는 사실보다 **서버가
 * 확인했다는 사실**이 증빙이기 때문이다 (R10.2). 클라이언트가 함께 보내면 같은 동의가 두
 * 줄로 남고, 그중 한 줄은 아무것도 확인하지 않은 자기신고가 된다.
 *
 * 계약의 `consentType` enum 에는 `age` 가 **남아 있고 그것이 맞다** — 서버가 자기 기록을
 * 남길 때 쓰는 값이고, `GET /consents` 의 목록에도 담긴다(계정 설정 화면이 판본을 표시할 수
 * 있어야 한다). 그래서 여기서 지우지 않고 `Exclude` 로 좁힌다: 계약이 진실의 원천이고,
 * 이 파일은 *그중 무엇을 클라이언트가 보내는가*만 정한다.
 *
 * 와이어프레임 `3b` · `5a` 는 네 번째 체크박스를 그리지만 **정정본이 계약을 정정한다** —
 * 충돌하면 `corrections.md` 가 이긴다 (CLAUDE.md Source of Truth).
 */
export type SubmittedConsentType = Exclude<ConsentType, 'age'>

/**
 * 사용자가 체크하는 한 항목 — **판본과 본문 주소가 서버에서 온 채로 붙어 있다.**
 *
 * 화면이 `version` 을 따로 들고 다니지 않게 하려는 것이다. 체크박스와 그 체크박스가
 * 증빙하는 판본이 같은 객체 안에 있으면, 판본 없이 제출하는 경로가 타입상 만들어지지 않는다.
 */
export interface ConsentOption {
  readonly type: SubmittedConsentType
  readonly label: string
  /** `GET /consents` 가 준 값. 여기 말고 다른 출처가 없다 (backend #261) */
  readonly version: string
  /** 약관 본문 주소. **`null` 일 수 있다** — AI 고지는 문구를 랜딩이 이미 내보낸다 (§13.10) */
  readonly documentUrl: string | null
}

/**
 * 체크박스에 붙는 이름.
 *
 * 계약이 주지 않는 유일한 것이라 화면의 몫이다 — `GET /consents` 는 종류 · 판본 · 주소만
 * 준다. 문구를 짓지 않는다는 규칙(F-4)은 **서버가 말한 것을 바꿔 말하지 않는다**는 뜻이고,
 * 서버가 애초에 보내지 않는 UI 라벨은 그 대상이 아니다.
 */
const CONSENT_LABELS: Readonly<Record<SubmittedConsentType, string>> = {
  tos: '[필수] 이용약관',
  privacy: '[필수] 개인정보처리방침',
  ai_notice: '[필수] AI 생성물 이용 안내',
}

/**
 * 서버가 준 약관 목록에서 **사용자가 체크할 것들만** 남긴다.
 *
 * 거르는 조건이 둘이고, 둘 다 필요하다.
 * - `required === false` — 계약이 정한 기준이다. *가입에 사용자의 동의가 필요한가.*
 * - `consentType === 'age'` — 서버가 `age` 를 `required: true` 로 돌려주더라도 클라이언트는
 *   그것을 보내지 않는다 (§13-24). 계약 한 필드가 바뀌었다고 동의 이력이 두 줄이 되면 안 된다.
 *
 * 목록의 순서는 서버의 것을 그대로 쓴다 (`tos → privacy → ai_notice → age`).
 */
export function consentOptions(terms: readonly ConsentTerm[]): ConsentOption[] {
  return terms
    .filter((term): term is ConsentTerm & { consentType: SubmittedConsentType } =>
      term.required && term.consentType !== 'age',
    )
    .map((term) => ({
      type: term.consentType,
      label: CONSENT_LABELS[term.consentType],
      version: term.version,
      documentUrl: term.documentUrl,
    }))
}

/** 체크 상태 — 종류별 on/off. 어떤 종류가 있는지는 서버가 정하므로 키를 고정하지 않는다. */
export type ConsentChecks = Readonly<Partial<Record<SubmittedConsentType, boolean>>>

export const NO_CONSENTS: ConsentChecks = {}

/** "약관 전체 동의" — 서버가 준 항목 전부를 한 번에 켜고 끈다. */
export function setAllConsents(options: readonly ConsentOption[], agreed: boolean): ConsentChecks {
  return Object.fromEntries(options.map((option) => [option.type, agreed]))
}

export function allConsentsAgreed(
  options: readonly ConsentOption[],
  checks: ConsentChecks,
): boolean {
  // 빈 목록에서 `every` 는 true 다. **약관을 하나도 읽지 못한 상태가 "전부 동의함" 이 되면
  // 안 된다** — 판본 없는 동의를 보내는 길이 바로 여기서 열린다 (backend #261 · #279).
  return options.length > 0 && options.every((option) => checks[option.type] === true)
}

/**
 * 계약이 받는 모양으로.
 *
 * `version` 은 **서버가 준 것을 그대로** 되돌려 보낸다 — 이 함수에 판본을 만들어 낼 재료가
 * 없다는 것이 요점이다. 거절은 보내지 않는다: 전부 필수이므로 다 켜져야 제출된다.
 */
export function toConsentItems(
  options: readonly ConsentOption[],
  checks: ConsentChecks,
): ConsentItem[] {
  return options.map((option) => ({
    consentType: option.type,
    version: option.version,
    agreed: checks[option.type] === true,
  }))
}

export interface BirthDateFields {
  readonly year: string
  readonly month: string
  readonly day: string
}

export const EMPTY_BIRTH_DATE: BirthDateFields = { year: '', month: '', day: '' }

/**
 * `YYYY-MM-DD` 로 바꾼다. 달력에 없는 날이면 `null`.
 *
 * 세 칸이 다 차기 전에는 `null` 이지만 그것은 **오류가 아니라 미완성**이다 — 화면은 제출
 * 버튼을 잠그는 데만 쓰고, 빨간 문구를 띄우지 않는다.
 */
export function toBirthDate(fields: BirthDateFields): string | null {
  const year = Number(fields.year)
  const month = Number(fields.month)
  const day = Number(fields.day)
  if (!/^\d{4}$/.test(fields.year) || !/^\d{1,2}$/.test(fields.month) || !/^\d{1,2}$/.test(fields.day)) {
    return null
  }
  if (month < 1 || month > 12 || day < 1) {
    return null
  }
  // 윤년을 손으로 세지 않는다 — `new Date` 는 2월 30일을 3월 2일로 넘겨 버리므로, 되돌아온
  // 값이 넣은 값과 같은지로 확인한다.
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null
  }
  return `${fields.year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 제출할 수 있는가. 연령은 여기서 묻지 않는다 — 서버가 `403 AGE_RESTRICTED` 로 답한다. */
export function canSubmitConsent(
  fields: BirthDateFields,
  options: readonly ConsentOption[],
  checks: ConsentChecks,
): boolean {
  return toBirthDate(fields) !== null && allConsentsAgreed(options, checks)
}
