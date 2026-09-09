import { describe, expect, it } from 'vitest'

import {
  COVER_ABSENT,
  COVER_PRESENT,
  failed,
  failureOf,
  imageOf,
  isOpening,
  OPEN_COVER,
  OPEN_NOTE_EMPHASIS,
  OPEN_NOTE_LEAD,
  OPEN_PORTRAIT,
  OPENING,
  OPENING_LABEL,
  openLabel,
  shown,
  UNOPENED,
  type ReviewImageState,
} from './reviewImage'

/**
 * 검수 상세의 이미지 자리 (#153, 9차 캔버스 `Main` · `ReviewDetail768`).
 *
 * **화면을 그리지 않고 판정만 확인한다** — 러너에 DOM 이 없다. 여기서 못박는 것은 *어떻게
 * 보이는가*가 아니라 **아트보드가 값으로 적어 둔 것**(문구 · 어느 상태에 무엇이 오는가)과
 * **화면이 지어내지 않는 것**이다.
 *
 * 테스트 데이터에 **실제로 걸릴 법한 문자열을 넣지 않는다** (S-11 — 이 레포는 공개다).
 */

describe('§13-78/4 — 감사가 걸린 문은 사람이 누를 때만 연다', () => {
  it('첫_상태는_아직_열지_않은_것이다 — 렌더링만으로 열람 기록이 남지 않는다', () => {
    // `#86` 의 선례다. *보이면 부른다* 로 만들면 열어 본 적 없는 원고가 큐 길이 × 이미지 수
    // 만큼 열람 기록에 쌓이고, 그 기록은 "누가 무엇을 봤는가" 를 더는 답하지 못한다.
    expect(UNOPENED.status).toBe('unopened')
    expect(imageOf(UNOPENED)).toBeNull()
    expect(failureOf(UNOPENED)).toBeNull()
  })

  it('받는_중에는_다시_눌리지_않는다 — 누를 때마다 기록이 한 줄씩 는다', () => {
    // `Cache-Control: private, no-store` 라 같은 이미지를 두 번 그리면 요청도 기록도 두 번이다.
    expect(isOpening(OPENING)).toBe(true)
    expect(isOpening(UNOPENED)).toBe(false)
    expect(isOpening(shown('blob:dummy-address'))).toBe(false)
    expect(isOpening(failed('더미 문장'))).toBe(false)
  })
})

describe('S11_그리는_주소는_blob_뿐이다 — 객체 키가 상태에 남지 않는다', () => {
  it('그림이_있는_상태에도_키가_없다 — 키는 부르는 데만 쓴다 (I-8, S-11)', () => {
    // 버킷이 비공개라 키로 열리는 주소가 없다. 상태가 키를 들면 그것이 화면이나 로그로
    // 새는 길이 되고, 그때 저장소 구조가 드러난다.
    const state: ReviewImageState = shown('blob:dummy-address')
    expect(JSON.stringify(state)).not.toContain('dummy-key-segment')
    expect(imageOf(state)).toBe('blob:dummy-address')
  })

  it('그림은_받은_뒤에만_있다 — 나머지 셋에는 그릴 것이 없다', () => {
    expect(imageOf(OPENING)).toBeNull()
    expect(imageOf(failed('더미 문장'))).toBeNull()
  })
})

describe('F-4 — 못 받았을 때의 문구는 서버가 준 것 그대로다', () => {
  it('문구를_짓지_않는다 — 받은 문장을 그대로 담는다', () => {
    expect(failureOf(failed('더미 서버 문장'))).toBe('더미 서버 문장')
  })

  it('404_와_네트워크_실패를_나누지_않는다 — 상태가 하나다', () => {
    // 계약은 *커버 없는 원고가 정상이고 그때 404* 라고 적었지만, 그 경우 원고의 키가 `null`
    // 이라 이 자리는 애초에 그려지지 않는다. 여기 오는 404 를 화면이 따로 해석하면 서버가
    // 하지 않은 말이 된다 — `B-2` · `B-3` 이 같은 판단을 했다.
    expect(failed('더미 하나').status).toBe(failed('더미 둘').status)
  })
})

describe('아트보드의 문구를 화면이 다시 짓지 않는다', () => {
  it('여는_자리의_말이_커버와_초상에서_다르다 — 아트보드가 그렇게 적었다', () => {
    expect(OPEN_COVER).toBe('커버 보기')
    expect(OPEN_PORTRAIT).toBe('초상 보기')
    expect(COVER_PRESENT).toBe('커버가 있어요')
  })

  it('누르기_전의_안내는_두_문장이고_뒤가_강조다 — 누르는 것이 공짜가 아니다', () => {
    // 아트보드는 뒷문장만 굵게 적었다. 그 강조가 이 자리의 요지다 (§13-78/4).
    expect(`${OPEN_NOTE_LEAD} ${OPEN_NOTE_EMPHASIS}`).toBe(
      '누르면 원본을 받아 이 자리에 그립니다. 열람 기록이 남습니다.',
    )
    expect(OPEN_NOTE_EMPHASIS).toContain('열람 기록')
  })

  it('받는_중에만_라벨이_바뀐다 — 자리마다 다른 말을 상태로 다시 가르지 않는다', () => {
    expect(openLabel(UNOPENED, OPEN_COVER)).toBe(OPEN_COVER)
    expect(openLabel(UNOPENED, OPEN_PORTRAIT)).toBe(OPEN_PORTRAIT)
    expect(openLabel(OPENING, OPEN_COVER)).toBe(OPENING_LABEL)
    expect(openLabel(OPENING, OPEN_PORTRAIT)).toBe(OPENING_LABEL)
    // 못 받았으면 같은 문으로 돌아온다 — 다시 누를 수 있는 문이므로 라벨도 그대로다
    expect(openLabel(failed('더미 문장'), OPEN_COVER)).toBe(OPEN_COVER)
  })

  it('커버가_없는_원고가_정상이다 — 결함처럼 적지 않고 열 자리도 두지 않는다', () => {
    // 열 것이 없으므로 여는 자리를 두지 않는다 (`B-2` — 갈 수 없는 곳으로 가는 문을 그리지
    // 않는다). 문장 하나로 끝난다.
    expect(COVER_ABSENT).toBe('올린 커버가 없어요.')
  })
})
