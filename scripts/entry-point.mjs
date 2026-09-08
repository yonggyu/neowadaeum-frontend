/**
 * 이 모듈이 **진입점으로 실행됐는가** (#148).
 *
 * `scripts/` 의 스크립트들은 두 가지로 쓰인다 — `npm run …` 이 직접 부르는 실행 파일이면서,
 * 테스트가 `import` 해 순수 함수만 꺼내 쓰는 모듈이다. 그래서 *"내가 진입점일 때만 일한다"*
 * 는 판정이 파일마다 필요하다.
 *
 * ## 왜 문자열 비교가 아니라 realpath 인가
 *
 * Node 는 진입점을 **실제 경로로 풀어** `import.meta.url` 을 만드는데 `process.argv[1]` 은
 * 셸이 준 문자열을 `path.resolve` 만 한 것이다 — **심볼릭 링크를 펴지 않는다.** 경로에
 * 링크가 하나라도 끼면(macOS 의 `/var` → `/private/var`, `scripts/` 가 링크인 트리) 두
 * 문자열이 갈리고 판정이 `false` 가 된다.
 *
 * 그때 스크립트는 **아무것도 하지 않고 `exit 0`** 이다. 출력도 없다. `npm run api:types` 가
 * 성공한 것처럼 보이는데 타입은 낡은 채로 남고, `typecheck` 는 낡은 타입과 코드가 서로 맞아
 * 통과한다 — 어긋남은 런타임에야 드러난다. `#32` · `#40` · `#81` · `#113` · `#143` 과 같은
 * 줄의 문제이며(*같은 명령이 환경에 따라 다르게 동작한다*) **그중 유일하게 조용한** 것이다.
 *
 * ## 왜 한 곳에 모았는가
 *
 * 사용처가 둘이다 — `api-types.mjs` · `require-generated-types.mjs`. `CLAUDE.md` 의 추상화
 * 조건 1(*실제 사용처가 둘 이상*)과 3(*외부 시스템과의 경계를 보호한다*)을 함께 지난다.
 * 마크업이 닮아서 합치는 종류가 아니라 두 자리가 **같은 한 문장**을 따르기 때문이다:
 * *"Node 는 진입점을 realpath 로 푼다."*
 *
 * 그리고 이 이슈 자체가 **복사의 실패**였다. 두 스크립트 중 나중 것(`#143`)만 링크를 펴고
 * 먼저 있던 것은 펴지 않아, 같은 열 줄이 한쪽에서만 맞았다. 근거를 적은 주석까지 두 벌로
 * 두면 다음 스크립트는 둘 중 **아무 쪽이나** 베끼게 된다.
 */
import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/**
 * @param moduleUrl 묻는 쪽의 `import.meta.url`. **부르는 파일이 직접 넘긴다** — 이 모듈
 *   안에서 읽으면 언제나 이 파일 자신을 가리켜 항상 `false` 가 된다.
 * @param entry 실행된 진입점의 경로. 기본값은 `process.argv[1]` 이고, 테스트가 링크가 낀
 *   경로를 직접 넣어 볼 수 있도록 열어 둔다.
 */
export function isEntryPoint(moduleUrl, entry = process.argv[1]) {
  if (entry === undefined) return false
  try {
    // 없는 경로 · 끊어진 링크면 던진다. 그건 우리가 실행된 파일이 아니라는 뜻이다.
    return moduleUrl === pathToFileURL(realpathSync(entry)).href
  } catch {
    return false
  }
}
