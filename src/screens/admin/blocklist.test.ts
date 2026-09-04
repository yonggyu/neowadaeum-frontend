import { describe, expect, it } from 'vitest'

import type { BlocklistEntry } from '../../api/endpoints/admin'
import {
  BLOCKLIST_KINDS,
  BLOCKLIST_SEVERITIES,
  buildRegisterRequest,
  canRegister,
  displayedValue,
  EMPTY_DRAFT,
  kindLabel,
  MASKED_VALUE,
  MISSING_SOURCE,
  rowState,
  severityLabel,
  sourceLabel,
  toggleExpanded,
  valueCounter,
  VALUE_MAX_LENGTH,
  type BlocklistEntryKind,
  type BlocklistEntrySeverity,
} from './blocklist'

/**
 * **픽스처에 실제 차단 항목을 한 줄도 적지 않는다** (S-11 — 이 레포는 공개다). 이 파일이
 * 그것을 담으면 테스트가 곧 우회 사전이 된다. 전부 명백한 가짜다.
 */
const VALUE = '예시 항목 1'
const LONG_VALUE = '예시 항목 2 — 훨씬 더 긴 자리표시 문자열'

function entry(overrides: Partial<BlocklistEntry> = {}): BlocklistEntry {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    kind: 'phrase',
    value: VALUE,
    severity: 'block',
    source: null,
    ...overrides,
  }
}

describe('S11_값은_기본으로_가려진다', () => {
  it('펼치지 않은 줄에는 값이 오지 않는다', () => {
    const row = entry()

    expect(displayedValue(row, null)).toBe(MASKED_VALUE)
    expect(displayedValue(row, null)).not.toContain(VALUE)
  })

  it('가린 모양이 값의 길이를 따라가지 않는다 — 길이도 값에 대한 정보다', () => {
    const short = entry({ value: '가' })
    const long = entry({ id: 'other', value: LONG_VALUE })

    expect(displayedValue(short, null)).toBe(displayedValue(long, null))
  })

  it('펼친 줄만 값을 그대로 보인다', () => {
    const row = entry()

    expect(displayedValue(row, row.id)).toBe(VALUE)
  })

  it('한 번에 한 줄만 펼쳐진다 — 상태가 모두 펼치기를 담지 못한다', () => {
    const first = entry({ id: 'a' })
    const second = entry({ id: 'b' })

    const afterFirst = toggleExpanded(null, first.id)
    const afterSecond = toggleExpanded(afterFirst, second.id)

    expect(displayedValue(first, afterSecond)).toBe(MASKED_VALUE)
    expect(displayedValue(second, afterSecond)).toBe(second.value)
  })

  it('같은 줄을 다시 누르면 접힌다', () => {
    expect(toggleExpanded('a', 'a')).toBeNull()
  })
})

describe('지우기는_펼친_줄에만_있다', () => {
  it('가려진 줄에는 지우는 길이 없다 — 잘못 눌러 지우는 일이 구조적으로 없어진다', () => {
    const row = entry()

    expect(rowState(row, null)).toEqual({ revealed: false, canRemove: false })
  })

  it('다른 줄이 펼쳐져 있어도 이 줄은 지울 수 없다', () => {
    const row = entry({ id: 'a' })

    expect(rowState(row, 'b').canRemove).toBe(false)
  })

  it('펼친 줄에서만 지울 수 있다 — 확인 판이 값을 새로 드러내지 않는다', () => {
    const row = entry()

    expect(rowState(row, row.id)).toEqual({ revealed: true, canRemove: true })
  })
})

/**
 * **요청은 대문자, 응답은 소문자다.** 한 쪽 표기로만 라벨을 만들면 다른 쪽이 오류가 아니라
 * 조용한 빈칸이 된다 — 그 어긋남은 화면에서 정상으로 보인다.
 */
