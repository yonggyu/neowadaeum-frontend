import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { cssFiles, declarations, rootBlock, uncommented } from './cssTokens'

/**
 * 타이포 스케일과 글자체 (#136).
 *
 * **러너에 DOM 이 없다.** 그래서 여기서 지키는 것은 *어떻게 보이는가* 가 아니라 **토큰들
 * 사이의 관계**다 — 아홉이 서로 다르고 단조증가하는가, 두 글자체가 폴백을 끝까지 갖는가,
 * 큰 제목을 쓰는 자리가 전부 명조를 집어 드는가. 그 셋은 눈으로 보지 않아도 참·거짓이 갈리고,
 * 무너지는 방식이 조용하다: 단계 하나가 이웃과 같은 값이 되면 화면은 여전히 그려지고
 * 폴백이 빠진 스택은 **웹폰트가 오는 자리에서만** 멀쩡하다.
 *
 * 읽는 도구는 `./cssTokens` 에 있다 — `palette.test.ts`(#135 · #138)와 같은 것을 쓴다.
 */
const TOKENS = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
const ROOT = declarations(rootBlock(TOKENS))
const INDEX_HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')

/** 소유자가 확정한 순서 그대로. 값이 아니라 **차례**가 여기 있는 사실이다 */
const SCALE = [
  '--fs-xs',
  '--fs-sm',
  '--fs-base',
  '--fs-md',
  '--fs-lg',
  '--fs-2lg',
  '--fs-xl',
  '--fs-2xl',
  '--fs-3xl',
] as const

/**
 * 행간 여섯 (#168). 크기와 같이 **차례**가 여기 있는 사실이다 — 촘촘한 쪽에서 넓은 쪽으로.
 */
const LEADING = [
  '--lh-tight',
  '--lh-snug',
  '--lh-normal',
  '--lh-relaxed',
  '--lh-loose',
  '--lh-read',
] as const

/**
 * 행간을 토큰으로 적지 **않아도 되는** 자리. 글줄이 아닌 것만 여기 온다.
 *
 * **선택자까지 적는다.** 파일 단위로 면제하면 그 파일에 새로 생기는 글줄이 통째로 규칙
 * 밖으로 나가고, 그 구멍은 화면에서 보이지 않는다.
 */
const EXEMPT = [
  {
    file: 'screens/play/play.module.css',
    selector: '.menuButton',
    value: '1',
    // 44px 칸 가운데의 글리프 하나(`⋯`)다. `1` 은 *촘촘하게 읽힌다* 가 아니라 글자 상자를
    // 글리프에 맞춰 `align-items: center` 가 실제로 가운데를 잡게 하는 값이다 — 행간 여섯
    // 중 무엇을 넣어도 아이콘이 위로 밀린다. 근거는 그 자리의 주석에도 있다.
    why: '글줄이 아니라 아이콘 정렬',
  },
] as const

/**
 * 큰 제목의 크기. 이행(#136 의 뒤따르는 PR 셋)이 끝나면 왼쪽 둘은 사라지고 토큰만 남는데,
 * **그 사이에도 같은 규칙이 걸려야 하므로** 둘 다 적는다.
 */
const BIG = ['1.5rem', '2rem', 'var(--fs-2xl)', 'var(--fs-3xl)']

