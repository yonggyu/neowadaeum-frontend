import { describe, expect, it } from 'vitest'

import type { FlagReference } from './outline'
import {
  flagJumpField,
  flagJumpLabel,
  flagReferenceName,
  flagReferenceNote,
  flagRemovalWarning,
  flagRemovedEntirely,
} from './flagsView'

const chapter = (index: number): FlagReference => ({ kind: 'chapter', index })
const ending = (index: number): FlagReference => ({ kind: 'ending', index })

describe('flagReferenceName', () => {
  it('번호는_자리_더하기_하나다', () => {
    expect(flagReferenceName(chapter(2))).toBe('챕터 3')
    expect(flagReferenceName(ending(1))).toBe('엔딩 2')
  })
})

describe('flagReferenceNote — 7차 A-1 D-4', () => {
  it('가리키는_것이_없으면_줄이_없다', () => {
    expect(flagReferenceNote([])).toBeNull()
  })

  it('가리키는_자리를_이름으로_늘어놓는다', () => {
    expect(flagReferenceNote([ending(1), chapter(2)])).toBe(
      '엔딩 2 · 챕터 3 의 조건이 이 이름을 가리킵니다',
    )
  })
})

describe('flagRemovalWarning — 7차 A-1 D-5', () => {
  /** 되돌릴 것이 없는 자리에 판을 띄우면 다음부터 아무도 읽지 않는다 */
  it('가리키는_조건이_없으면_판을_띄우지_않는다', () => {
    expect(flagRemovalWarning([])).toBeNull()
  })

  it('무엇을_잃는지_한_문장으로_말한다', () => {
    expect(flagRemovalWarning([ending(2)])).toBe(
      '엔딩 3 의 조건이 이 이름을 가리킵니다. 지우면 그 조건이 비워집니다.',
    )
  })
})

describe('flagRemovedEntirely', () => {
  it('하나뿐인_이름을_지우면_원고에서_사라진다', () => {
    expect(flagRemovedEntirely(['첫째표시', '둘째표시'], 0)).toBe(true)
  })

  /** 계약이 같은 이름을 두 번 적는 것을 막지 않는다 — 화면이 계약보다 좁히지 않는다 */
  it('같은_이름이_남으면_사라지지_않는다', () => {
    expect(flagRemovedEntirely(['첫째표시', '첫째표시'], 0)).toBe(false)
  })

  it('없는_자리는_지울_것도_없다', () => {
    expect(flagRemovedEntirely([], 0)).toBe(false)
  })

  /** 빈 줄도 값이다 — "추가" 가 먼저 만드는 것이 그것이고, 빈 줄 둘은 같은 이름 둘이다 */
  it('빈_줄이_둘이면_하나를_지워도_빈_이름은_남는다', () => {
    expect(flagRemovedEntirely(['', ''], 1)).toBe(false)
  })
})

describe('flagJumpField', () => {
  /** DOM id 가 곧 계약의 필드 경로다 — 우측 검수 패널이 쓰는 것과 같은 길 */
  it('그_카드의_첫_칸을_가리킨다', () => {
    expect(flagJumpField(chapter(2))).toBe('chapters[2].title')
    expect(flagJumpField(ending(2))).toBe('endings[2].label')
  })
})

describe('flagJumpLabel', () => {
  /** 아트보드가 그린 한 줄 */
  it('아트보드의_엔딩_3_으로_를_그대로_낸다', () => {
    expect(flagJumpLabel(ending(2))).toBe('엔딩 3 으로')
  })

  /** 3 하나를 그대로 옮기면 "엔딩 2 으로" 가 나온다 — 그것은 디자인이 아니라 오타다 */
  it('받침_없는_숫자에는_로_가_붙는다', () => {
    expect(flagJumpLabel(ending(1))).toBe('엔딩 2 로')
    expect(flagJumpLabel(chapter(3))).toBe('챕터 4 로')
  })

  it('십은_받침이_있다', () => {
    expect(flagJumpLabel(chapter(9))).toBe('챕터 10 으로')
  })
})
