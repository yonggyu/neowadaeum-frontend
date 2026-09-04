import { readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Vitest } from 'vitest/node'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)))

/**
 * 디스크를 훑을 때 들어가지 않는 디렉터리.
 *
 * `vite.config.ts` 의 `test.exclude` 와 **같은 사실을 따로 적은 것**이다. 일부러 그렇게 둔다 —
 * 한쪽만 바뀌면 아래 검사가 빨간불을 낸다. 설정에서 읽어 오면 둘이 어긋나는 일 자체를 관찰할
 * 수 없고, 이 파일이 막으려는 것이 바로 그 어긋남이다.
 *
 * `_contract` 는 CI 가 워크스페이스 안에 받아 두는 백엔드 레포다 (.github/workflows/ci.yml).
 * 남의 소스이므로 우리가 돌 테스트의 목록에 넣지 않는다 — eslint 의 `ignores` 와 같은 이유다.
 */
const UNVISITED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.claude',
  '.cache',
  '.idea',
  '.output',
  '.temp',
  '_contract',
  'coverage',
  'dist',
])

/** vitest 의 기본 `include` 가 잡는 모양과 같다. */
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/

function testFilesOnDisk(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!UNVISITED_DIRECTORIES.has(entry.name)) {
        testFilesOnDisk(join(directory, entry.name), found)
      }
    } else if (TEST_FILE.test(entry.name)) {
      found.push(relative(ROOT, join(directory, entry.name)))
    }
  }
  return found
}

/**
 * 러너가 **셋으로 잡은 파일 목록**과 디스크에 있는 파일 목록이 정확히 같은지 확인한다 (#113).
 *
 * ## 왜 필요한가
 *
 * 실패한 테스트는 눈에 띈다. **없어진 테스트는 눈에 띄지 않는다.** 파일이 수집 대상에서 빠지면
 * vitest 는 그것을 실패로 보고할 자리조차 없어서 그냥 숫자가 줄고, 요약은 전부 초록이다.
 * 45 파일이 44 가 된 것을 알아보려면 어제의 숫자를 기억해야 하는데 아무도 그러지 않는다.
 *
 * `#113` 이 그 자리였다. `.env` 가 없는 워크트리에서 13개 파일이 통째로 죽었는데 요약의
 * `Tests` 줄은 `360 passed (360)` — **실패 0** 이었고, 그 줄만 읽은 에이전트 둘이 초록으로
 * 넘겼다. (그 경우는 `Test Files` 줄이 빨갛고 종료 코드도 1 이었다. 하지만 파일이 *수집
 * 대상에서 아예 빠지면* 그 신호마저 없다.)
 *
 * ## 양쪽을 다 본다
 *
 * - **디스크에 있는데 셋에 없다** — 조용히 줄어드는 쪽. `#113` 이 가리킨 방향이다.
 * - **셋에 있는데 디스크 목록에 없다** — 조용히 늘어나는 쪽. `#81`(스테일 워크트리를 vitest
 *   가 줍는다) 이 겪은 방향이다.
 *
 * 두 방향은 `#32` · `#40` 과 함께 **같은 줄의 문제**다: 같은 명령이 어디서 도느냐에 따라 다른
 * 것을 검사한다. 원인은 매번 다르므로 원인마다 막지 않고 **결과를 센다.**
 *
 * ## 실행이 아니라 설정을 본다
 *
 * 돈 파일이 아니라 `globTestSpecifications()` 가 돌려주는 **설정이 잡는 전체 셋**과 비교한다.
 * 그 목록은 CLI 필터를 무시하므로 `vitest run src/api/errors.test.ts` 처럼 일부러 좁혀 돌릴
 * 때 잘못 울리지 않는다. 좁혀 도는 것은 개발자의 선택이고, 이 검사가 잡으려는 것은 **아무도
 * 선택하지 않았는데 좁아진 경우**다.
 */
export class EveryTestFileRuns {
  async onInit(vitest: Vitest): Promise<void> {
    const specifications = await vitest.globTestSpecifications()

    const inSuite = new Set(specifications.map((spec) => relative(ROOT, spec.moduleId)))
    const onDisk = new Set(testFilesOnDisk(ROOT))

    const missing = [...onDisk].filter((path) => !inSuite.has(path)).sort()
    const unexpected = [...inSuite].filter((path) => !onDisk.has(path)).sort()

    if (missing.length === 0 && unexpected.length === 0) return

    // 종료 코드를 직접 세운다. 리포터에는 "이 실행을 실패로 만든다" 는 자리가 따로 없다.
    process.exitCode = 1

    const lines = ['', '테스트 셋이 디스크와 어긋난다 (#113).']
    if (missing.length > 0) {
      lines.push(`  디스크에 있으나 테스트 셋에 없는 파일 ${missing.length}개:`)
      lines.push(...missing.map((path) => `    - ${path}`))
    }
    if (unexpected.length > 0) {
      lines.push(`  테스트 셋에 있으나 이 레포의 테스트가 아닌 파일 ${unexpected.length}개:`)
      lines.push(...unexpected.map((path) => `    + ${path}`))
    }
    lines.push('')
    console.error(lines.join('\n'))
  }
}