describe('#136 — 스케일 아홉', () => {
  it('136_아홉_단계가_전부_있다', () => {
    for (const name of SCALE) expect(ROOT.has(name), name).toBe(true)
  })

  it('136_아홉이_서로_다르고_단조증가한다', () => {
    // 값이 겹치거나 순서가 뒤집히면 그것은 스케일이 아니라 그냥 아홉 개의 숫자다. 그 상태는
    // 화면에서 보이지 않는다 — `--fs-md` 를 고르든 `--fs-lg` 를 고르든 같아 보이기 때문이다.
    const rem = SCALE.map((name) => remOf(ROOT.get(name) ?? ''))
    expect(new Set(rem).size).toBe(SCALE.length)
    expect(rem).toStrictEqual([...rem].sort((a, b) => a - b))
  })

  it('136_소유자가_고른_아홉_값_그대로다', () => {
    // 이슈 #136 의 결정 코멘트가 정본이다. 지금 쓰이는 값의 분포를 세어 접은 것이라
    // 여기서 한 단계를 슬쩍 옮기면 그 근거가 사라진다.
    expect(SCALE.map((name) => ROOT.get(name))).toStrictEqual([
      '0.75rem',
      '0.8125rem',
      '0.875rem',
      '0.9375rem',
      '1rem',
      '1.0625rem',
      '1.25rem',
      '1.5rem',
      '2rem',
    ])
  })

  it('136_읽는_쪽이_가장_넓고_1_75_다', () => {
    // 셋이던 행간은 `#168` 이 여섯으로 늘렸다 — 개수는 아래 `#168` 묶음이 센다. 여기 남는
    // 것은 `#136` 이 정한 두 사실이다: **읽는 쪽이 끝이고**, 그 값이 `1.75` 다.
    const read = Number(ROOT.get('--lh-read'))
    const normal = Number(ROOT.get('--lh-normal'))
    const tight = Number(ROOT.get('--lh-tight'))
    expect(read).toBeGreaterThan(normal)
    expect(normal).toBeGreaterThan(tight)
    // `.narration` 이 이미 쓰던 값이다 — `#136` 으로 행간이 바뀌지 않는다는 사실이 이 줄이다.
    expect(read).toBe(1.75)
  })

  it('136_스케일은_폭에_따라_바뀌지_않는다', () => {
    // F-9 — 네 폭이 같은 스케일을 쓴다. 폭에 따라 커져야 하는 자리는 **그 자리가 단계를
    // 바꿔** 말하고, 아홉 단계 전체가 미디어 쿼리를 갖지 않는다. 여기가 무너지면 모든
    // 토큰에 *어느 폭의 값인가* 가 따라붙는다.
    const stripped = uncommented(TOKENS)
    const outside = stripped.slice(0, stripped.indexOf('@media'))
    for (const name of [...SCALE, ...LEADING]) {
      expect(count(stripped, `${name}:`), name).toBe(1)
      expect(outside, name).toContain(`${name}:`)
    }
  })
})

describe('#136 — 글자체 둘', () => {
  it('136_두_글자체가_폴백을_갖는다', () => {
    // 웹폰트는 네트워크 너머에 있어서 오지 않을 수 있다. 스택이 한 벌뿐이면 그때 화면이
    // 무너지고, `index.html` 의 `display=swap` 과 짝이 되는 조건이 이것이다.
    const ui = families('--font-ui')
    const read = families('--font-read')
    expect(ui.length).toBeGreaterThan(1)
    expect(read.length).toBeGreaterThan(1)
    expect(ui.at(-1)).toBe('sans-serif')
    expect(read.at(-1)).toBe('serif')
  })

  it('136_고딕_폴백은_body_가_쓰던_스택_그대로다', () => {
    // 웹폰트를 앞에 얹은 것이지 그전 화면을 바꾼 것이 아니다. 폰트가 오지 않는 자리에서는
    // 이 PR 이전과 **글자 하나 다르지 않아야** 한다.
    expect(families('--font-ui').slice(1)).toStrictEqual([
      'system-ui',
      '-apple-system',
      '"Apple SD Gothic Neo"',
      'sans-serif',
    ])
  })

  it('136_글자체_이름을_화면이_직접_적지_않는다', () => {
    // 값의 자리는 `tokens.css` 하나다. 화면이 `"Noto Serif KR"` 을 직접 적기 시작하면
    // 폴백 스택이 그 자리마다 갈라지고, 한 곳만 고쳐지는 날이 온다.
    for (const [path, source] of cssFiles()) {
      if (path.endsWith('tokens.css')) continue
      expect(`${path}: ${uncommented(source)}`).not.toContain('Serif KR')
      expect(`${path}: ${uncommented(source)}`).not.toContain('Plex Sans KR')
    }
  })

  it('136_body_가_고딕을_쓰고_명조는_읽는_자리가_집어_든다', () => {
    // 반대로 두면(기본을 명조로 두고 UI 가 되돌리면) 새 화면마다 되돌리는 줄이 하나씩 늘고,
    // 빠뜨린 화면은 버튼까지 명조가 된다.
    expect(uncommented(TOKENS)).toMatch(/body\s*\{[^}]*font-family:\s*var\(--font-ui\)/)
    expect(uncommented(TOKENS)).not.toContain('var(--font-read)')
  })
})

