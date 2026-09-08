/**
 * `close-linked-issues.yml`(#3) 의 닫기 키워드 매처 회귀 테스트.
 *
 * 워크플로의 인라인 스크립트에서 `testable:start` ~ `testable:end` 구간을 잘라내 그대로
 * 평가한다. **로직을 복사해 두지 않는다** — 복사본은 원본과 갈라지는 순간 테스트가 아니라
 * 거짓말이 된다.
 *
 * 백엔드는 같은 검증을 손으로 돌리는 스크립트로 두었다(그쪽 B-04-2 가 아직 열려 있다).
 * 여기서는 `npm test` 가 이미 CI 잡이므로 vitest 로 둔다 — **잡 이름 셋을 늘리지 않고**
 * 같은 것을 자동으로 얻는다.
 *
 * 마크다운 문맥 케이스가 이 파일의 핵심이다. 이 워크플로를 *설명하는* 문서가 곧 이
 * 워크플로의 *입력*이 되므로, 코드 스팬 안의 예시가 진짜 참조로 읽히면 엉뚱한 이슈가 닫힌다
 * (백엔드 #11 에서 실제로 일어났다).
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const WORKFLOW = new URL('../.github/workflows/close-linked-issues.yml', import.meta.url)
const START = '// testable:start'
const END = '// testable:end'

/** 워크플로에서 평가 가능한 구간만 떼어 낸다. 표식이 없으면 **테스트를 실패시킨다.** */
function extractMatcherSource() {
  const raw = readFileSync(WORKFLOW, 'utf8')
  const startIndex = raw.indexOf(START)
  const endIndex = raw.indexOf(END)

  if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) {
    throw new Error(
      `워크플로에서 ${START} ~ ${END} 구간을 찾지 못했다. 표식이 지워졌거나 옮겨졌다.`,
    )
  }

  // YAML 블록 스칼라라 공통 들여쓰기가 붙어 있다. 최소 들여쓰기를 걷어내야 JS 로 평가된다.
  const lines = raw.slice(startIndex + START.length, endIndex).split('\n')
  const indent = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => line.match(/^ */)[0].length),
  )
  return lines.map((line) => line.slice(indent)).join('\n')
}

// `owner` · `repo` 는 워크플로에서 `context.repo` 로 들어온다. 여기서는 이 레포의 값을 준다 —
// 같은 레포의 issues URL 만 인식한다는 규칙이 실제로 이 이름들에 걸려 있기 때문이다.
const owner = 'yonggyu'
const repo = 'neowadaeum-frontend'

const module = await import(
  'data:text/javascript;charset=utf-8,' +
    encodeURIComponent(
      `const owner = ${JSON.stringify(owner)};\n` +
        `const repo = ${JSON.stringify(repo)};\n` +
        `${extractMatcherSource()}\n` +
        'export { findLinkedIssues };\n',
    )
)

const { findLinkedIssues } = module

describe('닫기_키워드를_GitHub_와_같은_범위로_인식한다', () => {
  it.each([
    ['Closes #5', [5]],
    ['closes #5', [5]],
    ['Closed #5', [5]],
    ['fix #7', [7]],
    ['Fixes #7', [7]],
    ['fixed #7', [7]],
    ['resolve #9', [9]],
    ['Resolves #9', [9]],
    ['resolved #9', [9]],
    ['Closes: #11', [11]],
    ['closes GH-12', [12]],
    ['Fixes https://github.com/yonggyu/neowadaeum-frontend/issues/13', [13]],
    ['closes https://www.github.com/yonggyu/neowadaeum-frontend/issues/14', [14]],
    ['Closes #5\n\nfixes #6\nresolves GH-5', [5, 6]],
    ['Closes #5.', [5]],
    ['(Closes #5)', [5]],
    ['Closes #5, #6', [5]],
    ['Closes #5 and fixes #6', [5, 6]],
  ])('%j → %j', (text, expected) => {
    expect(findLinkedIssues(text)).toEqual(expected)
  })
})

describe('키워드가_아닌_것은_닫지_않는다', () => {
  // 못 닫은 이슈는 눈에 띄지만 **잘못 닫은 이슈는 묻힌다.** 애매하면 인식하지 않는 쪽이다.
  it.each([
    ['refs #5', []],
    ['Refs: F-9, R9.6', []],
    ['관련 #5', []],
    ['prefixes #5', []],
    ['unclosed #5', []],
    ['Closes https://github.com/other/repo/issues/99', []],
    ['#5 만 단독', []],
    ['Closes #5x', []],
    ['closes #5-1', []],
  ])('%j → %j', (text, expected) => {
    expect(findLinkedIssues(text)).toEqual(expected)
  })
})

describe('코드_문맥_안의_참조는_참조가_아니다', () => {
  // 이 축을 시험하지 않아 백엔드에서 결정 이슈 하나가 잘못 닫혔다 (#11).
  it.each([
    ['`Closes #5`', []],
    ['`resolve #9` / `Resolves #9` / `resolved #9`', []],
    ['| `Closes #5` / `closes #5` | `refs #5` |', []],
    ['``Closes #5``', []],
    ['```\nCloses #5\n```', []],
    ['~~~\nCloses #5\n~~~', []],
    ['```js\n// Closes #5\nconst x = 1;\n```', []],
    ['<!-- Closes #5 -->', []],
    ['<!--\nfeat/* → frontend\nCloses #5\n-->', []],
    ['본문에 `Closes #7` 이라고 적었다', []],
  ])('%j → %j', (text, expected) => {
    expect(findLinkedIssues(text)).toEqual(expected)
  })
})

describe('섞인_본문에서_실제_참조만_고른다', () => {
  it('설명과_참조가_같은_본문에_있어도_참조만_닫는다', () => {
    expect(findLinkedIssues('## 관련 이슈\n\nCloses #7\n\n| 예시 | `resolve #9` |')).toEqual([7])
  })

  it('펜스와_주석_안의_번호는_세지_않는다', () => {
    expect(findLinkedIssues('Closes #7\n\n```\nfixes #99\n```\n\n<!-- closes #98 -->')).toEqual([7])
  })
})
