import { describe, expect, it } from 'vitest'

import type { ConditionTemplateSpec, DraftPayload, OutlineResponse } from '../../api/endpoints/authoring'
import {
  chapterField,
  chapterFieldPaths,
  chaptersMissingSeed,
  conditionIncomplete,
  emptyChapter,
  emptyEnding,
  endingField,
  endingsMissingCondition,
  fromOutlineResponse,
  parameterOptions,
  readOutline,
  setConditionParam,
  setConditionTemplate,
  setDefaultEnding,
  templateBlockedReason,
  writeOutline,
  type ChapterDraft,
  type ConditionSources,
  type EndingDraft,
} from './outline'

/**
 * `getAuthoringMetadata` 가 주는 모양 그대로 (정정본 §13-56).
 *
 * **라벨을 테스트가 지어내도 되는 이유**는 이것이 서버 응답의 자리이기 때문이다 — 화면이
 * 이 문자열을 만들지 않는다는 것이 아래 테스트가 붙잡는 것이다.
 */
const AFFINITY: ConditionTemplateSpec = {
  key: 'affinity_at_least',
  label: '호감도 이상',
  description: '대상 인물의 호감도가 임계값 이상이면 참입니다.',
  parameters: [
    { name: 'character', type: 'character', label: '인물' },
    { name: 'threshold', type: 'integer', label: '임계값' },
  ],
}

const HAS_FLAG: ConditionTemplateSpec = {
  key: 'has_flag',
  label: '플래그 있음',
  description: '플래그가 켜져 있으면 참입니다.',
  parameters: [{ name: 'flag', type: 'flag', label: '플래그' }],
}

const TURN: ConditionTemplateSpec = {
  key: 'turn_at_least',
  label: '턴 수 이상',
  description: '진행한 턴이 임계값 이상이면 참입니다.',
  parameters: [{ name: 'threshold', type: 'integer', label: '턴 수' }],
}

const TEMPLATES = [AFFINITY, HAS_FLAG, TURN]

/** 이 원고가 선언한 이름들 — 서버의 검증도 같은 목록을 본다 (계약 `ConditionParams`). */
const SOURCES: ConditionSources = { characters: ['유나', '민'], flags: ['봄'] }

const ending = (label: string, patch: Partial<EndingDraft> = {}): EndingDraft => ({
  ...emptyEnding(),
  label,
  ...patch,
})

const chapter = (title: string, patch: Partial<ChapterDraft> = {}): ChapterDraft => ({
  ...emptyChapter(),
  title,
  summarySeed: '씨앗',
  ...patch,
})

/** 저장된 챕터·엔딩 한 줄을 그대로 본다 — 계약이 정한 자리에 무엇이 실렸는가. */
const written = (payload: Record<string, unknown>, key: 'chapters' | 'endings') =>
  payload[key] as Record<string, unknown>[]

