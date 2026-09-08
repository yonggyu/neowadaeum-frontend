import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * 고지문은 **그 화면이 이미 받은 응답**에서 온다 (백엔드 #257).
 *
 * `LibraryResponse` · `StoryDetailResponse` 에 `noticeText` 가 실리기 전에는 Footer 가 자기
 * 데이터와 별개로 `/landing` 을 한 번 더 불렀다. 요청 하나가 낭비되는 것보다 나빴던 것은
 * **고지문이 자기 응답과 다른 시점의 값**이라는 점이다.
 *
 * 이 레포에는 DOM 테스트 하네스가 없어서 렌더링으로는 요청을 셀 수 없다. 대신 우회가 살던
 * 자리를 그대로 지킨다 — **Library · Detail 이 `/landing` 을 import 하지 못하게** 한다.
 * 되돌아오는 우회는 언제나 이 import 로 먼저 나타난다.
 */

/**
 * 주석을 걷어낸 소스. **주석은 세지 않는다** — 이 우회를 설명하는 글이 곧 이 파일들에 있고,
 * 그것까지 걸리면 테스트가 "설명하지 마라"는 규칙이 되어 버린다. 지키려는 것은 호출이다.
 */
const read = (file: string): string =>
  readFileSync(new URL(file, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const LIBRARY_AND_DETAIL = [
  'LibraryScreen.tsx',
  'StoryDetailScreen.tsx',
  'useLibrary.ts',
  'parts.tsx',
]

describe('백엔드257 — 고지문을 자기 응답에서 읽는다', () => {
  it.each(LIBRARY_AND_DETAIL)(
    '백엔드257_%s_는_landing_을_부르지_않는다',
    (file) => {
      const source = read(file)
      expect(source).not.toContain('getLanding')
      expect(source).not.toContain('/landing')
    },
  )

  it('랜딩은 여전히 자기 경로를 부른다 — 위 단언이 헛돌지 않는다는 대조군이다', () => {
    expect(read('LandingScreen.tsx')).toContain('getLanding')
  })

  it('R11_1_고지_문구의_기본값을_프론트에_두지_않는다 — Footer 는 받은 것만 그린다', () => {
    const parts = read('parts.tsx')
    expect(parts).toContain('export function AiNoticeFooter({ text }: { text: string })')
    // 폴백 문구가 들어오는 자리 — `??` 나 `||` 로 기본값을 끼워 넣지 않는다 (백엔드 13-27)
    expect(parts).not.toMatch(/text\s*(\?\?|\|\|)/)
  })
})
