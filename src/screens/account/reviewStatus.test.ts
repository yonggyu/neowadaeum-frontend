import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import type { components } from '../../api/schema'
import {
  isVisibilityReadOnly,
  narrowsExposure,
  REVIEW_STATUS_LABEL,
  reviewPhase,
  triggersHumanReview,
  VISIBILITY_LABEL,
  VISIBILITY_OPTIONS,
  visibilityBlockedReason,
} from './reviewStatus'

type ReviewStatus = components['schemas']['ReviewStatus']

const ALL_STATUSES: ReviewStatus[] = [
  'draft',
  'pending',
  'auto_rejected',
  'in_review',
  'approved',
  'rejected',
  'suspended',
]

describe('R8.7 · F-5 — auto_rejected 는 사용자에게 rejected 로 표시한다', () => {
  it('R8_7_auto_rejected_와_rejected_는_같은_문구다', () => {
    expect(REVIEW_STATUS_LABEL.auto_rejected).toBe(REVIEW_STATUS_LABEL.rejected)
  })

  it('R8_7_auto_rejected_와_rejected_는_같은_패널로_접힌다', () => {
    expect(reviewPhase('auto_rejected')).toBe('rejected')
    expect(reviewPhase('rejected')).toBe('rejected')
  })

  it('F5_어떤_문구도_자동_판정임을_드러내지_않는다', () => {
    // "자동"이 보이면 어디까지가 기계 판정인지 알려 주는 것이 되고, 그것이 우회의 실마리다.
    for (const status of ALL_STATUSES) {
      expect(REVIEW_STATUS_LABEL[status]).not.toContain('자동')
    }
  })

  it('F5_상태_패널_소스에_auto_rejected_분기가_없다', () => {
    // 7종을 화면 여러 곳에서 각각 비교하면 언젠가 한 곳이 빠지고, 그 한 곳이 자동 반려라고
    // 말해 버린다. 분기는 `reviewPhase` 하나로만 한다.
    expect(screenSource()).not.toContain('auto_rejected')
  })
})

describe('6c — 정지 상태에서는 공개 범위 컨트롤이 읽기 전용이다', () => {
  it('6c_suspended_만_읽기_전용이다', () => {
    for (const status of ALL_STATUSES) {
      expect(isVisibilityReadOnly(status)).toBe(status === 'suspended')
    }
  })

  it('6c_읽기_전용_판정이_fieldset_의_disabled_로_이어진다', () => {
    // 이 화면에서 정지를 지키는 것은 이 한 줄이다 — 라디오 셋과 저장 버튼이 그 안에 있다.
    expect(screenSource()).toContain('disabled={readOnly || saving}')
  })
})

describe('changeStoryVisibility — unlisted → public 은 재검수를 강제 트리거한다', () => {
  it('계약_unlisted_에서_public_으로_올리면_재검수다', () => {
    expect(triggersHumanReview('unlisted', 'public')).toBe(true)
  })

  it('계약_public_유지는_재검수가_아니다', () => {
    expect(triggersHumanReview('public', 'public')).toBe(false)
  })

  it('계약_좁히는_변경은_재검수가_아니다', () => {
    expect(triggersHumanReview('public', 'unlisted')).toBe(false)
    expect(triggersHumanReview('unlisted', 'private')).toBe(false)
  })

  it('계약_화면이_재검수_사실을_누르기_전에_말한다', () => {
    const source = screenSource()
    expect(source).toContain('triggersHumanReview')
    expect(source).toContain('전체 공개는 사람이 직접 확인합니다')
  })
})

describe('정정본 §13-48 — private → public 은 이 오퍼레이션의 경로가 아니다', () => {
  it('정정본13_48_private_에서_public_은_막고_이유를_말한다', () => {
    expect(visibilityBlockedReason('private', 'public')).toContain('링크 공유')
  })

  it('정정본13_48_나머지_전이는_막지_않는다', () => {
    const allowed: [(typeof VISIBILITY_OPTIONS)[number], (typeof VISIBILITY_OPTIONS)[number]][] = [
      ['private', 'unlisted'],
      ['unlisted', 'public'],
      ['public', 'private'],
      ['public', 'unlisted'],
      ['unlisted', 'private'],
    ]
    for (const [from, to] of allowed) {
      expect(visibilityBlockedReason(from, to)).toBeNull()
    }
  })
})

describe('되돌릴 수 없는 동작에는 확인을 묻는다', () => {
  it('노출을_좁히는_변경만_확인_대상이다', () => {
    expect(narrowsExposure('public', 'private')).toBe(true)
    expect(narrowsExposure('public', 'unlisted')).toBe(true)
    expect(narrowsExposure('unlisted', 'private')).toBe(true)
    expect(narrowsExposure('private', 'unlisted')).toBe(false)
    expect(narrowsExposure('unlisted', 'public')).toBe(false)
    expect(narrowsExposure('private', 'private')).toBe(false)
  })

  it('확인을_거치지_않고는_PATCH_를_부르지_않는다', () => {
    const source = screenSource()
    const guard = source.indexOf('narrowsExposure(story.visibility, target) && !confirming')
    const call = source.indexOf('await changeStoryVisibility(')
    expect(guard).toBeGreaterThan(-1)
    expect(call).toBeGreaterThan(guard)
  })
})

describe('S-11 — 검수 비율·임계값을 노출하지 않는다', () => {
  it('S11_화면과_상태_규칙에_비율_임계_표현이_없다', () => {
    // 값을 알면 그 아래로 관리할 수 있다. 코드·주석 어디에도 적지 않는다.
    for (const source of [screenSource(), read('reviewStatus.ts')]) {
      expect(source).not.toMatch(/샘플링|임계|퍼센트|%/)
    }
  })
})

describe('3f · 6c — 화면 문구', () => {
  it('unlisted_의_화면_문구는_링크_공유다', () => {
    expect(VISIBILITY_LABEL.unlisted).toBe('링크 공유')
  })

  it('공개_범위는_좁은_것부터_넓은_것_순이다', () => {
    expect([...VISIBILITY_OPTIONS]).toEqual(['private', 'unlisted', 'public'])
  })
})

describe('백엔드281 — 고지문을 자기 응답에서 읽는다', () => {
  it.each(['MyStoryReviewScreen.tsx', 'MyStoriesScreen.tsx', 'HistoryScreen.tsx'])(
    '백엔드281_%s_는_landing_을_부르지_않는다',
    (file) => {
      const source = read(file)
      expect(source).not.toContain('getLanding')
      expect(source).not.toContain('/landing')
    },
  )

  it.each(['MyStoryReviewScreen.tsx', 'MyStoriesScreen.tsx', 'HistoryScreen.tsx'])(
    '백엔드281_%s_는_두_번째_Footer_를_만들지_않는다',
    (file) => {
      const source = read(file)
      expect(source).toContain('AiNoticeFooter')
      expect(source).toContain('noticeText')
      expect(source).not.toMatch(/function\s+\w*NoticeFooter/)
    },
  )
})

/** 주석을 걷어낸 소스. 지키려는 것은 호출이지 설명하는 글이 아니다 (`library/notice.test.ts` 와 같은 이유). */
const read = (file: string): string =>
  readFileSync(new URL(file, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const screenSource = (): string => read('MyStoryReviewScreen.tsx')
