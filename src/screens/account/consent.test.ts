import { describe, expect, it } from 'vitest'

import type { ConsentTerm } from '../../api/endpoints/auth'
import * as consentModule from './consent'
import {
  allConsentsAgreed,
  canSubmitConsent,
  consentOptions,
  NO_CONSENTS,
  setAllConsents,
  toBirthDate,
  toConsentItems,
} from './consent'

/** `GET /consents` 가 돌려주는 모양. 순서는 `tos → privacy → ai_notice → age` 다. */
const SERVER_TERMS: ConsentTerm[] = [
  { consentType: 'tos', version: 'tos-2026-01', documentUrl: 'https://example.test/tos', required: true },
  {
    consentType: 'privacy',
    version: 'privacy-2026-01',
    documentUrl: 'https://example.test/privacy',
    required: true,
  },
  { consentType: 'ai_notice', version: 'ai-notice-7', documentUrl: null, required: true },
  { consentType: 'age', version: 'age-15', documentUrl: null, required: false },
]

describe('생년월일 — 달력에 없는 날만 거른다', () => {
  it('세 칸을 YYYY-MM-DD 로 채운다', () => {
    expect(toBirthDate({ year: '2001', month: '3', day: '14' })).toBe('2001-03-14')
  })

  it('2월 30일은 3월 2일로 넘어가지 않는다', () => {
    expect(toBirthDate({ year: '2001', month: '2', day: '30' })).toBeNull()
  })

  it('윤년의 2월 29일은 통과하고, 평년의 같은 날은 통과하지 않는다', () => {
    expect(toBirthDate({ year: '2000', month: '2', day: '29' })).toBe('2000-02-29')
    expect(toBirthDate({ year: '2001', month: '2', day: '29' })).toBeNull()
  })

  it('덜 채운 상태는 null 이다 — 오류가 아니라 미완성이다', () => {
    expect(toBirthDate({ year: '20', month: '3', day: '14' })).toBeNull()
    expect(toBirthDate({ year: '2001', month: '', day: '14' })).toBeNull()
  })

  it('만 나이를 여기서 계산하지 않는다 — 연령 게이트의 입력면은 이 세 칸뿐이다', () => {
    // 15세 미만은 서버가 403 AGE_RESTRICTED 로 답한다 (KST · minAge=15). 프론트가 같은
    // 계산을 한 벌 더 가지면 시간대 하나 어긋나는 날 두 곳이 다른 답을 낸다.
    expect(toBirthDate({ year: '2020', month: '1', day: '1' })).toBe('2020-01-01')
  })
})

describe('약관 판본 — 서버가 준 것만 쓴다 (backend #261)', () => {
  it('백엔드261_판본을_서버에서_읽는다', () => {
    // `GET /consents` 가 준 `version` 을 `consents[].version` 에 **그대로** 되돌려 보낸다.
    const options = consentOptions(SERVER_TERMS)
    const items = toConsentItems(options, setAllConsents(options, true))

    expect(items).toEqual([
      { consentType: 'tos', version: 'tos-2026-01', agreed: true },
      { consentType: 'privacy', version: 'privacy-2026-01', agreed: true },
      { consentType: 'ai_notice', version: 'ai-notice-7', agreed: true },
    ])
  })

  it('백엔드261_판본이_상수로_남아있지_않다', () => {
    // 판본을 만들어 내는 자리가 이 모듈에 없다는 것이 규칙이다. 상수를 다시 들이면 약관이
    // 개정된 날부터 **동의 이력에 옛 판본이 쌓이고, 그것은 조용히 틀린다.**
    expect(Object.keys(consentModule)).not.toContain('CONSENT_VERSION')

    // 서버가 판본을 갈면 제출값도 함께 간다 — 사이에 고정된 값이 없다.
    const revised = SERVER_TERMS.map((term) => ({ ...term, version: `${term.version}-rev2` }))
    const options = consentOptions(revised)
    expect(toConsentItems(options, setAllConsents(options, true)).map((item) => item.version)).toEqual([
      'tos-2026-01-rev2',
      'privacy-2026-01-rev2',
      'ai-notice-7-rev2',
    ])
  })

  it('본문 주소도 서버의 것이다 — 없는 종류가 있다', () => {
    // 주소를 프론트가 지어내지 않는다 (S-11). AI 고지는 문구를 랜딩이 이미 내보낸다 (§13.10).
    expect(consentOptions(SERVER_TERMS).map((option) => option.documentUrl)).toEqual([
      'https://example.test/tos',
      'https://example.test/privacy',
      null,
    ])
  })
})

