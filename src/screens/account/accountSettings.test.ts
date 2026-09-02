import { describe, expect, it } from 'vitest'

import type { ConsentTerm } from '../../api/endpoints/auth'
import { policyLinks, WITHDRAW_NOTICE, withdrawNoticeText } from './accountSettings'

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
