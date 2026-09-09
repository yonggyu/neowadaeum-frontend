import { describe, expect, it } from 'vitest'

import { cssFiles, uncommented } from './cssTokens'

/**
 * 폭 경계는 셋뿐이다 (F-9 · #199).
 *
 * `tokens.css` 의 브레이크포인트 표가 네 띠(Mobile · Tablet · Laptop · Desktop)를 세어
 * 두었는데, 미디어 쿼리는 `var()` 를 읽지 못해 **각 모듈이 같은 숫자를 손으로 적는다.**
 * 그래서 한 화면이 한 칸 어긋난 숫자를 적어도 그 화면 안에서는 아무 일도 일어나지 않고,
 * 어긋남은 **그 폭을 실제로 열어 봐야** 보인다.
 *
 * 실제로 그랬다 — 로그인의 Split 하나가 `min-width: 1025px` 이었고, 그 한 칸 때문에
 * **1024 에서 화면의 유일한 CTA 가 폴드 아래**에 앉았다 (#199). F-9 가 이름을 못박은 네 폭
 * 중 하나다. 값을 세는 일을 사람 눈에 맡기지 않는다.
 *
 * **이 검사는 경계의 *숫자* 만 본다.** 어느 화면이 어느 띠에서 무엇을 하는지는 그 화면의
 * 몫이고, 여기서 막는 것은 *표에 없는 숫자가 새로 생기는 것* 하나다.
 */

/** `tokens.css` 의 표가 세운 셋. 넷째 띠가 생기면 표를 먼저 고치고 여기에 더한다 */
const BOUNDARIES = [768, 1024, 1440]

/** 한 경계는 두 얼굴을 갖는다 — 위에서 열거나(`min`), 아래에서 닫거나(`max`) */
const ALLOWED = new Set(
  BOUNDARIES.flatMap((px) => [`min-width: ${px}px`, `max-width: ${px - 1}px`]),
)

/** 미디어 쿼리 안의 폭 조건만 모은다 — `max-width: 420px` 같은 속성은 대상이 아니다 */
function widthConditions(): { path: string; condition: string }[] {
  const found: { path: string; condition: string }[] = []
  for (const [path, source] of cssFiles()) {
    for (const query of uncommented(source).matchAll(/@media[^{]+/g)) {
      for (const width of (query[0] ?? '').matchAll(/(?:min|max)-width:\s*[\d.]+px/g)) {
        found.push({ path, condition: (width[0] ?? '').replace(/\s+/g, ' ') })
      }
    }
  }
  return found
}

describe('F-9 — 폭 경계는 tokens.css 의 표가 정한 셋뿐이다', () => {
  it('F9_읽는_방식이_미디어_쿼리를_실제로_잡는다', () => {
    // 정규식이 어느 날 아무것도 잡지 못하게 되면 아래 검사가 조용히 통과한다.
    expect(widthConditions().length).toBeGreaterThanOrEqual(20)
  })

  it('199_표에_없는_폭이_새로_생기지_않는다', () => {
    const strays = widthConditions()
      .filter(({ condition }) => !ALLOWED.has(condition))
      .map(({ path, condition }) => `${path} — ${condition}`)
    expect(strays).toStrictEqual([])
  })
})