describe('payload 를 화면의 값으로 (Step 4)', () => {
  it('초안을_한_번도_받지_않은_원고가_기본값이다', () => {
    expect(readOutline(undefined)).toEqual({ chapters: [], endings: [] })
  })

  it('다른_타입이_와도_빈_값으로_읽는다', () => {
    /**
     * **형을 넓히는 이유** — 계약(#354)이 `chapters` · `endings` 의 형을 세웠지만 그것은
     * 서버가 지키기로 한 약속이지 런타임 검증이 아니다. `request<T>()` 는 `response.json()`
     * 을 그대로 `T` 로 단언하고, `DraftPayload` 는 `additionalProperties` 를 **일부러**
     * 열어 두었다 — 다음 단계가 붙일 값을 이전 단계 화면이 지우지 않게 하려는 것이라
     * 무엇이 실려 오는지 이 화면이 다 알 수 없다. 그래서 계약이 금지한 형은 **와이어에서
     * 오는 모양**(`Record<string, unknown>`)으로 만들어 그 경계를 그대로 흉내 낸다.
     */
    const wirePayload: Record<string, unknown> = { chapters: 'x', endings: [42, { label: '봄' }] }

    const values = readOutline(wirePayload as DraftPayload)
    expect(values.chapters).toEqual([])
    expect(values.endings).toEqual([emptyEnding(), ending('봄')])
  })

  /**
   * `PATCH` 는 payload 를 통째로 받는다. Step 1~3 의 값과 Step 5 가 더할 값이 같은 payload
   * 안에 있으므로, 아는 키만 남기면 이 단계가 나머지를 매번 지운다.
   */
  it('모르는_키를_지우지_않는다', () => {
    const payload = writeOutline(
      { title: '봄이 오기 전에', characters: [] },
      { chapters: [], endings: [] },
      TEMPLATES,
      SOURCES,
    )
    expect(payload['title']).toBe('봄이 오기 전에')
    expect(payload['characters']).toEqual([])
  })

  /** 번호의 뜻은 순서다 — 그래서 배열의 자리에서 한 번만 만든다 (계약 `OutlineChapter.chapterNo`). */
  it('chapterNo_와_endingNo_는_배열의_자리에서_매겨진다', () => {
    const payload = writeOutline(
      undefined,
      {
        chapters: [chapter('돌아온 캠퍼스'), chapter('같은 강의실')],
        endings: [ending('봄이 오기 전에', { isDefault: true }), ending('다른 봄')],
      },
      TEMPLATES,
      SOURCES,
    )
    expect(payload['chapters']).toEqual([
      {
        chapterNo: 1,
        title: '돌아온 캠퍼스',
        summarySeed: '씨앗',
        conditionTemplateKey: null,
        conditionParams: {},
      },
      {
        chapterNo: 2,
        title: '같은 강의실',
        summarySeed: '씨앗',
        conditionTemplateKey: null,
        conditionParams: {},
      },
    ])
    expect(payload['endings']).toEqual([
      {
        endingNo: 1,
        label: '봄이 오기 전에',
        epilogueText: null,
        isDefault: true,
        conditionTemplateKey: null,
        conditionParams: {},
      },
      {
        endingNo: 2,
        label: '다른 봄',
        epilogueText: null,
        isDefault: false,
        conditionTemplateKey: null,
        conditionParams: {},
      },
    ])
  })

  /** 계약의 `epilogueText` 는 `string | null` 이다. 빈 문자열을 "쓴 적 있음" 으로 남기지 않는다. */
  it('빈_에필로그는_null_로_나간다', () => {
    const payload = writeOutline(
      undefined,
      { chapters: [], endings: [ending('봄')] },
      TEMPLATES,
      SOURCES,
    )
    expect(written(payload, 'endings')[0]?.['epilogueText']).toBeNull()
  })
})

/**
 * 조건은 `conditionTemplateKey` 와 `conditionParams` **형제 필드**로 나간다 (계약
 * `DraftChapter` · `DraftEnding`, 정정본 §13-70). 한때 §13-69 가 이것을 한 겹 접었다가 물렸다.
 */