describe('표기가_둘인_값의_라벨', () => {
  const RESPONSE_KINDS: readonly BlocklistEntryKind[] = [
    'ip_title',
    'character',
    'real_person',
    'phrase',
  ]
  const RESPONSE_SEVERITIES: readonly BlocklistEntrySeverity[] = ['block', 'warn']

  it('요청 표기 넷이 모두 이름을 갖는다', () => {
    for (const kind of BLOCKLIST_KINDS) {
      expect(kindLabel(kind)).not.toBe('')
      expect(kindLabel(kind)).toBeDefined()
    }
  })

  it('응답 표기 넷도 모두 이름을 갖는다 — 빈칸이 나오지 않는다', () => {
    for (const kind of RESPONSE_KINDS) {
      expect(kindLabel(kind)).not.toBe('')
      expect(kindLabel(kind)).toBeDefined()
    }
  })

  it('같은 값의 두 표기가 같은 이름을 답한다', () => {
    expect(kindLabel('real_person')).toBe(kindLabel('REAL_PERSON'))
    expect(kindLabel('ip_title')).toBe(kindLabel('IP_TITLE'))
    expect(kindLabel('character')).toBe(kindLabel('CHARACTER'))
    expect(kindLabel('phrase')).toBe(kindLabel('PHRASE'))
  })

  it('심각도도 두 표기가 같은 이름을 답한다', () => {
    for (const severity of RESPONSE_SEVERITIES) {
      expect(severityLabel(severity)).not.toBe('')
    }
    expect(severityLabel('warn')).toBe(severityLabel('WARN'))
    expect(severityLabel('block')).toBe(severityLabel('BLOCK'))
    expect(BLOCKLIST_SEVERITIES).toHaveLength(2)
  })

  it('경고는 목록에서도 판정으로 나가지 않는다는 것을 말한다 (§13-31)', () => {
    expect(severityLabel('warn')).toContain('판정 안 함')
    expect(severityLabel('block')).not.toContain('판정 안 함')
  })

  it('출처가 없으면 지어내지 않는다', () => {
    expect(sourceLabel(null)).toBe(MISSING_SOURCE)
    expect(sourceLabel('')).toBe(MISSING_SOURCE)
    expect(sourceLabel('예시 출처 A')).toBe('예시 출처 A')
  })
})

describe('R2_5_정규화는_서버가_한다', () => {
  it('값을 다듬지 않고 그대로 보낸다 — 공백도 대소문자도 그대로다', () => {
    const raw = '  예시 Item 3  '
    const body = buildRegisterRequest({ ...EMPTY_DRAFT, value: raw })

    expect(body.value).toBe(raw)
  })

  it('요청에 정규화 값을 싣지 않는다 — 계약이 받는 넷뿐이다', () => {
    const body = buildRegisterRequest({
      kind: 'REAL_PERSON',
      value: VALUE,
      severity: 'BLOCK',
      source: '예시 출처 A',
    })

    expect(Object.keys(body).sort()).toEqual(['kind', 'severity', 'source', 'value'])
  })

  it('요청은 대문자 표기로 나간다', () => {
    const body = buildRegisterRequest({ ...EMPTY_DRAFT, kind: 'REAL_PERSON', severity: 'WARN' })

    expect(body.kind).toBe('REAL_PERSON')
    expect(body.severity).toBe('WARN')
  })

  it('빈 출처는 빈 문자열이 아니라 null 이다', () => {
    expect(buildRegisterRequest({ ...EMPTY_DRAFT, source: '' }).source).toBeNull()
    expect(buildRegisterRequest({ ...EMPTY_DRAFT, source: '예시 출처 B' }).source).toBe('예시 출처 B')
  })

  it('보낼 것이 없으면 보내지 않는다 — 계약의 minLength 하나만 본다', () => {
    expect(canRegister({ ...EMPTY_DRAFT, value: '' }, false)).toBe(false)
    expect(canRegister({ ...EMPTY_DRAFT, value: VALUE }, false)).toBe(true)
  })

  it('공백만 넣은 값은 화면이 막지 않는다 — 그 판단은 서버가 하고 문장도 서버가 준다 (F-4)', () => {
    expect(canRegister({ ...EMPTY_DRAFT, value: '   ' }, false)).toBe(true)
  })

  it('보내는 중에는 다시 보내지 않는다', () => {
    expect(canRegister({ ...EMPTY_DRAFT, value: VALUE }, true)).toBe(false)
  })

  it('계약의 maxLength 를 넘으면 보내지 않는다', () => {
    const tooLong = '가'.repeat(VALUE_MAX_LENGTH + 1)

    expect(canRegister({ ...EMPTY_DRAFT, value: tooLong }, false)).toBe(false)
    expect(valueCounter('가가가')).toBe(`3 / ${VALUE_MAX_LENGTH}`)
  })
})
