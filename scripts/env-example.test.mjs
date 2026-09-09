/**
 * `.env.example` 이 **실제로 읽는 키를 다 드는지** 본다 (#183).
 *
 * ## 무엇이 문제인가
 *
 * `.env` 는 `.gitignore` 대상이라 새 사람 · 새 워크트리 · CI 에는 없다. 그 자리에서 유일한
 * 안내가 `.env.example` 이고, **거기 없는 키는 존재하지 않는 것과 같다.** 그 사람은 빌드를
 * 성공시킨 뒤(환경값은 타입의 문제가 아니다) 무엇이 빠졌는지 말하지 않는 실패를 만난다.
 *
 * 이 레포는 같은 모양을 이미 여러 번 다뤘다 — `#113`(러너가 파일을 수집하지 못해 **테스트가
 * 실패한 것이 아니라 아예 돌지 않았고 요약은 초록**이었다) · `#143`(생성 타입이 없으면
 * 검사가 **시작하기 전에** 멈춘다) · `#177`(아홉을 아는 자리가 다섯인데 **넷만 고쳐도
 * 초록**이었다). 환경값에는 그 대비가 없었다.
 *
 * ## 목록을 새로 적지 않는다 — 이것이 이 파일의 설계다
 *
 * `#177` 이 남긴 두 후보 중 *"손으로 적은 목록을 하나 두고 나머지가 그것과 맞는지 본다"* 는
 * **목록이 하나 더 생기는** 대가를 진다. 여기서는 그 대가를 치르지 않는다 — **읽는 자리
 * 자신에서 키를 뽑는다.** `closing-keywords.test.mjs` 가 워크플로에서 매처를 떼어 내는 것과
 * 같은 방식이며, 이유도 같다: **복사본은 원본과 갈라지는 순간 테스트가 아니라 거짓말이 된다.**
 *
 * 읽는 방식이 **셋**이고 그래서 정규식 하나로는 잡히지 않는다.
 *
 * | 자리 | 무엇을 읽는가 | 어떻게 뽑는가 |
 * |---|---|---|
 * | 앱 (런타임) | `API_BASE_URL` · `GOOGLE_OAUTH_CLIENT_ID` | `RUNTIME_CONFIG_NAMES` 를 **그대로 가져온다** |
 * | `vite.config.ts` (dev · 빌드) | `PUBLIC_ORIGIN` | `loadEnv(...).KEY` 를 찾는다 |
 * | 컨테이너 진입점 | 위 셋 | 셸이 **참조하는** 대문자 이름에서 **스스로 정의한** 것을 뺀다 |
 *
 * ## 양방향으로 본다
 *
 * `#177` 이 후보 1(사용처를 훑는다)의 약점으로 지목한 것은 *새로 생긴 키를 목록이 자동으로
 * 삼켜 사람이 설명을 적지 않아도 통과한다* 였다. **여기서는 그 일이 일어나지 않는다** —
 * 코드에 키가 생기면 `.env.example` 에 없어서 빨개지고, 사람이 키와 **설명**을 적어야 초록이
 * 된다. 반대로 예시에만 남은 키(아무도 읽지 않는 키)도 빨개진다.
 *
 * ## 이 검사가 덮지 못하는 것 — 초록을 과신하지 않기 위해 적는다
 *
 * - **설명이 맞는지는 보지 못한다.** `.env.example` 의 값어치는 키 이름이 아니라 거기 적힌
 *   근거다(왜 기본값이 없는지 · 왜 `npm test` 에는 필요 없는지 · 승인된 JavaScript 원본이
 *   무엇이어야 하는지). 어떤 검사도 그것이 맞는지는 모른다.
 * - **`.env` 사본이 예시를 따라왔는지는 보지 못한다.** 그것은 반대 방향이고 `.env` 가 CI 에
 *   없으므로 여기서 물을 수 없다 — 백엔드가 `scripts/check-env-drift.sh`(그쪽 #434)로 푼
 *   자리이며, 프론트에는 아직 없다.
 * - **적힌 값이 운영 값인지는 보지 못한다.** 값을 전부 금지하면 `API_BASE_URL=http://localhost:8080`
 *   처럼 **적혀야 하는 값**까지 걸린다 — 로컬 주소는 S-11 이 막는 것이 아니라 예시의 값어치
 *   자체다. *이것이 운영 값인가* 는 이 검사가 답할 수 있는 물음이 아니며, 그 자리는 `gitleaks`
 *   가 CI 잡으로 따로 본다.
 */
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { RUNTIME_CONFIG_NAMES } from '../src/runtimeConfig'