describe('#170 — 셋째 글자체, 등폭', () => {
  it('170_등폭_토큰이_폴백을_끝까지_갖는다', () => {
    // 받아 오는 웹폰트가 아니라 **시스템 스택**이라 폴백이 곧 값 전체다. `monospace` 로
    // 끝나지 않으면 앞의 이름이 하나도 없는 판에서 등폭이 아닌 글자로 그려지고, 그때
    // 식별자의 자릿수가 어긋난다 — 이 토큰이 사려던 것이 정확히 그것이다.
    const mono = families('--font-mono')
    expect(mono.length).toBeGreaterThan(1)
    expect(mono.at(-1)).toBe('monospace')
  })

  it('170_등폭_스택을_손으로_적지_않는다', () => {
    // 여덟 자리가 같은 스택을 각자 적고 있었다. 글자 하나까지 같았지만 그것은 우연이고,
    // 한 자리에 폰트를 더하는 날 나머지 일곱은 따라오지 않는다. 값의 자리는 `tokens.css`
    // 하나다 — `136_글자체_이름을_화면이_직접_적지_않는다` 가 웹폰트 둘에 건 규칙과 같다.
    const literals: string[] = []
    for (const [path, source] of cssFiles()) {
      if (path.endsWith('tokens.css')) continue
      for (const match of uncommented(source).matchAll(/font-family:\s*([^;]+);/g)) {
        const value = (match[1] ?? '').trim()
        if (!value.startsWith('var(--font-')) literals.push(`${path}: ${value}`)
      }
    }
    expect(literals).toStrictEqual([])
  })

  it('170_실제로_등폭_토큰을_쓴다', () => {
    // 위 검사는 `font-family` 가 한 줄도 없어도 통과한다 — 규칙이 *지켜지는 쪽*이 아니라
    // *사라지는 쪽*으로 무너질 수 있다. 옮겨 온 여덟 자리를 함께 센다.
    let used = 0
    for (const [, source] of cssFiles()) {
      used += [...uncommented(source).matchAll(/font-family:\s*var\(--font-mono\)/g)].length
    }
    expect(used).toBeGreaterThanOrEqual(8)
  })

  it('170_등폭과_tabular_nums_를_한_자리에_섞지_않는다', () => {
    // 둘은 다른 문제를 푼다. 등폭은 식별자와 JSON 을 **옮겨 적게** 하고, `tabular-nums` 는
    // 읽는 문장 안의 숫자가 흔들리지 않게 한다 — 후자를 등폭으로 바꾸면 문장이 깨진다.
    // 지금 두 무리는 파일 단위로도 겹치지 않는다.
    const both: string[] = []
    for (const [path, source] of cssFiles()) {
      for (const [selector, declared] of bySelector(source)) {
        if (!declared.includes('var(--font-mono)')) continue
        if (declared.includes('tabular-nums')) both.push(`${path} ${selector}`)
      }
    }
    expect(both).toStrictEqual([])
  })

  it('170_등폭은_받아_오지_않는다', () => {
    // 소유자가 정한 것이다 — 셋째 글자체를 네트워크로 더 받지 않는다. 등폭이 서는 자리에서
    // 필요한 것은 인상이 아니라 자릿수 정렬이고, 그것은 시스템 스택이 이미 한다.
    // 받아 오는 패밀리는 `#137` 의 둘 그대로다.
    expect([...fontHref().matchAll(/family=/g)]).toHaveLength(2)
  })
})