describe('고른 조건을 저장할 때 — 계약 DraftChapter · DraftEnding', () => {
  it('§13-70_형제_필드로_쓴다', () => {
    const picked = setConditionParam(
      setConditionParam(
        setConditionTemplate(chapter('돌아온 캠퍼스'), 'affinity_at_least'),
        'character',
        '유나',
      ),
      'threshold',
      30,
    )
    const row = written(
      writeOutline(undefined, { chapters: [picked], endings: [] }, TEMPLATES, SOURCES),
      'chapters',
    )[0]
    expect(row?.['conditionTemplateKey']).toBe('affinity_at_least')
    expect(row?.['conditionParams']).toEqual({ character: '유나', threshold: 30 })
    // 계약이 접지 않기로 한 자리다 — 받은 모양과 보내는 모양이 같아야 한다 (§13-70).
    expect(row).not.toHaveProperty('condition')
  })

  /**
   * 서버는 저장 시점에 조건을 조립하고 슬롯이 비면 `400` 이다. 고르는 중인 조건을 실어
   * 보내면 저장 자체가 막혀 작성자가 단계를 넘길 수 없다.
   */
  it('ConditionParams_슬롯이_덜_찬_조건은_저장에_실리지_않는다', () => {
    const halfway = setConditionTemplate(ending('봄'), 'affinity_at_least')
    const row = written(
      writeOutline(undefined, { chapters: [], endings: [halfway] }, TEMPLATES, SOURCES),
      'endings',
    )[0]
    expect(row?.['conditionTemplateKey']).toBeNull()
    expect(row?.['conditionParams']).toEqual({})
  })

  /** 계약 `ConditionTemplateKey` — *"목록에 없는 키는 `400` 이다."* 보내지 않는다. */
  it('ConditionTemplateKey_서버가_더는_선언하지_않는_키는_저장에_실리지_않는다', () => {
    const stale = setConditionParam(setConditionTemplate(ending('봄'), 'has_flag'), 'flag', '봄')
    const row = written(
      writeOutline(undefined, { chapters: [], endings: [stale] }, [TURN], SOURCES),
      'endings',
    )[0]
    expect(row?.['conditionTemplateKey']).toBeNull()
  })

  /** 계약 `ConditionParams` — *"정수. 문자열로 온 숫자를 받지 않는다."* */
  it('ConditionParams_문자열로_온_숫자는_임계값으로_치지_않는다', () => {
    const wrongType = setConditionParam(
      setConditionTemplate(ending('봄'), 'turn_at_least'),
      'threshold',
      '5',
    )
    expect(conditionIncomplete(wrongType, TEMPLATES, SOURCES)).toBe(true)
    const row = written(
      writeOutline(undefined, { chapters: [], endings: [wrongType] }, TEMPLATES, SOURCES),
      'endings',
    )[0]
    expect(row?.['conditionTemplateKey']).toBeNull()
  })

  /** `ConditionTemplateKey` — *"`null` 은 오류가 아니다."* 조건이 없어도 저장은 된다. */
  it('ConditionTemplateKey_조건_없음은_오류가_아니다', () => {
    const row = written(
      writeOutline(undefined, { chapters: [chapter('하나')], endings: [] }, TEMPLATES, SOURCES),
      'chapters',
    )[0]
    expect(row?.['conditionTemplateKey']).toBeNull()
    expect(row?.['conditionParams']).toEqual({})
  })

  it('R7_16_§13-16_기본_엔딩은_조건을_싣지_않는다', () => {
    const picked = setConditionParam(
      setConditionTemplate(ending('봄'), 'turn_at_least'),
      'threshold',
      5,
    )
    const [asDefault] = setDefaultEnding([picked], 0)
    const row = written(
      writeOutline(undefined, { chapters: [], endings: [asDefault!] }, TEMPLATES, SOURCES),
      'endings',
    )[0]
    expect(row?.['isDefault']).toBe(true)
    expect(row?.['conditionTemplateKey']).toBeNull()
  })
})

/**
 * 이름은 **그 원고가 선언한 것**이어야 한다 (계약 `ConditionParams`). 인물을 지우거나 이름을
 * 바꾸면 그 조건은 아무도 가리키지 않게 되고, 서버는 `400` 으로 거절한다 — 받아 두었다면 그
 * 조건은 평가기에서 조용히 거짓이 되어 그 엔딩이 영원히 나오지 않는다.
 */
describe('인물이 사라졌을 때의 조건', () => {
  const stale = ending('봄', {
    conditionTemplateKey: 'affinity_at_least',
    conditionParams: { character: '지운 사람', threshold: 30 },
  })

  it('ConditionParams_원고_밖의_이름을_가리키면_완성되지_않은_조건이다', () => {
    expect(conditionIncomplete(stale, TEMPLATES, SOURCES)).toBe(true)
    expect(endingsMissingCondition([stale], TEMPLATES, SOURCES)).toEqual([0])
  })

  /** **화면이 조용히 고치지 않는다.** 남은 인물로 옮겨 붙이면 고르지 않은 조건이 발행된다. */
  it('ConditionParams_비슷한_이름으로_옮겨_붙이지_않고_저장에서_뺀다', () => {
    const row = written(
      writeOutline(undefined, { chapters: [], endings: [stale] }, TEMPLATES, SOURCES),
      'endings',
    )[0]
    expect(row?.['conditionTemplateKey']).toBeNull()
    expect(row?.['conditionParams']).toEqual({})
  })

  it('이름이_그대로_남아_있으면_조건도_그대로다', () => {
    const kept = ending('봄', {
      conditionTemplateKey: 'affinity_at_least',
      conditionParams: { character: '유나', threshold: 30 },
    })
    expect(conditionIncomplete(kept, TEMPLATES, SOURCES)).toBe(false)
    const row = written(
      writeOutline(undefined, { chapters: [], endings: [kept] }, TEMPLATES, SOURCES),
      'endings',
    )[0]
    expect(row?.['conditionParams']).toEqual({ character: '유나', threshold: 30 })
  })

  /** 플래그도 같다 — 원고가 선언하지 않은 플래그는 고를 수 없는 값이다. */
  it('ConditionParams_원고가_선언하지_않은_플래그도_같다', () => {
    const unknownFlag = ending('봄', {
      conditionTemplateKey: 'has_flag',
      conditionParams: { flag: '없는 플래그' },
    })
    expect(conditionIncomplete(unknownFlag, TEMPLATES, SOURCES)).toBe(true)
  })
})

