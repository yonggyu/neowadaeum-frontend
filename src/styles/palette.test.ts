import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { cssFiles, darkBlock, declarations, rootBlock, uncommented } from './cssTokens'

/**
 * 팔레트와 다크 (#135 · #138).
 *
 * 여기서 지키려는 것은 하나다 — **검수 상태 여섯이 서로 다르게 보인다.** 그전에는 일곱이
 * 뉴트럴 배지 하나를 나눠 써서 공개 중인 작품과 정지된 작품이 같아 보였고, 그 상태로
 * 되돌아가는 길은 조용하다: 토큰 하나가 `var(--fg-muted)` 로 바뀌면 화면은 여전히 그려지고
 * 테스트도 없으면 아무도 모른다. 색은 눈으로 보는 것이라 회귀가 보이지 않는다.
 *
 * 대비를 여기서 **계산한다.** PR 본문에 숫자를 적어 두는 것으로는 다음 변경을 막지 못한다.
 */
const TOKENS = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')

const LIGHT = declarations(rootBlock(TOKENS))
const DARK = declarations(rootBlock(darkBlock(TOKENS)))

/** 결 여섯 — `screens/account/reviewStatus.ts` 의 `ReviewTone` 과 같은 여섯이다 */
const TONES = ['draft', 'pending', 'in-review', 'approved', 'rejected', 'suspended'] as const

/** 서버가 무언가를 판정한 뒤의 넷. 다크가 제 값을 따로 갖는 것이 이 넷이다 */
const JUDGED = ['in-review', 'approved', 'rejected', 'suspended'] as const

describe('#138 — 다크는 시스템만 따르고 토글을 두지 않는다', () => {
  it('138_color_scheme_을_선언한다', () => {
    // 없으면 스크롤바 · 폼 컨트롤 · <select> 의 기본 그리기가 라이트로 남아, 어두운 화면에
    // 우리가 칠하지 않은 밝은 조각이 뜬다.
    expect(TOKENS).toMatch(/color-scheme:\s*light dark/)
  })

  it('138_판을_가르는_미디어_쿼리는_이_파일_하나다', () => {
    // 화면이 각자 `prefers-color-scheme` 을 열면 값의 정본이 둘이 된다. 토큰만 갈리면
    // 나머지는 따라온다 — 그것이 이 구조를 고른 이유 전부다.
    expect(count(uncommented(TOKENS), 'prefers-color-scheme')).toBe(1)
    for (const [path, source] of cssFiles()) {
      if (path.endsWith('tokens.css')) continue
      expect(`${path}: ${uncommented(source)}`).not.toContain('prefers-color-scheme')
    }
  })

  it('138_판을_고르는_상태를_우리가_들지_않는다', () => {
    // 토글을 두면 그 값을 어디에 저장할지가 따라온다. 계정 설정은 읽을 경로가 없는 항목을
    // 철거한 화면이고, 저장소가 정해지지 않은 칸을 새로 들이면 그 철거의 근거가 뒤집힌다.
    for (const [path, source] of cssFiles()) {
      expect(`${path}: ${source}`).not.toContain('[data-theme')
    }
  })
})

describe('#135 — 방향 A · 바뀐 것은 --bg 하나이고 는 것은 --accent 하나다', () => {
  it('135_라이트의_바탕이_종이다', () => {
    expect(LIGHT.get('--bg')).toBe('#faf8f4')
  })

  it('135_지우지_않기로_한_뉴트럴은_그대로다', () => {
    // 소유자가 값을 고른 근거가 `--bg-sunken` 이다 — 6차 와이어프레임이 정한 이 값이 이미
    // 따뜻했고 흰 바탕만 거기서 어긋나 있었다. 이 줄이 바뀌면 근거 자체가 사라진다.
    expect(LIGHT.get('--bg-sunken')).toBe('#f0eee9')
    expect(LIGHT.get('--fg')).toBe('#1a1a1a')
    expect(LIGHT.get('--border')).toBe('rgba(0, 0, 0, 0.12)')
    expect(LIGHT.get('--focus')).toBe('#2a78d6')
    expect(LIGHT.get('--danger')).toBe('#d64545')
  })

  it('135_accent_가_생겼고_두_판이_각자_갖는다', () => {
    expect(LIGHT.get('--accent')).toBe('#2b6ca8')
    expect(DARK.get('--accent')).toBe('#7fb2e0')
  })

  it('138_다크가_뉴트럴_전부를_다시_정의한다', () => {
    // 하나라도 빠지면 그 자리만 라이트의 값으로 남고, 어두운 화면에 밝은 조각이 된다.
    for (const name of ['--fg', '--fg-muted', '--fg-subtle', '--bg', '--bg-sunken', '--border']) {
      expect(DARK.has(name)).toBe(true)
    }
  })
})

