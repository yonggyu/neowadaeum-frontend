import { describe, expect, it } from 'vitest'

import {
  allConsentsAgreed,
  canSubmitConsent,
  CONSENT_ITEMS,
  NO_CONSENTS,
  setAllConsents,
  toBirthDate,
  toConsentItems,
} from './consent'

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

describe('동의 3종', () => {
  it('tos · privacy · ai_notice 셋이다 — 마케팅 동의는 없다', () => {
    expect(CONSENT_ITEMS.map((item) => item.type)).toEqual(['tos', 'privacy', 'ai_notice'])
  })

  it('age 를 클라이언트가 보내지 않는다 — 서버가 생년월일로 판정해 스스로 기록한다', () => {
    // 백엔드 §13-24 · R10.2. 함께 보내면 같은 동의가 두 줄로 남고, 그중 한 줄은 아무것도
    // 확인하지 않은 자기신고다. 와이어프레임 3b·5a 는 넷을 그리지만 정정본이 이긴다.
    expect(CONSENT_ITEMS.map((item) => item.type)).not.toContain('age')
    expect(toConsentItems(setAllConsents(true)).map((item) => item.consentType)).not.toContain('age')
  })

  it('전체 동의는 셋을 함께 켜고 끈다', () => {
    expect(allConsentsAgreed(setAllConsents(true))).toBe(true)
    expect(allConsentsAgreed(setAllConsents(false))).toBe(false)
  })

  it('하나라도 빠지면 제출할 수 없다 — 셋 다 필수다', () => {
    const birthDate = { year: '2001', month: '3', day: '14' }
    expect(canSubmitConsent(birthDate, setAllConsents(true))).toBe(true)
    expect(canSubmitConsent(birthDate, { ...setAllConsents(true), ai_notice: false })).toBe(false)
    expect(canSubmitConsent(birthDate, NO_CONSENTS)).toBe(false)
  })

  it('생년월일이 없으면 동의만으로 제출되지 않는다', () => {
    expect(canSubmitConsent({ year: '', month: '', day: '' }, setAllConsents(true))).toBe(false)
  })

  it('계약이 받는 모양으로 바꾼다 — 판본 없는 동의는 서버가 거절한다', () => {
    const items = toConsentItems(setAllConsents(true))
    expect(items).toHaveLength(3)
    for (const item of items) {
      expect(item.agreed).toBe(true)
      expect(item.version).not.toBe('')
    }
  })
})
