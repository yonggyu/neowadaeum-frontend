/**
 * 앱이 설정을 읽는 자리 (#188, ADR-0012).
 *
 * ## 왜 `import.meta.env` 가 아닌가
 *
 * `import.meta.env.VITE_*` 는 **`vite build` 시점에 값이 번들 안으로 들어간다.** 로컬에서는
 * 문제가 아니지만 산출물이 이미지가 되는 순간부터는 다르다 — 이미지가 환경마다 갈리고
 * **같은 SHA 를 승격할 수 없다.** 롤백이 *"이전 SHA 로 되돌린다"* 로 성립하려면 이미지가
 * 어디에 나가든 같아야 한다.
 *
 * 그래서 값은 **컨테이너가 뜰 때** 온다. 진입점이 환경변수를 읽어 `/config.js` 를 써 내리고,
 * `index.html` 이 모듈 스크립트보다 **먼저** 그것을 읽는다. 이 파일은 그렇게 놓인 전역을
 * 읽는 **유일한 자리**다.
 *
 * ## 이름이 `VITE_` 가 아닌 이유
 *
 * `VITE_` 접두어의 뜻은 *"Vite 가 번들에 박아 준다"* 인데 이제 그러지 않는다. 이름이 사실과
 * 어긋나면 다음 사람은 그 이름을 믿고 잘못된 자리를 고친다 — `#169` 가 `--fs-read` 를
 * `--fs-2lg` 로 고친 것과 같은 이유다. **키 이름은 컨테이너 환경변수와 글자 그대로 같다.**
 * dev 의 `.env`, compose 의 환경변수, `/config.js`, 이 파일이 **한 철자**를 쓴다.
 *
 * `GOOGLE_OAUTH_CLIENT_ID` 는 **백엔드가 쓰는 이름 그대로**다. 두 서비스가 같은 값을 받아야
 * 하고(서버가 그 audience 로 ID 토큰을 검증한다), 이름이 같으면 compose 의 환경변수 하나가
 * 둘에 간다.
 *
 * ## 여기서 던지지 않는다
 *
 * 값이 없을 때 **무엇을 할지는 부르는 쪽이 정한다.** 두 사용처의 실패 시점이 다르기 때문이다 —
 * `src/api/config.ts` 는 모듈을 읽는 순간 던져야 하고(API 오리진이 없으면 앱이 뜨면 안 된다),
 * `googleIdToken.ts` 는 **버튼을 누른 순간** 던져야 한다(모듈 평가 중에 던지면 `LoginScreen`
 * 의 import 가 통째로 실패해 빈 화면이 된다 — ADR-0011). 여기서 던지면 그 구분이 사라진다.
 */

/**
 * 진입점이 값을 놓는 자리.
 *
 * 이름을 여기서 한 번만 적는다 — `vite.config.ts` 의 dev 미들웨어와 컨테이너 진입점이 같은
 * 이름을 써야 하고, 그 셋이 갈라지면 **값이 없는 것과 똑같이** 흰 화면으로 나타난다.
 */
export const RUNTIME_CONFIG_GLOBAL = '__NEOWADAEUM_CONFIG__'

/**
 * 앱이 읽는 설정 키. **컨테이너 환경변수 이름과 같다.**
 *
 * `PUBLIC_ORIGIN` 은 여기 없다 — 그 값은 공유 카드의 절대 주소(`og:url` · `og:image`)에만
 * 쓰이고, **스크레이퍼는 JS 를 돌리지 않으므로** `/config.js` 로는 닿지 않는다. 그것은
 * 진입점이 `index.html` 에 직접 써 넣는다 (`index.html` 의 자리표시자).
 */
export const RUNTIME_CONFIG_NAMES = ['API_BASE_URL', 'GOOGLE_OAUTH_CLIENT_ID'] as const

/**
 * 타입을 목록에서 **뽑는다.** 반대로 두면 — 타입을 손으로 적고 목록을 따로 적으면 — 키를 하나
 * 더할 때 한쪽만 고쳐도 통과하고, 빠진 값은 `undefined` 로 조용히 흐른다. `vite.config.ts` 의
 * dev 미들웨어가 이 목록을 그대로 읽는 이유도 같다.
 */
export type RuntimeConfigName = (typeof RUNTIME_CONFIG_NAMES)[number]

type RuntimeConfig = Partial<Record<RuntimeConfigName, unknown>>

/**
 * 놓인 값을 읽는다. 없거나 문자열이 아니거나 공백뿐이면 `undefined` 다.
 *
 * **공백뿐인 값을 설정된 것으로 보지 않는다.** compose 의 `KEY=` 처럼 *비어 있는 채로 넘어온
 * 값*이 흔하고, 그것을 통과시키면 실패가 한참 뒤 서버의 401 로 나타난다.
 *
 * `globalThis` 를 좁게 본다 — `declare global` 로 넓히면 이 값을 읽지 않는 파일까지 전역이
 * 있는 것으로 보인다 (`googleIdToken.ts` 가 GIS 를 그렇게 다루는 것과 같은 이유다).
 */
export function readRuntimeConfig(name: RuntimeConfigName): string | undefined {
  const configured = (globalThis as { __NEOWADAEUM_CONFIG__?: RuntimeConfig })[
    RUNTIME_CONFIG_GLOBAL
  ]?.[name]

  if (typeof configured !== 'string') return undefined

  const trimmed = configured.trim()
  return trimmed === '' ? undefined : trimmed
}