describe('AI 초안 응답 (outlineDraft)', () => {
  it('응답이_준_순서를_그대로_쓴다', () => {
    const response: OutlineResponse = {
      chapters: [
        { chapterNo: 2, title: '같은 강의실', summarySeed: '둘', conditionTemplateKey: 'has_flag' },
        { chapterNo: 1, title: '돌아온 캠퍼스', summarySeed: '하나', conditionTemplateKey: null },
      ],
      endings: [{ endingNo: 1, label: '봄이 오기 전에', isDefault: true }],
      conditionTemplates: ['has_flag'],
    }
    const values = fromOutlineResponse(response)
    expect(values.chapters.map((chapter) => chapter.title)).toEqual(['같은 강의실', '돌아온 캠퍼스'])
    expect(values.endings[0]?.epilogueText).toBe('')
  })
})

describe('기본 엔딩 — 3e "isDefault 는 엔딩 하나에만 켜진다(라디오)"', () => {
  it('R2_11_기본_엔딩은_언제나_하나뿐이다', () => {
    const endings = [ending('하나', { isDefault: true }), ending('둘'), ending('셋')]
    const next = setDefaultEnding(endings, 2)
    expect(next.filter((e) => e.isDefault)).toHaveLength(1)
    expect(next[2]?.isDefault).toBe(true)
  })

  it('둘이_켜져_있던_상태에서도_하나로_줄어든다', () => {
    const endings = [ending('하나', { isDefault: true }), ending('둘', { isDefault: true })]
    expect(setDefaultEnding(endings, 0).filter((e) => e.isDefault)).toHaveLength(1)
  })

  /** 계약 — *"기본 엔딩은 조건을 갖지 않고, 일반 엔딩은 조건을 반드시 갖는다"* (R2.11, §13-16). */
  it('R2_11_기본이_되면_조건이_비워진다', () => {
    const endings = [
      ending('하나', { conditionTemplateKey: 'has_flag', conditionParams: { flag: '봄' } }),
    ]
    expect(setDefaultEnding(endings, 0)[0]?.conditionTemplateKey).toBeNull()
    // 고른 값도 함께 사라진다 — 남으면 화면에 보이지 않는 채 payload 에만 남는다.
    expect(setDefaultEnding(endings, 0)[0]?.conditionParams).toEqual({})
  })
})

describe('다음으로 갈 수 있는가', () => {
  /** 3e — `summarySeed` 는 필수다. **이 판정이 서버의 검증을 대신하지 않는다.** */
  it('줄거리_씨앗이_빈_챕터의_자리를_알려_준다', () => {
    const chapters = [
      { ...emptyChapter(), summarySeed: '씨앗' },
      { ...emptyChapter(), summarySeed: '   ' },
      emptyChapter(),
    ]
    expect(chaptersMissingSeed(chapters)).toEqual([1, 2])
  })

  it('R2_11_조건이_없는_일반_엔딩만_센다', () => {
    const endings = [
      ending('기본', { isDefault: true }),
      ending('조건 있음', {
        conditionTemplateKey: 'turn_at_least',
        conditionParams: { threshold: 5 },
      }),
      ending('조건 없음'),
    ]
    expect(endingsMissingCondition(endings, TEMPLATES, SOURCES)).toEqual([2])
  })

  /** 정정본 §13-56 — *"키만으로는 조건이 완성되지 않는다."* */
  it('키만_고른_엔딩은_아직_조건이_없는_것으로_센다', () => {
    const endings = [ending('임계값 없음', { conditionTemplateKey: 'turn_at_least' })]
    expect(endingsMissingCondition(endings, TEMPLATES, SOURCES)).toEqual([0])
  })
})

