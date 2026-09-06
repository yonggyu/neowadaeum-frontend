/**
 * 생성물이 있는지 먼저 본다 (`pretypecheck` · `prebuild`, #143).
 *
 * ## 무엇을 막는가
 *
 * `src/api/schema.d.ts` 는 계약에서 만드는 산출물이라 `.gitignore` 에 있다 (F-2). 새로
 * 체크아웃한 워크트리에는 그 파일이 없고, 그 상태에서 `tsc` 는 **화면 파일마다** 오류를
 * 쏟아 낸다 — `Cannot find module '../schema'` 하나가 그 아래로 번져 수십 개의
 * `implicitly has an 'any' type` 이 된다.
 *
 * **증상이 원인을 가린다.** 그 목록 어디에도 *"생성물 하나가 없다"* 는 말이 없어서 읽는
 * 사람은 자기 코드가 깨진 줄 안다. 실제로 에이전트 둘이 각자 이 벽에 부딪혔다.
 *
 * ## 왜 여기서 만들어 주지 않는가
 *
 * 없으면 `npm run api:types` 를 대신 돌리는 쪽이 편해 보이지만, 그 명령은 `OPENAPI_SOURCE`
 * 를 요구하고 **없으면 실패한다** (#40 — 값이 없으면 실패시킨다). 즉 자동 생성은 실패를
 * 한 단계 뒤로 미룰 뿐이고, 그때 나오는 것은 다시 *원인을 말하지 않는* 실패다.
 * **없다는 사실 하나만 말하고 멈춘다.**
 *
 * ## 경고가 아니라 실패다
 *
 * 통과시키면서 경고만 내는 것은 `#113` 이 걷은 자리와 같다 — 초록으로 보이는데 검사는
 * 돌지 않았다. 여기서는 0 이 아닌 코드로 끝난다.
 *
 * 경로는 **이 파일의 위치**에서 푼다. cwd 에서 풀면 실행 위치에 따라 다른 곳을 보게 되고,
 * 그것이 `#40` 이 걷어 낸 바로 그 종류의 자리다.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { isEntryPoint } from './entry-point.mjs'

const ROOT = new URL('../', import.meta.url)

/** 계약에서 생성되는 타입. `.gitignore` 에 있으므로 체크아웃에 따라오지 않는다. */
export const GENERATED_TYPES = 'src/api/schema.d.ts'

/**
 * 생성물이 없으면 던진다.
 *
 * 메시지는 **무엇이 없는지**와 **무엇을 하면 되는지**를 함께 말한다. 둘 중 하나만 말하는
 * 실패는 두 번째 실패를 부른다 — `scripts/api-types.mjs` 의 `requireContractSource` 와 같다.
 *
 * @param fileExists 레포 루트 기준 상대경로를 받아 존재 여부를 돌려준다.
 */
export function assertGeneratedTypesExist(fileExists) {
  if (fileExists(GENERATED_TYPES)) return

  throw new Error(
    `${GENERATED_TYPES} 가 없다 — 계약에서 만드는 산출물이라 체크아웃에 따라오지 않는다 (F-2).\n` +
      '  먼저 계약에서 타입을 만든다:\n' +
      '    OPENAPI_SOURCE=/절대경로/neowadaeum-backend/docs/openapi.yaml npm run api:types\n' +
      '  OPENAPI_SOURCE 는 필수이며 기본값이 없다 (#40). .env.example 에 적혀 있다.\n' +
      '  여기서 대신 만들지 않는 이유: 그 값이 없으면 같은 실패가 한 단계 뒤에서 다시 나고,\n' +
      '  그때는 무엇이 없어서인지가 또 가려진다.',
  )
}

function main() {
  try {
    assertGeneratedTypesExist((path) => existsSync(fileURLToPath(new URL(path, ROOT))))
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}

// 진입점으로 실행됐을 때만 검사한다. 테스트는 이 파일을 import 해
// `assertGeneratedTypesExist` 만 부른다.
//
// 판정은 `entry-point.mjs` 가 든다 — 같은 열 줄이 `api-types.mjs` 에도 있었고 그쪽만 링크를
// 펴지 않아 조용히 아무것도 하지 않았다 (#148). 가드가 도는 척하며 아무것도 검사하지 않는
// 것이 `#113` · `#143` 이 없애려던 실패이며, 그 판정을 두 벌로 두는 한 다시 갈라진다.
if (isEntryPoint(import.meta.url)) {
  main()
}