describe('#169 — 크기 토큰의 이름은 크기만 말한다', () => {
  /** 크기 낱말 여섯과 그 앞의 숫자 한 자리(`2xl` · `3xl` · `2lg`). 역할은 여기를 지나지 못한다 */
  const SIZE_ONLY = /^--fs-[2-9]?(xs|sm|base|md|lg|xl)$/

  it('169_스케일_이름에_역할이_들어가지_않는다', () => {
    // `--fs-read` 가 *읽는 자리* 라는 역할을 이름으로 말했는데, 그 단계에는 Story 본문
    // 하나와 UI 여덟이 함께 서 있었다. **이름이 규칙을 만든다** — 역할을 말하는 이름은
    // 다음 사람이 크기가 아니라 역할을 근거로 단계를 고르게 하고, 그 판단은 실제 분포와
    // 계속 갈린다. 자리를 말하는 것은 글자체(`--font-ui` · `--font-read`)의 몫이다.
    const names = new Set<string>()
    for (const name of ROOT.keys()) if (name.startsWith('--fs-')) names.add(name)
    for (const [, source] of cssFiles()) {
      for (const match of uncommented(source).matchAll(/var\((--fs-[\w-]+)\)/g)) {
        const name = match[1]
        if (name) names.add(name)
      }
    }
    expect([...names].filter((name) => !SIZE_ONLY.test(name))).toStrictEqual([])
    // 위 검사는 이름이 하나도 없어도 통과한다. 선언과 사용이 **같은 아홉**임을 함께 못박는다 —
    // 화면이 선언에 없는 단계를 부르기 시작하면 그것도 여기서 걸린다.
    expect([...names].sort()).toStrictEqual([...SCALE].sort())
  })
})

/**
 * **행간도 값을 화면이 적지 않는다** (#168).
 *
 * 크기가 `#136` 에서 겪은 것을 행간이 그대로 겪고 있었다 — 토큰 셋이 실제 분포를 덮지 못해
 * 리터럴 62자리가 남았고, 가장 많은 셋에는 토큰이 아예 없었다. 여섯으로 늘려 62자리를 전부
 * 옮겼고, **여기서 지키는 것은 그 상태가 다시 흩어지지 않는 것**이다.
 */
