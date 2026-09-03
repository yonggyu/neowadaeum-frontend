import { describe, expect, it } from 'vitest'

import type { OutlineResponse } from '../../api/endpoints/authoring'
import {
  chapterField,
  chapterFieldPaths,
  chaptersMissingSeed,
  emptyChapter,
  emptyEnding,
  endingField,
  endingsMissingCondition,
  fromOutlineResponse,
  readOutline,
  setDefaultEnding,
  writeOutline,
  type EndingDraft,
} from './outline'

const ending = (label: string, patch: Partial<EndingDraft> = {}): EndingDraft => ({
  ...emptyEnding(),
  label,
  ...patch,
})

describe('payload 를 화면의 값으로 (Step 4)', () => {
  it('초안을_한_번도_받지_않은_원고가_기본값이다', () => {
    expect(readOutline(undefined)).toEqual({ chapters: [], endings: [] })
  })

  it('다른_타입이_와도_빈_값으로_읽는다', () => {
    const values = readOutline({ chapters: 'x', endings: [42, { label: '봄' }] })
    expect(values.chapters).toEqual([])
    expect(values.endings).toEqual([emptyEnding(), ending('봄')])
  })

  /**
   * `PATCH` 는 payload 를 통째로 받는다. Step 1~3 의 값과 Step 5 가 더할 값이 같은 payload
   * 안에 있으므로, 아는 키만 남기면 이 단계가 나머지를 매번 지운다.
   */
  it('모르는_키를_지우지_않는다', () => {
    const payload = writeOutline({ title: '봄이 오기 전에', characters: [] }, { chapters: [], endings: [] })
    expect(payload['title']).toBe('봄이 오기 전에')
    expect(payload['characters']).toEqual([])
  })

  /** 번호의 뜻은 순서다 — 그래서 배열의 자리에서 한 번만 만든다 (계약 `OutlineChapter.chapterNo`). */
  it('chapterNo_와_endingNo_는_배열의_자리에서_매겨진다', () => {
    const payload = writeOutline(undefined, {
      chapters: [
        { ...emptyChapter(), title: '돌아온 캠퍼스', summarySeed: '씨앗' },
        { ...emptyChapter(), title: '같은 강의실', summarySeed: '씨앗' },
      ],
      endings: [ending('봄이 오기 전에', { isDefault: true }), ending('다른 봄')],
    })
    expect(payload['chapters']).toEqual([
      { chapterNo: 1, title: '돌아온 캠퍼스', summarySeed: '씨앗', conditionTemplateKey: null },
      { chapterNo: 2, title: '같은 강의실', summarySeed: '씨앗', conditionTemplateKey: null },
    ])
    expect(payload['endings']).toEqual([
      {
        endingNo: 1,
        label: '봄이 오기 전에',
        epilogueText: null,
        isDefault: true,
        conditionTemplateKey: null,
      },
      {
        endingNo: 2,
        label: '다른 봄',
        epilogueText: null,
        isDefault: false,
        conditionTemplateKey: null,
      },
    ])
  })

  /** 계약의 `epilogueText` 는 `string | null` 이다. 빈 문자열을 "쓴 적 있음" 으로 남기지 않는다. */
  it('빈_에필로그는_null_로_나간다', () => {
    const payload = writeOutline(undefined, { chapters: [], endings: [ending('봄')] })
    expect((payload['endings'] as { epilogueText: unknown }[])[0]?.epilogueText).toBeNull()
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
    const endings = [ending('하나', { conditionTemplateKey: 'has_flag' })]
    expect(setDefaultEnding(endings, 0)[0]?.conditionTemplateKey).toBeNull()
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
      ending('조건 있음', { conditionTemplateKey: 'turn_at_least' }),
      ending('조건 없음'),
    ]
    expect(endingsMissingCondition(endings)).toEqual([2])
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
