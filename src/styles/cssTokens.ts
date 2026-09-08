import { readdirSync, readFileSync, statSync } from 'node:fs'

/**
 * 토큰 파일을 **읽는** 도구. 러너에 DOM 이 없으므로 CSS 를 글자로 읽어 검사한다.
 *
 * `palette.test.ts`(#135 · #138)가 먼저 갖고 있던 것을 그대로 꺼내 왔다 — `typography.test.ts`
 * (#136)가 같은 것을 필요로 하면서 **실제 사용처가 둘이 됐기 때문**이다. 하나였을 때 여기
 * 있었다면 그것은 앞질러 만든 추상화였을 것이고, 둘이 각자 복사본을 들면 한쪽만 고쳐지는
 * 날이 온다. 토큰 파일의 모양(`:root` 하나 · 다크 하나)을 두 테스트가 같은 사실로 읽는다.
 */

/**
 * 주석을 걷어낸 CSS. 이 레포의 주석에는 `#135` 같은 이슈 번호와 `1.5rem` 같은 값이 있어서,
 * 걷어내지 않으면 *값을 직접 적었는가* 를 보는 규칙이 설명하는 글에 걸린다.
 */
export function uncommented(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** `marker` 뒤에 처음 오는 균형 잡힌 `{ … }` 의 안쪽 */
export function block(text: string, marker: string): string {
  const stripped = uncommented(text)
  const at = stripped.indexOf(marker)
  if (at < 0) throw new Error(`${marker} 를 찾지 못했다`)
  let depth = 0
  for (let i = at + marker.length - 1; i < stripped.length; i += 1) {
    if (stripped[i] === '{') depth += 1
    if (stripped[i] === '}') {
      depth -= 1
      if (depth === 0) return stripped.slice(at + marker.length, i)
    }
  }
  throw new Error(`${marker} 의 블록이 닫히지 않았다`)
}

export function rootBlock(text: string): string {
  return block(text, ':root {')
}

export function darkBlock(text: string): string {
  return block(text, '@media (prefers-color-scheme: dark) {')
}

export function declarations(css: string): Map<string, string> {
  const found = new Map<string, string>()
  for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match
    if (name === undefined || value === undefined) continue
    found.set(name, value.trim())
  }
  return found
}

/** `src/**` 의 모든 CSS. 새 화면이 늘어도 규칙이 그 화면에 저절로 걸린다 */
export function cssFiles(): [string, string][] {
  const root = new URL('..', import.meta.url).pathname
  const found: [string, string][] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = `${dir}/${entry}`
      if (statSync(path).isDirectory()) walk(path)
      else if (entry.endsWith('.css')) found.push([path, readFileSync(path, 'utf8')])
    }
  }
  walk(root)
  return found
}
