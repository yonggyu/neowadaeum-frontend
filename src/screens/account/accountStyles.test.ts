import { describe, expect, it } from 'vitest'

import { cssFiles, uncommented } from '../../styles/cssTokens'

/**
 * 계정 다섯 화면의 크기와 흐린 색 (#136 이행 · #159).
 *
 * 규칙도 읽는 방식도 `authoring/authoringStyles.test.ts` · `admin/adminStyles.test.ts` 와
 * 같다. **한 파일로 합치지 않는다** — 규칙이 걸리는 대상이 *그 구역의 CSS* 이고, 장식으로
 * 남기기로 한 선택자도 구역마다 다르다(여기에는 설정 줄의 `›` 가 있고 작품 만들기에는
 * 없다). 합치면 한쪽 화면이 늘 때 다른 쪽의 경계가 함께 흔들린다.
 */

/** `src/screens/account/**` 의 CSS. 새 화면이 늘어도 규칙이 그 화면에 저절로 걸린다 */
function accountCss(): [string, string][] {
  const found = cssFiles().filter(([path]) => path.includes('/screens/account/'))
  // 읽는 방식이 어느 날 아무것도 잡지 못하게 되면 아래 검사들이 조용히 통과한다.
  expect(found.length).toBeGreaterThanOrEqual(6)
  return found
}

/** 소유자가 확정한 아홉. 이름을 여기 적는 것은 **열째가 생기는 것도 잡기 위해서**다 */
const SCALE = ['xs', 'sm', 'base', 'md', 'lg', 'read', 'xl', '2xl', '3xl']

describe('#136 — 계정 구역의 크기는 전부 스케일 아홉이다', () => {
  it('136_account_에_font_size_리터럴이_남지_않았다', () => {
    const literals: string[] = []
    for (const [path, source] of accountCss()) {
      for (const match of uncommented(source).matchAll(/font-size:\s*([^;]+);/g)) {
        const value = (match[1] ?? '').trim()
        if (!value.startsWith('var(--fs-')) literals.push(`${path} — ${value}`)
      }
    }
    expect(literals).toStrictEqual([])
  })

  it('136_아홉_밖의_이름을_집어_들지_않는다', () => {
    const unknown: string[] = []
    for (const [path, source] of accountCss()) {
      for (const match of uncommented(source).matchAll(/font-size:\s*var\(--fs-([\w-]+)\);/g)) {
        const step = match[1] ?? ''
        if (!SCALE.includes(step)) unknown.push(`${path} — --fs-${step}`)
      }
    }
    expect(unknown).toStrictEqual([])
  })
})

describe('#159 — --fg-subtle 은 읽지 않는 자리에만 남는다', () => {
  /**
   * 소유자가 정한 경계다 — 못 누르는 상태와 장식(`.chevron` 은 설정 줄 오른쪽의 `›` 다).
   *
   * 올라간 쪽에 **서버가 준 문장**이 있다: `.meta` 는 `role="alert"` 로 오류 `message` 를,
   * `role="status"` 로 저장 결과를 그대로 싣는 자리다 (F-4). 그 문장을 읽지 못할 색으로
   * 보여 주는 것은 *문구를 프론트가 지어내지 않는다*는 규칙의 절반만 지키는 것이다.
   */
  const DECORATION = (selector: string): boolean =>
    selector.includes(':disabled') || selector === '.chevron'

  it('159_읽는_글자에_흐린_색을_쓰지_않는다', () => {
    const readable: string[] = []
    for (const [path, source] of accountCss()) {
      // 가장 안쪽 `{ … }` 만 잡힌다 — `@media (...) {` 는 중괄호를 품고 있어 선택자가 되지 못한다.
      for (const rule of uncommented(source).matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
        const selector = (rule[1] ?? '').trim().replace(/\s+/g, ' ')
        if (!(rule[2] ?? '').includes('color: var(--fg-subtle)')) continue
        if (!DECORATION(selector)) readable.push(`${path} — ${selector}`)
      }
    }
    expect(readable).toStrictEqual([])
  })

  it('159_흐린_색이_붙은_자리가_다시_늘지_않는다', () => {
    let places = 0
    for (const [, source] of accountCss()) {
      places += uncommented(source).split('color: var(--fg-subtle)').length - 1
    }
    expect(places).toBe(4)
  })
})