describe('#168 — 행간 여섯', () => {
  it('168_여섯_단계가_전부_있고_단조증가한다', () => {
    // 값이 겹치거나 순서가 뒤집히면 그것은 단계가 아니라 그냥 여섯 개의 숫자다 — 크기 아홉이
    // 같은 이유로 같은 검사를 갖는다. 행간은 특히 조용히 무너진다: 두 단계가 같아지면
    // 어느 쪽을 골라도 화면이 똑같이 그려져서, 고른 사람은 자기가 고른 줄로 안다.
    const values = LEADING.map((name) => {
      const raw = ROOT.get(name)
      expect(raw, name).toBeDefined()
      return Number(raw)
    })
    for (const [i, value] of values.entries()) expect(Number.isNaN(value), LEADING[i]).toBe(false)
    expect(new Set(values).size).toBe(LEADING.length)
    expect(values).toStrictEqual([...values].sort((a, b) => a - b))
  })

  it('168_행간을_손으로_적지_않는다', () => {
    // 값의 자리는 `tokens.css` 하나다. `136_어느_CSS_에도_font_size_리터럴이_없다` 가 크기에
    // 건 규칙과 같은 것이고, **면제는 목록으로만 열린다** — 넓은 구멍을 내지 않는다.
    const literals: string[] = []
    for (const [path, source] of cssFiles()) {
      for (const [selector, declared] of bySelector(source)) {
        for (const match of declared.matchAll(/line-height:\s*([^;]+);/g)) {
          const value = (match[1] ?? '').trim()
          if (value.startsWith('var(--lh-')) continue
          const exempt = EXEMPT.some(
            (one) => path.endsWith(one.file) && selector === one.selector && value === one.value,
          )
          if (!exempt) literals.push(`${path} ${selector}: ${value}`)
        }
      }
    }
    expect(literals).toStrictEqual([])
  })

  it('168_면제된_자리가_실제로_거기_있다', () => {
    // 위 검사는 면제 목록이 **낡아도** 통과한다 — 그 자리가 사라지거나 값이 바뀌면 목록만
    // 남아 다음 사람에게 *여기는 규칙 밖* 이라고 계속 말한다. 그러면 그 선택자가 언젠가
    // 글줄을 그리게 되는 날 아무도 모른다.
    for (const one of EXEMPT) {
      const found = cssFiles().find(([path]) => path.endsWith(one.file))
      expect(found, one.file).toBeDefined()
      const declared = bySelector(found?.[1] ?? '').get(one.selector)
      expect(declared, `${one.file} ${one.selector}`).toBeDefined()
      expect(declared, one.why).toContain(`line-height: ${one.value};`)
    }
  })

  it('168_실제로_행간_토큰을_쓴다', () => {
    // 위 검사는 `line-height` 가 한 줄도 없어도 통과한다 — 규칙이 *지켜지는 쪽*이 아니라
    // *사라지는 쪽*으로 무너질 수 있다. 옮겨 온 자리의 수를 함께 센다 (62 + 이미 토큰이던 17,
    // 면제 하나는 빼고 78).
    let used = 0
    for (const [, source] of cssFiles()) {
      used += [...uncommented(source).matchAll(/line-height:\s*var\(--lh-/g)].length
    }
    expect(used).toBeGreaterThanOrEqual(78)
  })

  it('168_여섯_밖의_이름을_집어_들지_않는다', () => {
    // 선언과 사용이 **같은 여섯**임을 못박는다. 화면이 선언에 없는 단계를 부르면 그 자리는
    // 상속된 행간으로 그려지고 — 아무것도 깨지지 않은 것처럼 보인다.
    const used = new Set<string>()
    for (const [, source] of cssFiles()) {
      for (const match of uncommented(source).matchAll(/line-height:\s*var\((--lh-[\w-]+)\)/g)) {
        const name = match[1]
        if (name) used.add(name)
      }
    }
    expect([...used].sort()).toStrictEqual([...LEADING].sort())
  })
})

describe('#136 — 명조가 걸리는 자리', () => {
  it('136_Story_본문이_명조와_크기와_행간을_함께_쓴다', () => {
    // 읽는 자리라고 말하는 것은 **글자체**다 (#169). 크기(`--fs-2lg`)는 여기 말고도 여덟
    // 자리가 함께 쓰는 한 단계일 뿐이라 그것만으로는 이 자리가 아니다 — 셋이 함께 걸려야
    // 본문이 본문으로 선다.
    const play = uncommented(
      readFileSync(new URL('../screens/play/play.module.css', import.meta.url), 'utf8'),
    )
    const body = /\.narration,\s*\.dialogue\s*\{([^}]*)\}/.exec(play)?.[1]
    expect(body).toBeDefined()
    expect(body).toContain('var(--font-read)')
    expect(body).toContain('var(--fs-2lg)')
    expect(body).toContain('var(--lh-read)')
  })

  it('136_큰_제목을_쓰는_자리가_전부_명조다', () => {
    // 소유자의 표가 정한 경계다 — 명조는 Story 본문과 `--fs-2xl` · `--fs-3xl` 이 쓴다.
    // 한 화면이 큰 제목을 새로 만들면서 이것을 빠뜨리면 그 화면만 고딕으로 남는데, 그 어긋남은
    // 두 화면을 나란히 놓아야 보인다. 이행 PR 이 크기를 토큰으로 옮길 때도 같은 규칙이 걸린다.
    const missing: string[] = []
    const seen: string[] = []
    for (const [path, source] of cssFiles()) {
      if (path.endsWith('tokens.css')) continue
      const byName = bySelector(source)
      for (const [selector, declared] of byName) {
        // **크기를 하나만 보지 않는다.** 이야기 제목은 기본 폭에서 한 단계 아래이고 768 부터
        // `--fs-3xl` 이 된다 — 첫 줄만 읽으면 그 자리가 검사에서 통째로 빠진다.
        const sizes = [...declared.matchAll(/font-size:\s*([^;]+);/g)].map((match) =>
          (match[1] ?? '').trim(),
        )
        if (!sizes.some((size) => BIG.includes(size))) continue
        seen.push(`${path} ${selector}`)
        if (!declared.includes('var(--font-read)')) missing.push(`${path} ${selector}`)
      }
    }
    expect(missing).toStrictEqual([])
    // 위의 읽는 방식이 어느 날 아무것도 잡지 못하게 되면 이 검사는 조용히 통과한다 —
    // 지금 큰 제목은 여섯 자리(화면 제목 다섯 + 이야기 제목 하나)이고 그보다 줄 수 없다.
    expect(seen.length).toBeGreaterThanOrEqual(6)
  })
})

