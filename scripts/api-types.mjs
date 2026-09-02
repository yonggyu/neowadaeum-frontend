/**
 * 계약 → 타입 (`npm run api:types`).
 *
 * **기본값을 두지 않는다.** 이 자리는 `${OPENAPI_SOURCE:-../neowadaeum-backend/…}` 였고,
 * 그 기본값이 **상대경로**라 실행 위치에 따라 다른 곳을 가리켰다 — 워크트리에서 실제로
 * 빗나갔다. 더 나쁜 경우는 그 경로에 **다른 계약 레포가 있는** 것이다. 그때는 실패하지 않고
 * 조용히 틀린 타입이 생기고, 화면은 있지도 않은 필드를 믿는다.
 *
 * `src/api/config.ts` 의 `required()` 와 같은 규칙이며 이유도 같다 (보안 hard-stop §7.3):
 * **값이 없으면 실패시킨다.**
 */
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const OUTPUT = 'src/api/schema.d.ts'

/**
 * 어느 계약을 읽을 것인가. 없으면 던진다.
 *
 * 메시지가 **무엇을 설정해야 하는지** 말한다 — "설정이 필요하다" 만 말하는 실패는 두 번째
 * 실패를 부른다.
 */
export function requireContractSource(env) {
  const value = env.OPENAPI_SOURCE
  if (value === undefined || value.trim() === '') {
    throw new Error(
      'OPENAPI_SOURCE is required — 읽을 계약 파일의 경로를 지정한다.\n' +
        '  예: OPENAPI_SOURCE=/절대경로/neowadaeum-backend/docs/openapi.yaml npm run api:types\n' +
        '  기본값을 두지 않는 이유: 상대경로 기본값은 실행 위치에 따라 다른 계약을 가리키고,\n' +
        '  그 자리에 다른 레포가 있으면 실패하지 않고 조용히 틀린 타입이 생긴다.',
    )
  }
  return value.trim()
}

function main() {
  let source
  try {
    source = requireContractSource(process.env)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }

  // `npm run` 이 node_modules/.bin 을 PATH 에 올려 둔다. 경로를 손으로 적으면 워크트리처럼
  // 의존성이 심볼릭 링크로 걸린 자리에서 다시 어긋난다.
  const result = spawnSync('openapi-typescript', [source, '-o', OUTPUT], { stdio: 'inherit' })
  process.exit(result.status ?? 1)
}

// 테스트가 이 파일을 import 해 `requireContractSource` 만 부른다. 진입점으로 실행됐을 때만
// 타입을 만든다.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
