import type { ConsentItem, ConsentType } from '../../api/endpoints/auth'

/**
 * 최초 로그인의 추가 정보 — 생년월일과 동의 3종 (와이어프레임 5a · 6b).
 *
 * 화면에서 떼어 낸 순수 부분이다. 여기서 만 나이를 계산하지 않는다 — **연령 판정은 서버의
 * 것**이고(KST 기준 · `minAge = 15`), 프론트가 같은 계산을 한 벌 더 가지면 시간대 하나
 * 어긋나는 날 두 곳이 다른 답을 낸다. 여기서 거르는 것은 **달력에 없는 날짜**뿐이다.
 */

/**
 * 클라이언트가 보내는 동의 — `age` 를 뺀 셋.
 *
 * **`age` 는 사용자가 체크하는 항목이 아니다** (백엔드 §13-24). 서버가 생년월일로 판정한
 * 사실을 `age-15` 판본으로 스스로 기록한다 — *"만 15세 이상입니다"* 에 체크했다는 사실보다
 * **서버가 확인했다는 사실**이 증빙이기 때문이다 (R10.2). 클라이언트가 함께 보내면 같은
 * 동의가 두 줄로 남고, 그중 한 줄은 아무것도 확인하지 않은 자기신고가 된다.
 *
 * 계약의 `ConsentItem.consentType` enum 에는 `age` 가 **남아 있고 그것이 맞다** — 서버가
 * 자기 기록을 남길 때 쓰는 값이다. 그래서 여기서 지우지 않고 `Exclude` 로 좁힌다: 계약이
 * 진실의 원천이고, 이 파일은 *그중 무엇을 클라이언트가 보내는가*만 정한다.
 *
 * 와이어프레임 `3b` · `5a` 는 네 번째 체크박스를 그리지만 **정정본이 계약을 정정한다** —
 * 충돌하면 `corrections.md` 가 이긴다 (CLAUDE.md Source of Truth).
 */
export type SubmittedConsentType = Exclude<ConsentType, 'age'>

/**
 * 사용자가 체크하는 세 항목 (§4.1 — 약관 · 개인정보 · AI고지).
 *
 * 마케팅 동의는 없다. 닉네임 칸도 없다 — `OAuthLoginRequest` 에 자리가 없기 때문이다.
 * 연령 게이트의 입력면은 체크박스가 아니라 **생년월일**이다.
 */
export const CONSENT_ITEMS: readonly { type: SubmittedConsentType; label: string }[] = [
  { type: 'tos', label: '[필수] 이용약관' },
  { type: 'privacy', label: '[필수] 개인정보처리방침' },
  { type: 'ai_notice', label: '[필수] AI 생성물 이용 안내' },
]

/**
 * 사용자가 본 약관의 판본.
 *
 * **계약에 이 값을 알려 주는 경로가 없다.** `ConsentItem.version` 은 필수인데(백엔드는
 * `@NotBlank` 로 막는다) 약관 판본을 내려 주는 오퍼레이션도, `GET /me` 도 없다. 그래서 지금은
 * 프론트가 상수로 들고 간다 — **화면이 보여 준 판본을 화면이 아는 것**이라는 점에서 틀린
 * 자리는 아니지만, 약관 문서가 붙는 순간 이 값이 문서와 함께 움직여야 한다.
 *
 * 서버가 스스로 남기는 `age` 의 판본(`age-15`)은 여기 없다 — 그것은 서버의 판정 기준이다.
 */
export const CONSENT_VERSION = 'v1'

export type ConsentChecks = Readonly<Record<SubmittedConsentType, boolean>>

export const NO_CONSENTS: ConsentChecks = {
  tos: false,
  privacy: false,
  ai_notice: false,
}

/** "약관 전체 동의" — 셋을 한 번에 켜고 끈다. */
export function setAllConsents(agreed: boolean): ConsentChecks {
  return { tos: agreed, privacy: agreed, ai_notice: agreed }
}

export function allConsentsAgreed(checks: ConsentChecks): boolean {
  return CONSENT_ITEMS.every((item) => checks[item.type])
}

/** 계약이 받는 모양으로. 거절은 보내지 않는다 — 필수 셋이므로 전부 켜져야 제출된다. */
export function toConsentItems(checks: ConsentChecks): ConsentItem[] {
  return CONSENT_ITEMS.map((item) => ({
    consentType: item.type,
    version: CONSENT_VERSION,
    agreed: checks[item.type],
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
export function canSubmitConsent(fields: BirthDateFields, checks: ConsentChecks): boolean {
  return toBirthDate(fields) !== null && allConsentsAgreed(checks)
}
