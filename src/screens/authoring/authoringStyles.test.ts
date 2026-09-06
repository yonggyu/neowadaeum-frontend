import { describe, expect, it } from 'vitest'

import { cssFiles, uncommented } from '../../styles/cssTokens'

/**
 * 작품 만들기의 크기와 흐린 색 (#136 이행 · #159).
 *
 * **러너에 DOM 이 없다.** 그래서 여기서 지키는 것은 *어떻게 보이는가* 가 아니라 **어느 값을
 * 집어 들었는가**다 — 크기가 스케일 아홉 밖으로 나가지 않는가, `--fg-subtle` 이 읽어야 하는
 * 글자에 다시 붙지 않는가. 둘 다 무너지는 방식이 조용하다: 새 규칙 하나가 `0.8125rem` 을
 * 손으로 적어도 화면은 그대로 그려지고, 흐린 색이 한 자리 늘어도 **읽지 못한 작성자가 상한을
 * 넘긴 뒤에야** 그 사실이 드러난다.
 *
 * 읽는 도구는 `styles/cssTokens` 에 있다 — `palette.test.ts`(#135 · #138) ·
 * `typography.test.ts`(#136) · `admin/adminStyles.test.ts`(#164)가 쓰는 것과 같다.
 *
 * **이 파일은 작품 만들기만 본다.** 같은 규칙을 `src/**` 전체에 거는 것은 세 영역의 이행이
 * 모두 끝난 뒤의 일이고, 그 자리는 `styles/` 의 두 테스트다 — `adminStyles.test.ts` 가 적어
 * 둔 것과 같은 뜻이다.
 */

/** `src/screens/authoring/**` 의 CSS. 새 화면이 늘어도 규칙이 그 화면에 저절로 걸린다 */
function authoringCss(): [string, string][] {
  const found = cssFiles().filter(([path]) => path.includes('/screens/authoring/'))
  // 읽는 방식이 어느 날 아무것도 잡지 못하게 되면 아래 검사들이 조용히 통과한다.
  expect(found.length).toBeGreaterThanOrEqual(2)
  return found
}

/** 소유자가 확정한 아홉. 이름을 여기 적는 것은 **열째가 생기는 것도 잡기 위해서**다 */
const SCALE = ['xs', 'sm', 'base', 'md', 'lg', '2lg', 'xl', '2xl', '3xl']

describe('#136 — 작품 만들기의 크기는 전부 스케일 아홉이다', () => {
  it('136_authoring_에_font_size_리터럴이_남지_않았다', () => {
    // 값을 화면이 직접 적기 시작하면 스케일의 정본이 사라진다. 열다섯 종이 생겼던 경로가
    // 이것이고, 한 번 흩어지면 다시 세어 접는 일을 처음부터 해야 한다.
    const literals: string[] = []
    for (const [path, source] of authoringCss()) {
      for (const match of uncommented(source).matchAll(/font-size:\s*([^;]+);/g)) {
        const value = (match[1] ?? '').trim()
        if (!value.startsWith('var(--fs-')) literals.push(`${path} — ${value}`)
      }
    }
    expect(literals).toStrictEqual([])
  })

  it('136_아홉_밖의_이름을_집어_들지_않는다', () => {
    const unknown: string[] = []
    for (const [path, source] of authoringCss()) {
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
   * 소유자가 정한 경계다 — 못 누르는 상태와 장식이다. 남은 글자 수 · 임시 저장 상태 ·
   * 필드가 누구에게 보이는지 · **검수가 막은 자리의 설명**은 전부 `--fg-muted` 로 올렸다.
   *
   * **작품 만들기에서 이 판단이 무거운 이유는 상한 때문이다.** 작성자가 `38 / 40` 을 읽지
   * 못하면 다음 글자에서 입력이 잘리고, 잘린 것을 알려 주는 자리도 같은 흐린 색이었다.
   */
  const DECORATION = (selector: string): boolean => selector.includes(':disabled')

  it('159_읽는_글자에_흐린_색을_쓰지_않는다', () => {
    const readable: string[] = []
    for (const [path, source] of authoringCss()) {
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
    // 위의 검사는 *어떤 자리인가*를 보고 이 줄은 *몇 자리인가*를 본다. 못 누르는 버튼이
    // 하나 더 생기는 것은 자연스럽지만, 이 숫자가 소리 없이 자라는 것은 그 뜻이 아니다.
    let places = 0
    for (const [, source] of authoringCss()) {
      places += uncommented(source).split('color: var(--fg-subtle)').length - 1
    }
    expect(places).toBe(5)
  })

  it('159_장식은_그대로_흐리다', () => {
    // 규칙은 *`--fg-subtle` 을 지운다* 가 아니다. 구분선 · 테두리 · 장식은 그 값이 감당할 수
    // 있는 자리이고, 초안을 기다리는 동안 도는 점 셋이 여기 남는 이유가 그것이다 —
    // 글자가 아니라 배경이고, 읽는 것이 아니라 움직이는 것이다.
    const wizard = authoringCss().find(([path]) => path.endsWith('wizard.module.css'))?.[1] ?? ''
    expect(uncommented(wizard)).toMatch(/\.dots i\s*\{[^}]*background:\s*var\(--fg-subtle\)/)
  })
})
