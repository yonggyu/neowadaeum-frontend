import type { Choice } from '../../api/endpoints/play'

/**
 * Choice 배치 (와이어프레임 2b · 1k).
 *
 * - `none`   — `choices` 가 빈 배열이다. **Ending 이다** (R7.8)
 * - `single` — 1개. 번호를 생략하고 full-width 로 둔다
 * - `grid`   — 4개이고 전부 1줄이다. Desktop 에서만 2×2 (Mobile 은 CSS 가 세로로 되돌린다)
 * - `stack`  — 그 밖의 전부. 세로 스택
 */
export type ChoiceLayout = 'none' | 'single' | 'grid' | 'stack'

/**
 * 2×2 로 두어도 한 줄에 들어간다고 보는 글자 수.
 *
 * **여기가 근사다.** 2b 의 조건은 *"텍스트 1줄일 때만 2×2"* 인데, 줄 수는 렌더 결과이므로
 * 순수 함수가 알 수 없다. 실제로 재려면 레이아웃 이후에 측정해 되돌려야 하고, 그러면
 * 배치가 한 프레임 흔들린다 — 읽는 중에 선택지가 재배치되는 편이 2×2 를 못 쓰는 것보다 나쁘다.
 *
 * 값의 근거: 본문 폭이 62ch(≈31em)이므로 2열 한 칸은 ≈15em 이고, 한글 한 자가 ≈1em 이다.
 * 번호와 좌우 여백을 빼면 한 줄에 들어가는 것이 대략 이만큼이다. 넘으면 세로 스택으로
 * 떨어질 뿐이며 — **틀렸을 때의 결과가 안전한 쪽이다.**
 */
export const GRID_TEXT_LIMIT = 16

export function choiceLayout(choices: readonly Choice[]): ChoiceLayout {
  if (choices.length === 0) {
    return 'none'
  }
  if (choices.length === 1) {
    return 'single'
  }
  if (choices.length === 4 && choices.every((c) => c.text.length <= GRID_TEXT_LIMIT)) {
    return 'grid'
  }
  return 'stack'
}

/** 번호는 1개일 때만 생략한다 (2b). */
export function showsChoiceNumber(layout: ChoiceLayout): boolean {
  return layout !== 'single'
}

/** `01` · `02` — order 를 그대로 두 자리로 쓴다. 화면이 순번을 새로 매기지 않는다. */
export function choiceNumber(order: number): string {
  return String(order).padStart(2, '0')
}