/**
 * **이행이 끝났다 — 이제 `src/**` 전부다** (#136).
 *
 * 이 자리에는 끝난 묶음을 한 줄씩 더하는 배열이 있었다. 흩어진 170회를 화면 단위로 잘라
 * 옮기는 동안 *어디까지 왔는가* 를 그 배열이 들고 있었고, 네 PR(#164 · #165 · #166 과 이것)로
 * 마지막 자리가 비면서 **목록이 필요 없어졌다.**
 *
 * 배열을 남겨 두지 않는 것이 요점이다. 남기면 **새로 생긴 화면이 목록에 없어 검사를 지나지
 * 않고**, 그 화면만 스케일 밖으로 나간 채 초록으로 보인다 — 목록이 곧 빠져나가는 문이 된다.
 */
describe('#136 — 크기를 직접 적지 않는다', () => {
  it('136_어느_CSS_에도_font_size_리터럴이_없다', () => {
    const literals: string[] = []
    for (const [path, source] of cssFiles()) {
      for (const match of uncommented(source).matchAll(/font-size:\s*([^;]+);/g)) {
        const value = (match[1] ?? '').trim()
        if (!value.startsWith('var(--fs-')) literals.push(`${path}: ${value}`)
      }
    }
    expect(literals).toStrictEqual([])
  })

  it('136_실제로_스케일을_쓴다', () => {
    // 위 검사는 `font-size` 가 한 줄도 없어도 통과한다 — 규칙이 *지켜지는 쪽*이 아니라
    // *사라지는 쪽*으로 무너질 수 있다는 뜻이다. 옮겨 온 자리의 수를 함께 센다.
    let used = 0
    for (const [, source] of cssFiles()) {
      used += [...uncommented(source).matchAll(/font-size:\s*var\(--fs-/g)].length
    }
    expect(used).toBeGreaterThanOrEqual(160)
  })
})

describe('#136 — 받아 오는 자리는 index.html 하나다', () => {
  it('136_CSS_가_폰트를_import_하지_않는다', () => {
    // `@import` 는 렌더 차단을 한 단계 늘린다 — 문서 → 우리 CSS → 구글 CSS → 폰트.
    for (const [path, source] of cssFiles()) {
      expect(`${path}: ${uncommented(source)}`).not.toContain('@import')
    }
  })

  it('136_연결을_미리_열고_글자를_먼저_그린다', () => {
    expect(INDEX_HTML).toContain('rel="preconnect" href="https://fonts.googleapis.com"')
    expect(INDEX_HTML).toContain('rel="preconnect" href="https://fonts.gstatic.com" crossorigin')
    // 없으면 기본값 `block` 이라 최대 3초 동안 글자가 아예 그려지지 않는다.
    expect(fontHref()).toContain('display=swap')
  })

  it('136_토큰이_말하는_두_글자체를_받아_온다', () => {
    for (const name of ['--font-ui', '--font-read'] as const) {
      const first = families(name)[0]?.replaceAll('"', '').replaceAll(' ', '+')
      expect(first, name).toBeDefined()
      expect(fontHref(), name).toContain(`family=${first}:`)
    }
  })

  it('136_CSS_가_쓰는_굵기를_빠짐없이_받아_온다', () => {
    // 한글 웹폰트는 굵기 하나가 무겁다. 그래서 쓰는 것만 받되, **빠지면 브라우저가 가까운
    // 것으로 대신 그려** 의도한 것과 다른 굵기가 조용히 나간다 — 그쪽이 더 나쁘다.
    const used = new Set<number>()
    for (const [path, source] of cssFiles()) {
      if (path.endsWith('tokens.css')) continue
      for (const match of uncommented(source).matchAll(/font-weight:\s*(\d{3})\b/g)) {
        used.add(Number(match[1]))
      }
    }
    // `<h1>` · `<h2>` 는 브라우저 기본값이 `bold`(700) 이고 그 밖은 `normal`(400) 이다 —
    // CSS 에 적히지 않지만 실제로 그려지는 굵기라 함께 센다.
    used.add(400).add(700)
    expect(used.size).toBeGreaterThan(1)
    for (const weight of used) expect(requestedWeights('IBM+Plex+Sans+KR'), `${weight}`).toContain(weight)
  })

  it('136_명조는_명조가_쓰는_굵기만_받는다', () => {
    // 명조가 서는 자리는 Story 본문(400) · 화자 이름과 챕터 제목(600) · 제목 태그(700)뿐이다.
    // 고딕이 받는 것을 그대로 복사하면 안 쓰는 한 벌을 더 받는다.
    const serif = requestedWeights('Noto+Serif+KR')
    expect(serif).toStrictEqual([400, 600, 700])
    for (const weight of serif) expect(requestedWeights('IBM+Plex+Sans+KR')).toContain(weight)
  })
})

// ── 읽는 도구 ────────────────────────────────────────────────────────────────

/** `1.0625rem` → `1.0625`. rem 이 아닌 표기가 섞이면 그 자리에서 던진다 */
function remOf(value: string): number {
  const match = /^([\d.]+)rem$/.exec(value.trim())
  if (match === null) throw new Error(`rem 이 아니다: ${value}`)
  return Number(match[1])
}

/** 글자체 스택을 쉼표로 가른다. 따옴표는 그대로 둔다 — 폴백 이름을 그대로 비교한다 */
function families(name: '--font-ui' | '--font-read' | '--font-mono'): string[] {
  const value = ROOT.get(name)
  if (value === undefined) throw new Error(`${name} 이 없다`)
  return value.split(',').map((part) => part.trim())
}

/** `index.html` 이 부르는 구글 폰트 주소. `&amp;` 를 풀어 질의를 그대로 읽는다 */
function fontHref(): string {
  const match = /href="(https:\/\/fonts\.googleapis\.com\/[^"]+)"/.exec(INDEX_HTML)
  if (match === null) throw new Error('index.html 이 폰트를 받아 오지 않는다')
  return match[1]?.replaceAll('&amp;', '&') ?? ''
}

