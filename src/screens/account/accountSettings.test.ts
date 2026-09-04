import { describe, expect, it } from 'vitest'

import type { ConsentTerm } from '../../api/endpoints/auth'
import {
  canSubmitDisplayName,
  displayNameHandle,
  policyLinks,
  WITHDRAW_NOTICE,
  withdrawNoticeText,
} from './accountSettings'

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

describe('약관 · 정책 줄 — 5b 가 남긴 셋', () => {
  it('age 를 빼고 서버 순서 그대로 셋을 만든다', () => {
    expect(policyLinks(SERVER_TERMS).map((link) => link.type)).toEqual(['tos', 'privacy', 'ai_notice'])
  })

  it('documentUrl 이 null 이면 null 그대로 온다 — 주소를 지어내지 않는다 (S-11)', () => {
    const aiNotice = policyLinks(SERVER_TERMS).find((link) => link.type === 'ai_notice')
    expect(aiNotice?.documentUrl).toBeNull()
  })

  it('판본을 줄에 싣지 않는다 — 5b 가 v1.2 표기를 지웠다', () => {
    for (const link of policyLinks(SERVER_TERMS)) {
      expect(Object.keys(link).sort()).toEqual(['documentUrl', 'label', 'type'])
      expect(JSON.stringify(link)).not.toContain('2026-01')
    }
  })

  it('서버가 준 것이 없으면 줄도 없다 — 서버가 주지 않은 약관을 그리지 않는다', () => {
    expect(policyLinks([])).toEqual([])
  })
})

describe('탈퇴 확인 문구 (5b · 6d) — 결과를 단정하지 않는다', () => {
  const lines = WITHDRAW_NOTICE.map(withdrawNoticeText)

  /**
   * `DELETE /api/v1/me` 는 회원 상태를 `withdrawn` 으로 옮기는 데까지다 (R12.5). 실제 파기와
   * 공개 UGC 강등은 파기 배치가 뒤에 한다 (B-61, §13-9) — 화면이 "즉시 삭제" 를 말하면 그
   * 사이의 사실과 어긋난다. 이 테스트가 그 문구가 되돌아오는 것을 막는다.
   */
  it('R12_5_즉시_삭제를_암시하는_말을_쓰지_않는다', () => {
    for (const forbidden of ['즉시', '바로', '삭제됩니다', '지워집니다', '파기됩니다', '영구']) {
      expect(lines.join('\n'), forbidden).not.toContain(forbidden)
    }
  })

  it('다시_로그인할_수_없다는_사실은_단정한다', () => {
    // 이것은 파기 배치와 무관하게 확실하다 — 탈퇴한 계정은 토큰을 재발급받지 못한다.
    expect(lines.some((line) => line.includes('다시 로그인할 수 없습니다'))).toBe(true)
  })

  it('5b · 6d 의 세 줄 그대로다', () => {
    expect(lines).toEqual([
      '탈퇴 처리 후 다시 로그인할 수 없습니다',
      '진행 중이던 이야기는 이어갈 수 없습니다',
      '공개한 작품과 데이터는 순차적으로 처리됩니다',
    ])
  })

  it('F6_회원_식별정보를_문구에_담지_않는다', () => {
    // 이메일 · playerRef 를 끼워 넣을 자리가 없다 — 문구가 상수이고 값을 받지 않는다.
    for (const line of WITHDRAW_NOTICE) {
      expect(JSON.stringify(line)).not.toMatch(/@|ref|Ref/)
    }
  })
})

describe('표시명 (backend #271 · #287, 정정본 §13-55)', () => {
  it('설정하지_않은_것과_빈_값을_구분하지_않는다 — 둘_다_아직_이름이_없다', () => {
    expect(displayNameHandle(null)).toBeNull()
    expect(displayNameHandle('   ')).toBeNull()
  })

  /** `@` 는 값에 없다 — 화면이 붙이는 표기다 (#287). 계약이 `@` 로 시작하는 값을 거절한다. */
  it('앳은_화면이_붙인다', () => {
    expect(displayNameHandle('연우')).toBe('@연우')
  })

  /**
   * 규칙의 정본은 서버 도메인이다 — 계약: *"화면 검증은 편의이지 계약이 아니다."*
   * 길이·허용 문자를 여기 옮겨 적으면 정본이 둘이 되고, 한쪽이 통과시킨 이름을 다른 쪽이
   * 거절하는 날이 온다. 그래서 이 함수는 **빈 것만** 막는다.
   */
  it('F4_길이와_허용_문자를_화면이_판정하지_않는다', () => {
    expect(canSubmitDisplayName('')).toBe(false)
    expect(canSubmitDisplayName('   ')).toBe(false)
    // 한 글자도, 열세 글자도, `@` 로 시작하는 값도 서버가 답한다.
    expect(canSubmitDisplayName('연')).toBe(true)
    expect(canSubmitDisplayName('열세글자짜리이름입니다다')).toBe(true)
    expect(canSubmitDisplayName('@연우')).toBe(true)
  })
})
