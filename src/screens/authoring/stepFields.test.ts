import { describe, expect, it } from 'vitest'

import type { DraftPayload } from '../../api/endpoints/authoring'
import {
  addFlag,
  characterField,
  conditionSources,
  characterFieldPaths,
  emptyCharacter,
  flagField,
  flagFieldPaths,
  flagPrecheckFields,
  FLAG_MAX_COUNT,
  FLAG_NAME_MAX,
  isNearLimit,
  moveCharacter,
  readValues,
  removeFlag,
  setFlag,
  SETTING_DETAIL_MAX,
  SHORT_DESCRIPTION_MAX,
  toggleGenre,
  WORLD_INTRO_MAX,
  writeValues,
  type CharacterDraft,
  type StepValues,
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
      flags: ['아'],
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

/**
 * 조건이 고를 수 있는 이름 (#131).
 *
 * **후보와 저장이 갈려 있었다.** 후보를 만드는 자리는 인물 이름을 `trim()` 했고 저장하는
 * 자리는 작성자가 친 그대로를 실었다 — `" 유나 "` 를 적으면 드롭다운에는 `유나` 가 서고,
 * 그것을 고른 조건은 원고의 `characters[].name` **밖**을 가리켰다 (계약 `ConditionParams` —
 * 밖을 가리키면 `400`). 증상은 저장 실패가 아니라 **조용한 사라짐**이었다: `writableCondition`
 * (#98)이 원고 밖을 가리키는 조건을 *고르지 않은 것과 같은 모양*으로 저장하므로, 작성자가 고른
 * 조건이 사라지고 Step 4 에서 "도달 조건이 필요합니다" 만 다시 떴다.
 *
 * **다듬는 쪽이 아니라 다듬지 않는 쪽으로 맞춘다.** 저장을 다듬어 맞추는 것은 작성자가 친 것을
 * 화면이 조용히 고치는 것이고, 문자 집합을 좁히지 않기로 한 판단(§13-73 · S-7)과 어긋난다.
 *
 * 아래 테스트가 붙잡는 것은 **두 함수의 대응**이다 — 한쪽만 바뀌면 깨진다.
 */
describe('conditionSources — 후보와 저장의 대응 (#131)', () => {
  const step3 = (names: readonly string[], flags: readonly string[] = []): StepValues => ({
    ...readValues({}),
    characters: names.map(character),
    flags: [...flags],
  })

  it('F131_후보를_다듬지_않는다_앞뒤_공백까지_저장되는_이름_그대로다', () => {
    expect(conditionSources(step3([' 유나 '])).characters).toEqual([' 유나 '])
    // 다듬은 이름은 원고 어디에도 없다 — 그것을 고른 조건은 없는 이름을 가리킨다
    expect(conditionSources(step3([' 유나 '])).characters).not.toContain('유나')
  })

  it('F131_후보는_writeValues_가_싣는_이름_안에_글자_하나까지_같은_것이_있다', () => {
    const values = step3([' 유나 ', '민', '유나', ''], ['  봄  ', '봄', ''])
    const saved = writeValues({}, values)
    const names = (saved['characters'] as readonly CharacterDraft[]).map((c) => c.name)

    for (const candidate of conditionSources(values).characters) {
      expect(names).toContain(candidate)
    }
    for (const candidate of conditionSources(values).flags) {
      expect(saved['flags']).toContain(candidate)
    }
  })

  /**
   * 서버가 **빈 항목을 건너뛴다** (§13-71 *"이름이 빈 항목은 인물이 아니다"* · §13-73 #4).
   * 건너뛴 이름은 선언되지 않았으므로 조건이 가리킬 수 없다 — 후보에 세우면 고르는 순간
   * 다시 원고 밖을 가리키게 되고, "추가" 를 누른 직후의 빈 줄이 드롭다운에 빈 칸으로 선다.
   * 공백뿐인 이름도 같은 자리다.
   */
  it('F131_선언되지_않는_이름은_후보가_아니다_인물과_플래그가_같은_규칙이다', () => {
    expect(conditionSources(step3(['유나', '', '   '], ['봄', '', '  ']))).toEqual({
      characters: ['유나'],
      flags: ['봄'],
    })
  })

  /** 세지 않는 것과 다듬는 것은 다르다 — 남는 이름은 그대로 남는다 */
  it('F131_빈_줄을_빼도_남은_이름은_다듬지_않는다', () => {
    expect(conditionSources(step3([' 유나 ', ''], ['  봄  ', ''])).characters).toEqual([' 유나 '])
    expect(conditionSources(step3([' 유나 ', ''], ['  봄  ', ''])).flags).toEqual(['  봄  '])
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

/**
 * 원고가 선언하는 플래그 (#125 · 백엔드 #362 · 정정본 §13-73).
 *
 * 픽스처는 **명백한 가짜**로 둔다 (S-11) — 이 레포는 공개다.
 */
describe('Step 3 의 플래그 선언 — 계약 DraftPayload.flags', () => {
  it('S1_플래그를_문자열_배열로_보낸다_인물처럼_객체로_감싸지_않는다', () => {
    /**
     * §13-73 이 직접 경고한 실수다 — 인물이 객체 배열이므로 화면이 플래그도 같은 모양으로
     * 보내는 것은 **있을 법한 일**이고, 객체로 오면 서버는 이름을 찾지 못해 **조용히 빈
     * 목록**이 된다. 그러면 작성자가 고른 `has_flag` 는 *없는 이름을 가리킨다* 는 이유로
     * 거절되고, 작성자가 보는 것은 "플래그를 적었는데 그 이름이 없다고 한다" 뿐이다.
     */
    const saved = writeValues({}, { ...readValues({}), flags: ['첫번째표시', '두번째표시'] })
    expect(saved['flags']).toEqual(['첫번째표시', '두번째표시'])
  })

  it('S1_문자열이_아닌_항목은_고를_수_없는_이름이므로_읽지_않는다', () => {
    // `readValues` 의 다른 자리와 같은 이유로 형을 넓힌다 — 계약이 형을 세웠지만 그것은
    // 서버의 약속이지 런타임 검증이 아니다.
    const wirePayload: Record<string, unknown> = { flags: ['첫번째표시', 7, null] }
    expect(readValues(wirePayload as DraftPayload).flags).toEqual(['첫번째표시'])
  })

  it('flags_가_없는_옛_원고도_빈_목록으로_열린다', () => {
    expect(readValues({ title: '가' }).flags).toEqual([])
    expect(readValues(undefined).flags).toEqual([])
  })

  it('읽고_다시_쓰는_왕복에서_플래그가_보존된다', () => {
    const payload = { flags: ['첫번째표시', '두번째표시'] }
    expect(writeValues(payload, readValues(payload))['flags']).toEqual([
      '첫번째표시',
      '두번째표시',
    ])
  })

  /**
   * **계약이 화면을 이긴다** (CLAUDE.md). 7차 아트보드는 `3 / 12` 를 그렸지만 그 그림은
   * #362 이전의 것이라 계약에 숫자가 없던 때다 — `DraftPayload.flags` 의 `maxItems` 는 32,
   * 항목의 `maxLength` 는 40 이다.
   */
  it('S2_상한은_계약의_값이다_아트보드의_12_가_아니다', () => {
    expect([FLAG_MAX_COUNT, FLAG_NAME_MAX]).toEqual([32, 40])
  })

  /**
   * **화면이 빈 줄을 막지 않는다** (S-6, §13-73 #4 · §13-71). "추가" 가 빈 줄을 먼저 만드는
   * 화면이므로 막으면 줄을 하나 더한 순간 저장이 멈춘다 — 서버가 빈 항목을 건너뛴다.
   */
  it('S6_빈_항목을_화면이_버리지_않는다_서버가_건너뛴다', () => {
    const saved = writeValues({}, { ...readValues({}), flags: ['첫번째표시', '', '두번째표시'] })
    expect(saved['flags']).toEqual(['첫번째표시', '', '두번째표시'])
    expect(addFlag(['첫번째표시'])).toEqual(['첫번째표시', ''])
  })

  /**
   * **값을 다듬지 않는다.** 판정은 서버가 하고 문장도 서버가 준다 (F-4). 화면이 몰래 떼면
   * 작성자가 친 이름과 서버가 검증하는 이름이 갈라지고, 그 차이는 조건이 거절될 때까지
   * 보이지 않는다. 문자 집합도 좁히지 않는다 (S-7).
   */
  it('S7_값에_trim_이_걸리지_않는다_문장부호가_섞인_이름도_그대로_나간다', () => {
    const values = readValues({ flags: ['  앞뒤 공백  ', '쉼표, 물음표?'] })
    expect(values.flags).toEqual(['  앞뒤 공백  ', '쉼표, 물음표?'])
    expect(writeValues({}, values)['flags']).toEqual(['  앞뒤 공백  ', '쉼표, 물음표?'])
  })

  it('한_줄을_고치고_지운다_나머지_줄은_그대로다', () => {
    expect(setFlag(['첫번째표시', '두번째표시'], 1, '고친표시')).toEqual([
      '첫번째표시',
      '고친표시',
    ])
    expect(removeFlag(['첫번째표시', '두번째표시', '세번째표시'], 1)).toEqual([
      '첫번째표시',
      '세번째표시',
    ])
  })

  /** 배열 표기는 계약 `PrecheckRequest.fields` 의 예시 형식이며 DOM id 도 이 값이다. */
  it('F2_배열_표기를_지어내지_않는다', () => {
    expect(flagField(0)).toBe('flags[0]')
    expect(flagField(2)).toBe('flags[2]')
    expect(flagFieldPaths(3)).toEqual(['flags[0]', 'flags[1]', 'flags[2]'])
    // 줄이 없으면 버릴 자리도 없다 — 음수를 받아도 배열을 만들지 않는다
    expect(flagFieldPaths(0)).toEqual([])
    expect(flagFieldPaths(-1)).toEqual([])
  })
})

/**
 * 플래그가 실시간 검수를 지난다 (#130 · 정정본 §13-75).
 *
 * §13-75 는 **L1 에 `flags[]` 를 걸면서** 같은 절에 *"L0 은 화면이 넘긴 필드 지도를 검사하므로
 * 화면이 안 넘기는 칸은 L0 도 지나지 않는다"* 고 적었다. 그래서 이 목록이 짧으면 작성자는
 * 다섯 스텝을 다 지나고 **제출한 뒤에야** 이름 하나로 반려된다.
 *
 * 아래가 붙잡는 것은 **두 검수가 보는 값의 집합**이다. 번호는 어긋날 수 있다 — L1 은 선언
 * 목록(빈 줄과 중복을 접은 것)의 자리로 세고 화면은 화면의 줄로 센다 (§13-75 #4 — *경로는
 * 밑줄을 그을 자리를 가리키는 값*). 어긋나면 안 되는 것은 **무엇이 검사되는가**다.
 */
describe('플래그의 L0 — 화면이 넘기는 필드 지도 (#130)', () => {
  /** 서버가 L1 에 거는 값 — `DraftStateSchema` 가 빈 항목을 건너뛰고 집합으로 읽는다 (§13-73) */
  const screenedByL1 = (flags: readonly string[]): Set<string> =>
    new Set(flags.filter((flag) => flag.trim() !== ''))

  it('F130_선언된_이름이_전부_L0_에_실린다_L1_이_거는_것과_같은_집합이다', () => {
    const flags = ['첫번째표시', '두번째표시', '세번째표시']
    const sent = flagPrecheckFields(flags)

    expect(new Set(sent.map((field) => field.value))).toEqual(screenedByL1(flags))
    // 경로는 **화면의 줄**이다 — 그 값이 곧 DOM id 이고 밑줄이 그어질 자리다 (§13-75 #4)
    expect(sent.map((field) => field.field)).toEqual(['flags[0]', 'flags[1]', 'flags[2]'])
  })

  /**
   * **빈 칸에 밑줄을 보게 하지 않는다** (§13-71 이 인물에서 금지한 것). 서버도 빈 항목을
   * 건너뛰므로 (§13-73 #4) 넘기지 않는 편이 L1 과도 같다 — "추가" 가 빈 줄을 먼저 만드는
   * 화면이라 그 상태는 예외가 아니라 기본값이다.
   */
  it('F130_빈_줄은_넘기지_않는다_공백뿐인_줄도_같다', () => {
    const flags = ['첫번째표시', '', '   ', '두번째표시']
    const sent = flagPrecheckFields(flags)

    expect(sent.map((field) => field.field)).toEqual(['flags[0]', 'flags[3]'])
    expect(new Set(sent.map((field) => field.value))).toEqual(screenedByL1(flags))
  })

  /**
   * **같은 이름이 둘이면 두 줄 다 넘긴다.** 두 줄이 화면에 서 있고 둘 다 밑줄을 받아야 한다 —
   * 서버가 보는 값의 집합은 그래도 같다. 후보를 이름으로 접는 것(#144)과 다른 자리다.
   */
  it('F130_같은_이름_두_줄은_둘_다_자기_자리를_받는다_검사되는_값은_같다', () => {
    const flags = ['첫번째표시', '첫번째표시']
    const sent = flagPrecheckFields(flags)

    expect(sent.map((field) => field.field)).toEqual(['flags[0]', 'flags[1]'])
    expect(new Set(sent.map((field) => field.value))).toEqual(screenedByL1(flags))
  })

  /** 값을 다듬지 않는다 (S-7 · §13-73 #3) — 검사되는 것은 작성자가 친 그대로여야 한다 */
  it('F130_넘기는_값을_다듬지_않는다', () => {
    expect(flagPrecheckFields([' 첫번째표시 '])).toEqual([
      { field: 'flags[0]', value: ' 첫번째표시 ' },
    ])
  })
})

/**
 * 조건 후보를 이름으로 접는다 (#144 — `#132` 의 나머지).
 *
 * `#132` 가 `<option key>` 의 겹침을 고쳤지만 **보이는 쪽은 그대로였다** — 글자가 똑같은
 * 항목이 두 줄 섰고, 계약이 받는 것은 이름이므로 (`ConditionParams`) 고르는 결과도 같았다.
 * **두 줄이 서 있다는 것 자체가 거짓 정보다.**
 */
describe('conditionSources — 같은 이름은 한 줄이다 (#144)', () => {
  const step3 = (names: readonly string[], flags: readonly string[] = []): StepValues => ({
    ...readValues({}),
    characters: names.map(character),
    flags: [...flags],
  })

  it('F144_같은_이름은_한_줄로_선다_인물과_플래그가_같은_규칙이다', () => {
    expect(conditionSources(step3(['유나', '유나', '민'], ['봄', '봄']))).toEqual({
      characters: ['유나', '민'],
      flags: ['봄'],
    })
  })

  /** 남는 것은 **처음 나온 자리**의 것이다 — 서버의 `LinkedHashSet` 과 같은 순서다 */
  it('F144_처음_나온_순서를_지킨다', () => {
    expect(conditionSources(step3([], ['봄', '여름', '봄', '가을'])).flags).toEqual([
      '봄',
      '여름',
      '가을',
    ])
  })

  /**
   * **다르게 친 이름은 다른 이름이다.** 접는 것은 세는 방식이지 다듬는 것이 아니다 —
   * 앞뒤 공백이 다르면 원고에 서로 다른 두 이름이 들어가고, 조건은 그중 하나를 가리킨다.
   */
  it('F144_접는_것은_다듬는_것이_아니다_공백이_다르면_다른_이름이다', () => {
    expect(conditionSources(step3([], [' 봄 ', '봄'])).flags).toEqual([' 봄 ', '봄'])
  })

  /** #131 의 대응은 그대로다 — 남은 후보는 모두 `writeValues` 가 싣는 이름 그대로 있다 */
  it('F144_접어도_후보는_writeValues_가_싣는_이름_그대로다_131_의_대응', () => {
    const values = step3(['유나', '유나'], ['봄', '봄', ''])
    const saved = writeValues({}, values)
    const names = (saved['characters'] as readonly CharacterDraft[]).map((c) => c.name)

    for (const candidate of conditionSources(values).characters) expect(names).toContain(candidate)
    for (const candidate of conditionSources(values).flags) {
      expect(saved['flags']).toContain(candidate)
    }
  })
})