describe('조건 템플릿 — 정정본 §13-56 (backend #282)', () => {
  it('선언된_슬롯이_다_차야_조건이_완성된다', () => {
    const partial = { conditionTemplateKey: 'affinity_at_least', conditionParams: { character: '유나' } }
    expect(conditionIncomplete(partial, TEMPLATES, SOURCES)).toBe(true)
    expect(
      conditionIncomplete(
        { ...partial, conditionParams: { character: '유나', threshold: 30 } },
        TEMPLATES,
        SOURCES,
      ),
    ).toBe(false)
  })

  it('목록에_없는_키는_고르지_않은_것으로_읽는다 — 라벨을_지어내지_않는다', () => {
    expect(
      conditionIncomplete({ conditionTemplateKey: 'has_flag', conditionParams: {} }, [TURN], SOURCES),
    ).toBe(true)
  })

  /** 후보가 없는 입력을 요구하는 템플릿은 고를 수 없다 — `visibilityBlockedReason`(3f) 과 같다. */
  it('인물이_없으면_호감도_템플릿을_잠근다', () => {
    expect(templateBlockedReason(AFFINITY, { characters: [], flags: [] })).not.toBeNull()
    expect(templateBlockedReason(AFFINITY, { characters: ['유나'], flags: [] })).toBeNull()
  })

  it('플래그를_선언할_자리가_없어_플래그_템플릿은_잠긴다', () => {
    expect(templateBlockedReason(HAS_FLAG, { characters: ['유나'], flags: [] })).not.toBeNull()
  })

  it('임계값_템플릿은_원고와_무관하게_고를_수_있다', () => {
    expect(templateBlockedReason(TURN, { characters: [], flags: [] })).toBeNull()
  })

  it('선택지는_원고에서_온다 — 정수는_목록이_아니다', () => {
    expect(parameterOptions(AFFINITY.parameters[0]!, SOURCES)).toEqual(['유나', '민'])
    expect(parameterOptions(HAS_FLAG.parameters[0]!, SOURCES)).toEqual(['봄'])
    expect(parameterOptions(AFFINITY.parameters[1]!, SOURCES)).toEqual([])
  })

  it('템플릿을_바꾸면_고른_값을_버린다 — 슬롯_이름이_템플릿마다_다르다', () => {
    const filled = setConditionParam(
      setConditionTemplate(emptyChapter(), 'affinity_at_least'),
      'character',
      '유나',
    )
    expect(setConditionTemplate(filled, 'turn_at_least').conditionParams).toEqual({})
  })

  it('빈_값을_고르면_슬롯이_다시_비워진다', () => {
    const filled = setConditionParam(emptyChapter(), 'threshold', 30)
    expect(setConditionParam(filled, 'threshold', null).conditionParams).toEqual({})
  })
})

describe('검수 필드 경로', () => {
  /** 계약 `PrecheckRequest.fields` 의 예시가 `characters[0].name` 이므로 배열 표기는 그 형식이다. */
  it('배열_표기는_계약의_예시_형식이다', () => {
    expect(chapterField(0, 'summarySeed')).toBe('chapters[0].summarySeed')
    expect(endingField(2, 'label')).toBe('endings[2].label')
  })

  it('자리가_바뀔_때_버릴_경로를_모두_준다', () => {
    expect(chapterFieldPaths(2)).toEqual([
      'chapters[0].title',
      'chapters[0].summarySeed',
      'chapters[1].title',
      'chapters[1].summarySeed',
    ])
    expect(chapterFieldPaths(-1)).toEqual([])
  })
})
