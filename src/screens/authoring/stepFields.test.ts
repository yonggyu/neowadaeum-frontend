import { describe, expect, it } from 'vitest'

import type { DraftPayload } from '../../api/endpoints/authoring'
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
    /**
     * **형을 넓히는 이유** — 계약(#354)이 `title` · `genres` · `characters` 의 형을 세웠지만
     * 그것은 서버가 지키기로 한 약속이지 런타임 검증이 아니다. `request<T>()` 는
     * `response.json()` 을 그대로 `T` 로 단언하고, `DraftPayload` 는 `additionalProperties`
     * 를 **일부러** 열어 두었다 — 다음 단계가 붙일 값을 이 화면이 지우지 않게 하려는 것이라
     * 무엇이 실려 오는지 다 알 수 없다. 그래서 계약이 금지한 형은 **와이어에서 오는 모양**
     * (`Record<string, unknown>`)으로 만들어 그 경계를 그대로 흉내 낸다.
     */
    const wirePayload: Record<string, unknown> = {
      title: 42,
      genres: ['romance', 7],
      characters: 'x',
    }

    const values = readValues(wirePayload as DraftPayload)
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
      characters: [{ name: '마', oneLine: '바', persona: '사', portraitImage: null }],
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

  /**
   * **`persona` 도 검수에 보낸다.** 계약 `PrecheckRequest.fields` 는 경로 → 값의 열린 맵이고
   * (`additionalProperties: {type: string}`) 어떤 경로를 받는지 제한하지 않는다. 그리고 이
   * 값은 **매 턴 모델에게 들어가고 검수자가 보는 것도 이것이다** (계약 `DraftCharacter` ·
   * `ReviewManuscript.characters[].persona`) — 검수 대상이 아니라고 볼 근거가 없다.
   *
   * 보내지 않으면 작성자는 제출 뒤에야 반려로 그 사실을 만난다. R8.1 이 실시간 검수를 둔
   * 이유가 그것이다.
   */
  it('R8_1_persona_도_실시간_검수의_대상이다', () => {
    expect(characterField(0, 'persona')).toBe('characters[0].persona')
  })

  it('자리가_바뀔_때_버릴_경로를_모두_센다', () => {
    expect(characterFieldPaths(2)).toEqual([
      'characters[0].name',
      'characters[0].oneLine',
      'characters[0].persona',
      'characters[1].name',
      'characters[1].oneLine',
      'characters[1].persona',
    ])
    expect(characterFieldPaths(0)).toEqual([])
  })
})

/**
 * 계약 `DraftCharacter` — `persona` 는 **매 턴 모델에게 들어가는 인물 문장**이고 `oneLine` 은
 * 발행되면 독자에게 보이는 값이다 (`CharacterCard.oneLine`). 화면에 `persona` 칸이 없는 동안
 * 한 줄 소개 하나가 두 일을 했다 (#104 · 백엔드 #350).
 */
describe('인물의 persona', () => {
  it('빈_원고에도_persona_자리가_있다_한_줄_소개와_따로_읽고_쓴다', () => {
    const values = readValues({
      characters: [{ name: '유나', oneLine: '옆자리 짝꿍', persona: '먼저 말을 걸지 않는다' }],
    })
    expect(values.characters[0]?.oneLine).toBe('옆자리 짝꿍')
    expect(values.characters[0]?.persona).toBe('먼저 말을 걸지 않는다')
  })

  it('persona_가_없는_옛_원고도_빈_값으로_열린다', () => {
    const values = readValues({ characters: [{ name: '유나', oneLine: '옆자리 짝꿍' }] })
    expect(values.characters[0]?.persona).toBe('')
  })

  /**
   * **비어 있는 것이 오류가 아니다** — 비면 서버가 `oneLine` 을 대신 발행한다 (#350).
   * 그래서 화면은 빈 값을 막지도, 한 줄 소개를 몰래 베껴 넣지도 않는다: 베끼면 작성자가
   * 한 줄 소개를 고친 뒤에도 옛 문장이 프롬프트로 남는다.
   */
  it('persona_가_비어도_저장된다_비면_한_줄_소개가_대신_발행된다_350', () => {
    const values = readValues({ characters: [{ name: '유나', oneLine: '옆자리 짝꿍' }] })
    const saved = writeValues({}, values)
    expect(saved['characters']).toEqual([
      { name: '유나', oneLine: '옆자리 짝꿍', persona: '', portraitImage: null },
    ])
  })

  it('추가한_인물의_persona_는_빈_문자열이다_null_이_아니다', () => {
    expect(emptyCharacter().persona).toBe('')
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
