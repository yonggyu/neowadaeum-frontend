import { describe, expect, it } from 'vitest'

import { limitNotes } from './validationNotice'

/**
 * 저장이 막혔을 때 덧붙이는 줄 (#232 · §13-95 · §13-96).
 *
 * 입력은 `DraftScaleGate` 가 실제로 내는 모양이다 — `{field, reason, max}` 한 항목.
 */
describe('limitNotes', () => {
  it('13_96_상한을_말한다', () => {
    // 계약이 `max` 를 항목에 남긴 이유가 이 한 줄이다. 서버 `message` 는 어느 목록이 몇
    // 개까지인지 말하지 않는다 — 코드당 한 문장으로 고정돼 있기 때문이다.
    expect(
      limitNotes('VALIDATION_ERROR', {
        fields: [{ field: 'chapters', reason: 'too_many', max: 32 }],
      }),
    ).toEqual(['챕터는 32개까지 만들 수 있어요.'])

    expect(
      limitNotes('VALIDATION_ERROR', {
        fields: [{ field: 'endings', reason: 'too_many', max: 16 }],
      }),
    ).toEqual(['엔딩은 16개까지 만들 수 있어요.'])
  })

  it('13_96_상한을_화면이_적지_않는다', () => {
    // `FLAG_MAX_COUNT` 처럼 화면이 아는 숫자를 여기 옮겨 적으면 정본이 둘이 된다. 서버가 준
    // 값만 말하므로, 같은 칸이라도 상한이 오지 않으면 아무 말도 하지 않는다.
    expect(
      limitNotes('VALIDATION_ERROR', { fields: [{ field: 'chapters', reason: 'too_many' }] }),
    ).toEqual([])
  })

  it('F4_reason_을_그리지_않는다', () => {
    const notes = limitNotes('VALIDATION_ERROR', {
      fields: [{ field: 'chapters', reason: 'too_many', max: 32 }],
    })
    expect(notes.join('')).not.toContain('too_many')
  })

  it('F4_서버가_지목하지_않은_칸에는_아무_말도_하지_않는다', () => {
    // `step` · `payload` 는 작성자가 고칠 수 없는 요청 구조다. 표에 없으므로 줄이 서지 않고,
    // 안내는 서버 문장 하나로 남는다.
    expect(
      limitNotes('VALIDATION_ERROR', { fields: [{ field: 'payload', reason: 'must not be null' }] }),
    ).toEqual([])
    expect(limitNotes('VALIDATION_ERROR', {})).toEqual([])
  })

  it('13_96_최상위_reason_에는_말하지_않는다', () => {
    // `fields` 가 없는 쪽. 값의 목록이 계약에 없어(백엔드 #483) 분기하지 않는다.
    expect(limitNotes('VALIDATION_ERROR', { reason: 'missing_default_ending' })).toEqual([])
  })

  it('F4_다른_코드에는_붙지_않는다', () => {
    // 같은 모양의 `details` 가 와도 코드가 다르면 이 줄의 근거가 없다 — §13-96 이 정한 것은
    // `VALIDATION_ERROR` 한 코드다.
    expect(
      limitNotes('DRAFT_LIMIT_REACHED', { fields: [{ field: 'chapters', max: 32 }] }),
    ).toEqual([])
    expect(limitNotes('UNKNOWN', { fields: [{ field: 'chapters', max: 32 }] })).toEqual([])
  })

  it('두_목록이_함께_걸리면_두_줄이다', () => {
    // 지금 `DraftScaleGate` 는 먼저 걸린 하나만 던지지만, 계약이 배열이므로 화면은 둘을
    // 받을 수 있어야 한다 — 배열을 하나로 접으면 나중에 조용히 한 줄을 잃는다.
    expect(
      limitNotes('VALIDATION_ERROR', {
        fields: [
          { field: 'chapters', reason: 'too_many', max: 32 },
          { field: 'endings', reason: 'too_many', max: 16 },
        ],
      }),
    ).toEqual(['챕터는 32개까지 만들 수 있어요.', '엔딩은 16개까지 만들 수 있어요.'])
  })
})
