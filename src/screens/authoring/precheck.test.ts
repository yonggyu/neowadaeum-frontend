import { describe, expect, it } from 'vitest'

import type { Finding, PrecheckResponse, SafetyState } from '../../api/endpoints/authoring'
import {
  acceptedFindings,
  findingsFor,
  hasBlocked,
  highlightSegments,
  mergeFindings,
  PRECHECK_DEBOUNCE_MS,
} from './precheck'

/*
 * **테스트 데이터에 실제로 걸릴 법한 문자열을 넣지 않는다** (S-11 — 이 레포는 공개다).
 * 4c 가 예시에서 한 것과 같이 자리표시자를 쓴다: 무엇이 걸리는지는 이 테스트의 관심이 아니고,
 * 관심은 **걸렸다는 응답을 화면이 어떻게 다루는가** 하나다.
 */
const finding = (field: string, span: [number, number]): Finding => ({
  field,
  span,
  kind: 'other',
  message: '이 값은 사용할 수 없습니다. 다른 값으로 바꿔 주세요.',
})

const response = (state: SafetyState, findings: Finding[]): PrecheckResponse => ({ state, findings })

describe('실시간 검수의 판정', () => {
  it('3d_화면은_clean_과_blocked_두_상태만_그린다', () => {
    expect(acceptedFindings(response('blocked', [finding('title', [0, 2])]))).toHaveLength(1)
    expect(acceptedFindings(response('clean', []))).toHaveLength(0)
  })

  /**
   * 3d 가 주황 "진행 가능한 경고" 를 **삭제**했다 — P0 에 나오지 않는다. `SafetyState` enum 에
   * `warned` 가 남아 있어도(계약) 화면은 그 상태를 그리지 않는다 (정정본 13-33 채택 2).
   */
  it('3d_warned_는_그리지_않는다_enum_에_있어도', () => {
    expect(acceptedFindings(response('warned', [finding('title', [0, 2])]))).toEqual([])
  })

  it('6a_blocked_가_하나라도_있으면_다음_버튼을_막는다', () => {
    expect(hasBlocked([finding('characters[0].name', [0, 2])])).toBe(true)
  })

  /** `warned` 응답은 findings 를 남기지 않으므로 진행을 막지도 않는다 — 두 판정이 갈라지지 않는다. */
  it('3d_warned_응답은_진행을_막지_않는다', () => {
    const merged = mergeFindings([], ['title'], response('warned', [finding('title', [0, 2])]))
    expect(hasBlocked(merged)).toBe(false)
  })

  it('4c_canProceed_가_없으므로_findings_로_판정한다', () => {
    expect(hasBlocked([])).toBe(false)
  })

  it('3d_입력_정지_0.8초_뒤에_검사한다', () => {
    expect(PRECHECK_DEBOUNCE_MS).toBe(800)
  })
})

describe('결과 갈아 끼우기', () => {
  it('검사한_필드의_옛_결과를_지운다', () => {
    const before = [finding('title', [0, 2])]
    const after = mergeFindings(before, ['title'], response('clean', []))
    expect(after).toEqual([])
  })

  it('검사하지_않은_필드의_결과는_남긴다', () => {
    const before = [finding('characters[0].name', [0, 2])]
    const after = mergeFindings(before, ['title'], response('clean', []))
    expect(after).toEqual(before)
  })

  it('4c_한_필드에_여러_finding_이_올_수_있다', () => {
    const merged = mergeFindings(
      [],
      ['settingDetail'],
      response('blocked', [
        finding('settingDetail', [0, 2]),
        finding('settingDetail', [10, 12]),
      ]),
    )
    expect(findingsFor(merged, 'settingDetail')).toHaveLength(2)
    expect(findingsFor(merged, 'title')).toHaveLength(0)
  })
})

describe('문제 구간 하이라이트', () => {
  it('3d_span_구간만_표시한다', () => {
    expect(highlightSegments('가나다라마', [[1, 3]])).toEqual([
      { text: '가', marked: false },
      { text: '나다', marked: true },
      { text: '라마', marked: false },
    ])
  })

  it('4c_여러_구간을_동시에_표시한다', () => {
    expect(
      highlightSegments('가나다라마', [
        [0, 1],
        [3, 5],
      ]),
    ).toEqual([
      { text: '가', marked: true },
      { text: '나다', marked: false },
      { text: '라마', marked: true },
    ])
  })

  it('겹치거나_붙은_구간은_하나로_합친다', () => {
    expect(
      highlightSegments('가나다라마', [
        [0, 3],
        [2, 4],
      ]),
    ).toEqual([
      { text: '가나다라', marked: true },
      { text: '마', marked: false },
    ])
  })

  /** 정정본 13-33 — 자리 추적을 포기하면 **필드 전체**가 온다. 그 사이 사용자가 지울 수도 있다. */
  it('원문보다_긴_구간은_원문_길이로_자른다', () => {
    expect(highlightSegments('가나', [[0, 99]])).toEqual([{ text: '가나', marked: true }])
    expect(highlightSegments('', [[0, 4]])).toEqual([])
  })
})