const EXAMPLE = new URL('../.env.example', import.meta.url)
const VITE_CONFIG = new URL('../vite.config.ts', import.meta.url)
const ENTRYPOINT = new URL('../docker/40-neowadaeum-config.sh', import.meta.url)

const read = (url) => readFileSync(url, 'utf8')

/**
 * `.env.example` 이 **설정하는** 키. 주석(`# FOO=`)은 세지 않는다 — 주석 처리된 키는 설정된
 * 것이 아니고, `OPENAPI_SOURCE` 가 거기 있는 이유가 그것이다(아래 테스트가 못박는다).
 */
function exampleKeys() {
  return new Set(
    [...read(EXAMPLE).matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(([, name]) => name),
  )
}

/** `vite.config.ts` 가 `.env` 에서 직접 꺼내는 키. */
function viteConfigKeys() {
  return [...read(VITE_CONFIG).matchAll(/loadEnv\([^)]*\)\.([A-Z][A-Z0-9_]*)/g)].map(
    ([, name]) => name,
  )
}

/**
 * 진입점이 **환경에서 받는** 키.
 *
 * 셸이 참조하는 대문자 이름에서 **스스로 정의한 이름**을 뺀다. 목록을 적어 두면 진입점이
 * 내부 변수를 하나 더 만들 때마다 여기도 고쳐야 하고, 고치지 않으면 그 변수가 환경변수인
 * 것처럼 보인다.
 */
function entrypointKeys() {
  const source = read(ENTRYPOINT)
  const referenced = [...source.matchAll(/\$\{?([A-Z][A-Z0-9_]*)/g)].map(([, name]) => name)
  const defined = new Set(
    [...source.matchAll(/^(?:export\s+)?([A-Z][A-Z0-9_]*)=/gm)].map(([, name]) => name),
  )
  return referenced.filter((name) => !defined.has(name))
}

/** 읽는 자리 셋을 합친 것. **이것이 `.env.example` 이 들어야 하는 전부다.** */
function keysActuallyRead() {
  return new Set([...RUNTIME_CONFIG_NAMES, ...viteConfigKeys(), ...entrypointKeys()])
}

const sorted = (names) => [...names].sort()

describe('.env.example 이 실제로 읽는 키를 든다 (#183)', () => {
  it('앱이_읽는_키가_전부_예시에_있다__없는_키는_존재하지_않는_것과_같다', () => {
    const example = exampleKeys()
    for (const name of RUNTIME_CONFIG_NAMES) {
      expect(example).toContain(name)
    }
  })

  it('예시와_읽는_자리가_양쪽으로_맞는다__한쪽만_고쳐도_초록인_상태를_막는다_177', () => {
    // 어긋나면 어느 쪽이 앞서 나갔는지가 실패 메시지에 그대로 보인다.
    expect(sorted(exampleKeys())).toEqual(sorted(keysActuallyRead()))
  })

  it('읽는_자리가_셋이라는_사실을_이_검사가_알고_있다', () => {
    // 자리 하나가 통째로 빠지면 위의 대조는 여전히 초록일 수 있다 — 양쪽에서 같이 사라지므로.
    expect(viteConfigKeys()).toContain('PUBLIC_ORIGIN')
    expect(entrypointKeys()).toEqual(
      expect.arrayContaining(['API_BASE_URL', 'GOOGLE_OAUTH_CLIENT_ID', 'PUBLIC_ORIGIN']),
    )
    // 진입점이 스스로 만든 변수를 환경변수로 세지 않는다.
    expect(entrypointKeys()).not.toContain('OG_MARKUP')
    expect(entrypointKeys()).not.toContain('HTML_DIR')
  })

  it('OPENAPI_SOURCE_는_설정하는_키로_두지_않는다__npm_이_아니라_셸이_넘긴다', () => {
    // 그 값은 `.env` 에서 오지 않는다 (`scripts/api-types.mjs`). 예시는 **주석으로만** 설명하며,
    // 여기에 `KEY=` 로 두면 위의 양방향 대조가 곧바로 깨진다 — 읽는 자리가 `.env` 가 아니어서다.
    expect(exampleKeys()).not.toContain('OPENAPI_SOURCE')
    expect(read(EXAMPLE)).toContain('OPENAPI_SOURCE')
  })
})
