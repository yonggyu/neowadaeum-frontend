import { describe, expect, it } from 'vitest'

import { ApiError } from '../../api/client'
import type { DraftPayload } from '../../api/endpoints/authoring'
import { ROUTES } from '../../routes/routes'
import {
  clampStep,
  draftTitle,
  isBlocked,
  isDraftLimitReached,
  savedAtLabel,
  STEP_COUNT,
  STEP_LABELS,
  toSummary,
} from './draft'

describe('단계 — 6a 의 진행바가 읽는 값', () => {
  it('다섯이다 — 3d 의 셋과 3e 의 둘', () => {
    expect(STEP_COUNT).toBe(5)
    // 셋째는 7차 `A-1` 이 정한 이름이다 (#125) — Step 3 이 인물과 플래그를 함께 든다
    expect([...STEP_LABELS]).toEqual([
      '기본 정보',
      '세계관',
      '등장인물과 플래그',
      '챕터 & 엔딩',
      '미리보기',
    ])
  })

  it('clampStep_은_범위_밖을_그리지_않는다 — 진행바가 배열 밖을 읽지 않는다', () => {
    expect(clampStep(0)).toBe(1)
    expect(clampStep(3)).toBe(3)
    expect(clampStep(9)).toBe(STEP_COUNT)
    expect(clampStep(Number.NaN)).toBe(1)
  })
})

describe('draftTitle — 3g "제목 없는 작품"', () => {
  it('payload_의_title_을_쓴다', () => {
    expect(draftTitle({ title: '봄이 오기 전에' })).toBe('봄이 오기 전에')
  })

  it('없거나_비었으면_지어내지_않고_같은_문구를_쓴다 — 원고는 제목 없이도 만들어진다', () => {
    /**
     * **형을 넓히는 이유** — 계약(#354)이 `DraftPayload.title` 을 `string` 으로 세웠지만
     * 그것은 서버가 지키기로 한 약속이지 런타임 검증이 아니다. `request<T>()` 는
     * `response.json()` 을 그대로 `T` 로 단언하며, `DraftPayload` 는 `additionalProperties`
     * 가 열린 자리라 무엇이 실려 오는지 화면이 다 알 수 없다. 이 테스트가 붙잡는 성질이
     * *"그래도 빈 값으로 읽는다"* 이므로, 계약이 금지한 형은 **와이어에서 오는 모양**
     * (`Record<string, unknown>`)으로 만들어 그 경계를 그대로 흉내 낸다.
     */
    const wirePayload: Record<string, unknown> = { title: 42 }

    expect(draftTitle({})).toBe('제목 없는 작품')
    expect(draftTitle({ title: '   ' })).toBe('제목 없는 작품')
    expect(draftTitle(wirePayload as DraftPayload)).toBe('제목 없는 작품')
    expect(draftTitle(undefined)).toBe('제목 없는 작품')
  })
})

describe('isBlocked — 6a "blocked 면 다음 버튼 Disabled"', () => {
  it('blocked_만_막는다 — warned 는 P0 에 나오지 않는다 (§13-33 · 3d)', () => {
    expect(isBlocked('blocked')).toBe(true)
    expect(isBlocked('clean')).toBe(false)
    expect(isBlocked('warned')).toBe(false)
  })
})

describe('isDraftLimitReached — R8.12 · §13-32', () => {
  it('409_를_상태_코드로_가른다 — 계약이 보장한 것이 코드가 아니라 409 다', () => {
    expect(isDraftLimitReached(new ApiError(409, 'ALREADY_EXISTS', '이미 등록되어 있어요.', {}))).toBe(true)
    // 서버가 다른 코드를 보내도 안내를 잃지 않는다.
    expect(isDraftLimitReached(new ApiError(409, 'STORY_LIMIT_REACHED', '가득 찼어요.', {}))).toBe(true)
  })

  it('다른_실패는_상한이_아니다 — "지우면 자리가 난다" 를 아무 데나 붙이지 않는다', () => {
    expect(isDraftLimitReached(new ApiError(401, 'UNAUTHENTICATED', '로그인이 필요해요.', {}))).toBe(false)
    expect(isDraftLimitReached(new Error('네트워크'))).toBe(false)
  })
})

describe('savedAtLabel — 6a "임시 저장됨 · 방금"', () => {
  const now = Date.parse('2026-09-02T12:00:00Z')

  it('1분_안쪽은_방금_이다 — 저장 직후 가장 자주 보이는 문구다', () => {
    expect(savedAtLabel('2026-09-02T12:00:00Z', now)).toBe('방금')
    expect(savedAtLabel('2026-09-02T11:59:30Z', now)).toBe('방금')
  })

  it('그보다_오래되면_공용_상대시각을_쓴다', () => {
    expect(savedAtLabel('2026-09-02T11:00:00Z', now)).toBe('1시간 전')
  })
})

describe('toSummary — 목록이 쓰는 모양으로 좁힌다', () => {
  it('payload_원문을_들고_나가지_않는다', () => {
    const summary = toSummary({
      draftId: 'd1',
      storyId: null,
      step: 7,
      payload: { title: '밤의 편의점', worldDetail: 'AI 에게만 전달되는 설정' },
      safetyState: 'blocked',
      findings: [],
      updatedAt: '2026-09-01T00:00:00Z',
    })

    expect(summary).toEqual({
      draftId: 'd1',
      title: '밤의 편의점',
      step: 5,
      updatedAt: '2026-09-01T00:00:00Z',
      blocked: true,
    })
  })
})

describe('라우트 — 셸의 CTA 가 실제로 열리는 곳을 가리킨다', () => {
  it('원고_목록과_마법사가_ROUTES_에_있다 (#54 · PR #31 이 못 넣은 이유가 라우트였다)', () => {
    expect(ROUTES.authoringDrafts).toBe('/authoring/drafts')
    expect(ROUTES.authoringDraft).toBe('/authoring/drafts/:draftId')
  })

  it('CTA_목적지에는_경로_파라미터가_없다 — 값을 채우지 않고 링크할 수 있어야 한다', () => {
    expect(ROUTES.authoringDrafts.includes(':')).toBe(false)
  })
})