describe('사용자가 체크하는 동의', () => {
  const options = consentOptions(SERVER_TERMS)

  it('tos · privacy · ai_notice 셋이다 — 마케팅 동의는 없다', () => {
    expect(options.map((option) => option.type)).toEqual(['tos', 'privacy', 'ai_notice'])
  })

  it('age 를 클라이언트가 보내지 않는다 — 서버가 생년월일로 판정해 스스로 기록한다', () => {
    // 백엔드 §13-24 · R10.2. 함께 보내면 같은 동의가 두 줄로 남고, 그중 한 줄은 아무것도
    // 확인하지 않은 자기신고다. 와이어프레임 3b·5a 는 넷을 그리지만 정정본이 이긴다.
    expect(options.map((option) => option.type)).not.toContain('age')
    expect(toConsentItems(options, setAllConsents(options, true)).map((i) => i.consentType)).not.toContain(
      'age',
    )
  })

  it('서버가 age 를 required 로 돌려줘도 보내지 않는다', () => {
    // 계약 한 필드가 바뀌었다고 동의 이력이 두 줄이 되면 안 된다.
    const ageRequired = SERVER_TERMS.map((term) =>
      term.consentType === 'age' ? { ...term, required: true } : term,
    )
    expect(consentOptions(ageRequired).map((option) => option.type)).not.toContain('age')
  })

  it('required 가 아닌 항목은 체크 대상이 아니다 — 기준은 계약이 정한다', () => {
    const optional = SERVER_TERMS.map((term) =>
      term.consentType === 'privacy' ? { ...term, required: false } : term,
    )
    expect(consentOptions(optional).map((option) => option.type)).toEqual(['tos', 'ai_notice'])
  })

  it('전체 동의는 서버가 준 항목을 함께 켜고 끈다', () => {
    expect(allConsentsAgreed(options, setAllConsents(options, true))).toBe(true)
    expect(allConsentsAgreed(options, setAllConsents(options, false))).toBe(false)
  })

  it('하나라도 빠지면 제출할 수 없다 — 전부 필수다', () => {
    const birthDate = { year: '2001', month: '3', day: '14' }
    expect(canSubmitConsent(birthDate, options, setAllConsents(options, true))).toBe(true)
    expect(
      canSubmitConsent(birthDate, options, { ...setAllConsents(options, true), ai_notice: false }),
    ).toBe(false)
    expect(canSubmitConsent(birthDate, options, NO_CONSENTS)).toBe(false)
  })

  it('생년월일이 없으면 동의만으로 제출되지 않는다', () => {
    expect(canSubmitConsent({ year: '', month: '', day: '' }, options, setAllConsents(options, true))).toBe(
      false,
    )
  })

  it('백엔드261_판본을_못_읽었으면_제출되지_않는다', () => {
    // 약관 목록이 비어 있는 상태가 "전부 동의함" 이 되면 안 된다 — 빈 배열의 `every` 가
    // true 이기 때문이다. 여기가 판본 없는 동의를 보내는 길이 열리는 자리다 (backend #279 —
    // 서버 설정이 들어가기 전까지 `GET /consents` 는 500 이고, 그것이 현재의 정상 경로다).
    expect(allConsentsAgreed([], {})).toBe(false)
    expect(canSubmitConsent({ year: '2001', month: '3', day: '14' }, [], {})).toBe(false)
    expect(toConsentItems([], {})).toEqual([])
  })
})
