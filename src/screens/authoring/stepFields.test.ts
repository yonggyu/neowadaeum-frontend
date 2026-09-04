import { describe, expect, it } from 'vitest'

import {
  characterField,
  characterFieldPaths,
  emptyCharacter,
  isNearLimit,
  moveCharacter,
  readValues,
  SETTING_DETAIL_MAX,
  SHORT_DESCRIPTION_MAX,
  toggleGenre,
  WORLD_INTRO_MAX,
  writeValues,
  type CharacterDraft,
} from './stepFields'

const character = (name: string): CharacterDraft => ({ ...emptyCharacter(), name })

describe('payload 를 화면의 값으로', () => {
  it('빈_원고가_기본값이다_createDraft_에는_본문이_없다', () => {
    const values = readValues(undefined)
    expect(values.title).toBe('')
    expect(values.genres).toEqual([])
    expect(values.characters).toEqual([])
    expect(values.coverImage).toBeNull()
  })

  it('다른_타입이_와도_빈_값으로_읽는다', () => {
    const values = readValues({ title: 42, genres: ['romance', 7], characters: 'x' })
    expect(values.title).toBe('')
    expect(values.genres).toEqual(['romance'])
    expect(values.characters).toEqual([])
  })

  /**
   * `PATCH` 는 payload 를 통째로 받는다. Step 4·5 의 입력은 같은 payload 안에 있으므로,
   * 아는 키만 남기면 이 화면이 다음 이슈의 값을 매번 지운다.
   */
  it('모르는_키를_지우지_않는다_Step_4_5_가_같은_payload_에_있다', () => {
    const saved = writeValues({ chapters: [{ chapterNo: 1 }] }, readValues({ title: '가' }))
    expect(saved['chapters']).toEqual([{ chapterNo: 1 }])
    expect(saved['title']).toBe('가')
  })

  it('읽고_다시_쓰면_같은_값이_남는다', () => {
    const payload = {
      title: '가',
      genres: ['romance'],
      shortDescription: '나',
      coverImage: null,
      worldIntro: '다',
      settingDetail: '라',
      characters: [{ name: '마', oneLine: '바', portraitImage: null }],
    }
    expect(writeValues(payload, readValues(payload))).toEqual(payload)
  })
})

describe('필드 경로', () => {
  /** 계약 `PrecheckRequest.fields` 의 예시가 `characters[0].name` 이다 — 형식을 지어내지 않는다. */
  it('F2_계약이_적은_배열_표기를_그대로_쓴다', () => {
    expect(characterField(0, 'name')).toBe('characters[0].name')
    expect(characterField(2, 'oneLine')).toBe('characters[2].oneLine')
  })

  it('자리가_바뀔_때_버릴_경로를_모두_센다', () => {
    expect(characterFieldPaths(2)).toEqual([
      'characters[0].name',
      'characters[0].oneLine',
      'characters[1].name',
      'characters[1].oneLine',
    ])
    expect(characterFieldPaths(0)).toEqual([])
  })
})

describe('Step 1 · 2 의 값', () => {
  it('장르는_다중_선택이며_고른_순서로_쌓인다', () => {
    expect(toggleGenre(['romance'], 'fantasy')).toEqual(['romance', 'fantasy'])
    expect(toggleGenre(['romance', 'fantasy'], 'romance')).toEqual(['fantasy'])
  })

  it('3d_글자_수_상한은_와이어프레임이_적은_셋이다', () => {
    expect([SHORT_DESCRIPTION_MAX, WORLD_INTRO_MAX, SETTING_DETAIL_MAX]).toEqual([40, 300, 1500])
  })

  it('3d_상한이_가까우면_알린다', () => {
    expect(isNearLimit(1480, SETTING_DETAIL_MAX)).toBe(true)
    expect(isNearLimit(900, SETTING_DETAIL_MAX)).toBe(false)
  })
})

describe('Step 3 의 순서 변경', () => {
  it('한_칸씩_옮긴다', () => {
    const list = [character('가'), character('나'), character('다')]
    expect(moveCharacter(list, 2, 1).map((c) => c.name)).toEqual(['가', '다', '나'])
  })

  it('범위를_벗어나면_그대로_둔다_첫_항목의_위로가_배열을_뒤집지_않는다', () => {
    const list = [character('가'), character('나')]
    expect(moveCharacter(list, 0, -1).map((c) => c.name)).toEqual(['가', '나'])
    expect(moveCharacter(list, 1, 2).map((c) => c.name)).toEqual(['가', '나'])
  })
})