describe('#135 — 검수 상태 여섯이 서로 다른 값을 갖는다', () => {
  it.each(['라이트', '다크'])('135_%s_여섯이_서로_다른_값을_갖는다', (theme) => {
    const scope = theme === '라이트' ? LIGHT : DARK
    // 하나가 나중에 뉴트럴로 되돌아가는 것을 잡는 자리다.
    const looks = TONES.map((tone) =>
      ['fg', 'bg', 'border', 'dot'].map((part) => resolve(scope, `--status-${tone}-${part}`)).join('/'),
    )
    expect(new Set(looks).size).toBe(TONES.length)
  })

  it.each(['라이트', '다크'])('135_%s_판정_넷은_색이_저마다_다르다', (theme) => {
    const scope = theme === '라이트' ? LIGHT : DARK
    // `작성 중` 과 `접수됨` 은 일부러 같은 글자색·바탕을 쓴다 — 아직 아무 판정도 없다는
    // 뜻이다. 그 둘을 가르는 것은 점선 테두리와 점이고, 색을 갖는 것은 판정 넷이다.
    for (const part of ['fg', 'bg']) {
      const values = JUDGED.map((tone) => resolve(scope, `--status-${tone}-${part}`))
      expect(new Set(values).size).toBe(JUDGED.length)
      expect(values).not.toContain(resolve(scope, part === 'fg' ? '--fg-muted' : '--bg'))
    }
  })

  it.each(['라이트', '다크'])('135_%s_색을_보지_못해도_여섯이_갈린다', (theme) => {
    const scope = theme === '라이트' ? LIGHT : DARK
    // 색만으로 말하지 않는다 — 점 여섯이 저마다 다르고 `접수됨` 은 점선을 갖는다.
    const dots = TONES.map((tone) => resolve(scope, `--status-${tone}-dot`))
    expect(new Set(dots).size).toBe(TONES.length)
    const sheet = readFileSync(new URL('../screens/account/account.module.css', import.meta.url), 'utf8')
    expect(uncommented(sheet)).toMatch(/\.statusPending\s*\{[^}]*border-style:\s*dashed/)
  })

  it('135_다크가_판정_넷의_네_값을_전부_다시_정의한다', () => {
    for (const tone of JUDGED) {
      for (const part of ['fg', 'bg', 'border', 'dot']) {
        expect(DARK.has(`--status-${tone}-${part}`)).toBe(true)
      }
    }
  })

  it('135_반려는_danger_를_쓰지_않는다', () => {
    // 이 PR 에서 가장 중요한 줄이다. `tokens.css` 가 그 색을 되돌릴 수 없는 동작에만 쓰기로
    // 적어 두었고 (탈퇴 · 세션 삭제 · 원고 삭제의 확인 버튼), 같은 빨강을 배지에 얹으면
    // 반려된 작품 옆의 표시가 *누르면 되돌릴 수 없다* 로 읽힌다. 배지는 누를 수 없는데도.
    for (const scope of [LIGHT, DARK]) {
      const danger = resolve(scope, '--danger')
      for (const tone of TONES) {
        for (const part of ['fg', 'bg', 'border', 'dot']) {
          const name = `--status-${tone}-${part}`
          if (!scope.has(name)) continue
          expect(scope.get(name)).not.toContain('var(--danger)')
          expect(resolve(scope, name)).not.toBe(danger)
        }
      }
    }
  })

  it('135_배지가_이_토큰_말고_다른_색을_적지_않는다', () => {
    // 값을 화면이 직접 적기 시작하면 다크에서 그 자리만 라이트로 남는다.
    const badges = uncommented(
      readFileSync(new URL('../screens/account/account.module.css', import.meta.url), 'utf8'),
    )
    for (const tone of TONES) {
      expect(badges).toContain(`--status-${tone}-fg`)
      expect(badges).toContain(`--status-${tone}-dot`)
    }
    expect(badges).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(badges).not.toMatch(/rgba?\(/i)
  })
})

describe('#135 · #138 — 배지 여섯의 대비가 WCAG AA(본문 4.5:1)를 넘는다', () => {
  it.each(['라이트', '다크'])('135_%s_여섯이_전부_4_5_를_넘는다', (theme) => {
    const scope = theme === '라이트' ? LIGHT : DARK
    for (const tone of TONES) {
      const bg = flatten(parse(resolve(scope, `--status-${tone}-bg`)), parse(resolve(scope, '--bg')))
      const fg = flatten(parse(resolve(scope, `--status-${tone}-fg`)), bg)
      expect(round(contrast(fg, bg)), `${theme} · ${tone}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each(['라이트', '다크'])('138_%s_의_본문과_보조_텍스트가_AA_를_넘는다', (theme) => {
    // 판이 하나 느는 것과 나쁜 판이 하나 느는 것은 다르다. 다크를 붙이면서 읽기가 나빠지면
    // 안 되므로 두 판에 같은 선을 긋는다.
    //
    // **`--fg-subtle` 은 여기 없다.** 라이트의 값이 4.5 아래이고 (#135 가 그 값을 그대로
    // 두기로 했다) 다크는 그보다 낫다 — 이 PR 에서 고치면 소유자가 확정한 표를 화면이
    // 뒤집는 것이 되므로 이슈 후보로 남긴다.
    const scope = theme === '라이트' ? LIGHT : DARK
    expect(onBackground(scope, '--fg')).toBeGreaterThanOrEqual(7)
    expect(onBackground(scope, '--fg-muted')).toBeGreaterThanOrEqual(4.5)
  })
})

describe('#138 — 하드코딩한 뉴트럴이 다크에서 라이트로 남지 않는다', () => {
  it.each(['../styles/sheet.module.css', '../components/confirm.module.css'])(
    '138_%s_의_막은_토큰이다',
    (file) => {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')
      expect(source).toContain('var(--scrim)')
      expect(source).not.toMatch(/rgba?\(\s*0[\s,]/)
    },
  )

  it('138_스크림은_두_판이_각자_갖는다', () => {
    // 어두운 판에서 막의 일은 바탕을 어둡게 하는 것이 아니라 — 바탕은 이미 어둡다 —
    // 뒤에 남은 글자와 카드를 죽이는 것이다. 라이트의 값으로는 뒤가 그대로 읽힌다.
    expect(LIGHT.has('--scrim')).toBe(true)
    expect(DARK.has('--scrim')).toBe(true)
    expect(DARK.get('--scrim')).not.toBe(LIGHT.get('--scrim'))
  })

  /*
   * `--scrim` 과 같은 실패가 작품 만들기에 셋 남아 있었다 (#157). `rgba(214, 69, 69, …)` 은
   * `--danger` 의 **라이트 값을 풀어 적은 것**이라 다크에서 따라오지 않았고, 그 결과 같은
   * 요소의 테두리(`var(--danger)`)와 배경이 서로 다른 빨강이 됐다.
   */
  it('157_작품_만들기의_경고_톤은_토큰이다', () => {
    const source = uncommented(
      readFileSync(new URL('../screens/authoring/wizard.module.css', import.meta.url), 'utf8'),
    )
    expect(source).toContain('var(--danger-wash)')
    expect(source).toContain('var(--danger-wash-strong)')
    // `--danger` 의 라이트 값을 어떤 표기로도 손으로 적지 않는다
    expect(source).not.toMatch(/214[\s,]+69[\s,]+69/)
    expect(source.toLowerCase()).not.toContain('#d64545')
  })

  /*
   * **다크가 드러낸 셋째 자리** (#160). 판과 그 뒤가 같은 색이면, 막을 아무리 진하게 해도
   * 앞의 판이 앞이라고 말하지 못한다 — 라이트에서는 막 하나가 *뒤를 죽이는 일*과 *앞을
   * 띄우는 일*을 겸하고 있었고, 그 겸업이 어두운 판에서 깨졌다.
   */
  it('160_떠오른_면은_다크에서만_바탕과_갈린다', () => {
    expect(resolve(LIGHT, '--bg-raised')).toBe(resolve(LIGHT, '--bg'))
    expect(resolve(DARK, '--bg-raised')).not.toBe(resolve(DARK, '--bg'))
  })

  it('160_다크의_위계가_바탕_가라앉음_떠오름_순이다', () => {
    // 둘이 `--bg` 기준의 같은 한 칸이면 가라앉은 것과 떠오른 것이 같은 밝기가 된다.
    const lum = (name: string): number => luminance(parse(resolve(DARK, name)))
    expect(lum('--bg-sunken')).toBeGreaterThan(lum('--bg'))
    expect(lum('--bg-raised')).toBeGreaterThan(lum('--bg-sunken'))
  })

  it('160_뜬_판이_막을_지난_바탕과_1_5_대_1_이상으로_갈린다', () => {
    // 고치기 전이 1.08 이었다. 경계가 보이지 않는 값이고, 그 판 위에 되돌릴 수 없는
    // 동작의 확인이 선다 — 탈퇴 · 세션 삭제 · 원고 삭제.
    const behind = flatten(parse(resolve(DARK, '--scrim')), parse(resolve(DARK, '--bg')))
    expect(contrast(parse(resolve(DARK, '--bg-raised')), behind)).toBeGreaterThanOrEqual(1.5)
  })

  it('157_경고_톤은_두_판이_각자_갖고_다크가_더_진하다', () => {
    // 어두운 바닥 위의 4% 막은 보이지 않는다 — 검수가 막은 카드와 그냥 카드가 배경으로는
    // 구분되지 않고, 남는 것이 테두리 하나뿐이면 이 톤을 두는 뜻이 없다.
    for (const name of ['--danger-wash', '--danger-wash-strong'] as const) {
      expect(LIGHT.has(name)).toBe(true)
      expect(DARK.has(name)).toBe(true)
      expect(alphaOf(DARK.get(name) ?? '')).toBeGreaterThan(alphaOf(LIGHT.get(name) ?? ''))
    }
  })
})

/*
 * ── #159 — `--fg-subtle` 은 장식에만 ──────────────────────────────────────────
 *
 * 소유자 결정(2026-09-06): **값을 올리지 않는다.** 라이트 `0.38` 을 4.5 를 넘는 값으로
 * 올리면 그것이 곧 `--fg-muted` 이고, 세 단계가 둘이 되어 *읽지 않아도 된다* 를 색으로
 * 말하는 자리가 사라진다. 대신 **읽어야 하는 글자를 `--fg-muted` 로 올리고**, 이 값은
 * 그것이 감당할 수 있는 자리 — 구분선 · 테두리 · 장식 아이콘 · 비활성 — 로 좁힌다.
 *
 * 규칙을 문장으로만 남기면 다음 화면에서 되돌아온다. 그래서 여기서 센다.
 */
describe('#159 — --fg-subtle 은 읽지 않는 자리에만 남는다', () => {
  /**
   * 이행이 끝난 묶음(Play · Library · 신고 · system · shell)에 남은 **전부**다.
   * 넷 다 읽지 않아도 화면이 성립한다 — 비활성 셋은 WCAG 가 대비를 요구하지 않는 자리이고
   * (흐린 것이 곧 *지금 누를 수 없다*는 신호다), `.icon` 은 글자가 아니라 그림이다.
   */
  const DECORATIVE = [
    'screens/play/play.module.css .action:disabled',
    'screens/play/play.module.css .actionPrimary:disabled',
    'screens/system/system.module.css .action:disabled',
    'screens/system/system.module.css .icon',
  ]

  it('159_이행한_영역에는_장식만_남았다', () => {
    // 목록이 **정확히 같아야** 한다. 늘어나면 읽는 글자가 되돌아온 것이고, 줄어들면
    // 비활성 표시가 사라진 것이다 — 둘 다 이 결정이 막으려는 것이다.
    expect(subtleTextUses(MIGRATED).sort()).toStrictEqual([...DECORATIVE].sort())
  })

  it('159_나머지_화면에서도_쓰는_자리가_늘지_않는다', () => {
    // 아직 훑지 않은 화면들(작품 만들기 · 계정)은 같은 배치의 다른 PR 이 줄인다. 여기서
    // 지키는 것은 **늘지 않는다**는 것 하나다 — 새 화면이 이 값을 글자에 집어 들면 그 화면이
    // 머지되는 자리에서 깨지고, 남은 이행이 끝날 때마다 이 수는 내려간다.
    expect(subtleTextUses().length).toBeLessThanOrEqual(37)
  })
})

/** `--fg-subtle` 이 **글자 색**으로 쓰인 자리. 배경 · 테두리 · 그라디언트는 세지 않는다 */
function subtleTextUses(dirs?: string[]): string[] {
  const found: string[] = []
  for (const [path, source] of cssFiles()) {
    // `cssFiles()` 가 주는 것은 절대 경로다. 앞의 슬래시를 걷어 `src/` 아래 경로로 맞춘다
    const relative = (path.split('/src/')[1] ?? path).replace(/^\/+/, '')
    if (dirs !== undefined && !dirs.some((dir) => relative.startsWith(dir))) continue
    // 가장 안쪽 `{ … }` 만 잡힌다 — `@media (...) {` 는 중괄호를 품고 있어 선택자가 되지 못한다
    for (const rule of uncommented(source).matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
      // 앞에 `background-`(또는 `border-`)가 붙은 것은 글자가 아니다 — 구분자를 함께 본다
      if (!/(?:^|[;{\s])color:\s*var\(--fg-subtle\)/.test(rule[2] ?? '')) continue
      found.push(`${relative} ${(rule[1] ?? '').trim()}`)
    }
  }
  return found
}

const MIGRATED = ['screens/play/', 'screens/library/', 'screens/report/', 'screens/system/', 'shell/']

/** `rgb(r g b / N%)` 의 `N`. 두 판의 막이 얼마나 진한지만 비교하므로 백분율만 읽는다. */
function alphaOf(value: string): number {
  const percent = /\/\s*([\d.]+)%/.exec(value)
  if (percent === null) throw new Error(`백분율 표기를 찾지 못했다: ${value}`)
  return Number(percent[1])
}

// ── 읽는 도구 ────────────────────────────────────────────────────────────────
//
// `uncommented` · `rootBlock` · `darkBlock` · `declarations` · `cssFiles` 는 `./cssTokens`
// 에 있다 — `typography.test.ts`(#136)가 같은 것을 읽으면서 사용처가 둘이 됐다.

/** 다크는 라이트 위에 얹힌다 — 다시 정의하지 않은 이름은 라이트의 것을 그대로 쓴다 */
function resolve(scope: Map<string, string>, name: string, depth = 0): string {
  if (depth > 8) throw new Error(`${name} 이 자기를 가리킨다`)
  const value = scope.get(name) ?? LIGHT.get(name)
  if (value === undefined) throw new Error(`${name} 이 없다`)
  const alias = /^var\((--[\w-]+)\)$/.exec(value)?.[1]
  return alias === undefined ? value : resolve(scope, alias, depth + 1)
}

const onBackground = (scope: Map<string, string>, name: string): number => {
  const bg = parse(resolve(scope, '--bg'))
  return contrast(flatten(parse(resolve(scope, name)), bg), bg)
}

// ── 대비 (WCAG 2.1 상대 휘도) ─────────────────────────────────────────────────

type Rgba = { r: number; g: number; b: number; a: number }

function parse(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value)?.[1]
  if (hex !== undefined) {
    const n = Number.parseInt(hex, 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 }
  }
  // `rgba(0, 0, 0, 0.55)` 와 `rgb(0 0 0 / 45%)` 둘 다 이 파일에 있다 — 구분자를 세지 않고
  // 숫자만 뽑는다. 넷째가 없으면 불투명이고, 백분율 표기면 100 으로 나눈다.
  const parts = (value.match(/[\d.]+/g) ?? []).map(Number)
  const [r, g, b, alpha] = parts
  if (r === undefined || g === undefined || b === undefined) throw new Error(`읽지 못한 색: ${value}`)
  const a = alpha ?? 1
  return { r, g, b, a: value.includes('%') ? a / 100 : a }
}

const flatten = (top: Rgba, under: Rgba): Rgba => ({
  r: top.r * top.a + under.r * (1 - top.a),
  g: top.g * top.a + under.g * (1 - top.a),
  b: top.b * top.a + under.b * (1 - top.a),
  a: 1,
})

const luminance = ({ r, g, b }: Rgba): number => {
  const channel = (v: number): number => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: Rgba, b: Rgba): number {
  const one = luminance(a)
  const other = luminance(b)
  return (Math.max(one, other) + 0.05) / (Math.min(one, other) + 0.05)
}

const round = (n: number): number => Math.round(n * 100) / 100
const count = (text: string, needle: string): number => text.split(needle).length - 1