/** 그 패밀리에 대해 요청한 굵기들 */
function requestedWeights(family: string): number[] {
  // 패밀리 이름의 `+` 는 주소에서 공백을 대신하는 글자다 — 정규식의 수량자로 읽히지 않게 뺀다
  const literal = family.replaceAll('+', '\\+')
  const match = new RegExp(`family=${literal}:wght@([\\d;]+)`).exec(fontHref())
  if (match === null) throw new Error(`${family} 를 받아 오지 않는다`)
  return (match[1] ?? '').split(';').map(Number)
}

/**
 * 한 파일의 규칙을 선택자별로 모은다. 미디어 쿼리 안의 `.title` 과 밖의 `.title` 은 **같은
 * 선택자**이므로 한 덩어리로 본다 — 폭마다 크기가 바뀌는 자리에서 글자체는 한 번만 적힌다.
 */
function bySelector(css: string): Map<string, string> {
  const found = new Map<string, string>()
  // 가장 안쪽 `{ … }` 만 잡힌다. `@media (...) {` 는 중괄호를 품고 있어 선택자가 되지 못한다.
  for (const match of uncommented(css).matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = match[1]?.trim()
    if (selector === undefined || selector === '') continue
    found.set(selector, `${found.get(selector) ?? ''}\n${match[2] ?? ''}`)
  }
  return found
}

const count = (text: string, needle: string): number => text.split(needle).length - 1
