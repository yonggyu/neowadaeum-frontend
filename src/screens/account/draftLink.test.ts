import { describe, expect, it } from 'vitest'

import { authoringDraftPath } from '../../routes/routes'
import { draftPathOf, NO_DRAFT_NOTICE } from './draftLink'

describe('작품에서 원고로 가는 길 (#340, 정정본 §13-66)', () => {
  it('draftId_가_null_이면_경로가_없다__없는_곳으로_보내는_버튼을_그리지_않기_위해서다', () => {
    expect(draftPathOf(null)).toBeNull()
  })

  it('draftId_가_있으면_계약과_같은_경로다__routes_의_헬퍼가_정본이다', () => {
    const draftId = '0b4a2a1c-0000-4000-8000-000000000001'
    expect(draftPathOf(draftId)).toBe(authoringDraftPath(draftId))
  })

  it('빈_문자열은_id_가_아니다__서버가_준_uuid_만_길이_된다', () => {
    // 계약의 `draftId` 는 uuid 이고 `null` 이 아니면 값이 있다. 빈 문자열이 오면 그것은
    // 계약 밖이며, 그대로 이으면 `/authoring/drafts/` 라는 존재하지 않는 경로가 된다.
    expect(draftPathOf('')).toBeNull()
  })

  it('F5__원고가_없는_이유를_단정하지_않는다__세이프티_판정을_문구가_추측하지_않는다', () => {
    // 계약은 미리보기 작품을 `null` 의 **예**로 들었을 뿐이다 (§13-5 · §13-37).
    expect(NO_DRAFT_NOTICE).not.toMatch(/미리보기|차단|위반|삭제되었/)
  })

  it('없다는_사실을_적는다__빈_자리를_두지_않는다', () => {
    expect(NO_DRAFT_NOTICE).toContain('원고가 없습니다')
  })
})
