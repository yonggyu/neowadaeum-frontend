import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { loadEnv } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

import { RUNTIME_CONFIG_GLOBAL, RUNTIME_CONFIG_NAMES } from './src/runtimeConfig'
import type { RuntimeConfigName } from './src/runtimeConfig'
import { EveryTestFileRuns } from './vitest.guard'

/** `public/` 안의 OG 카드. 파일을 옮기면 여기도 함께 옮긴다 (#137). */
const OG_IMAGE_FILE = 'og-card.png'

/**
 * `index.html` 에서 `og:url` · `og:image` 가 들어갈 자리 (#188, ADR-0012).
 *
 * **컨테이너 진입점과 이 파일이 같은 문자열을 찾는다.** 한쪽만 고치면 dev 에서는 카드가 나오고
 * 배포에서는 안 나오거나 그 반대가 되며, **둘 다 조용하다** — 공유 링크를 눌러 보기 전까지
 * 아무 데도 드러나지 않는다.
 */
const OG_ABSOLUTE_MARKER = '<!--__OG_ABSOLUTE__-->'

/** 진입점이 써 내리는 파일의 경로. dev 에서는 아래 미들웨어가 같은 자리를 답한다. */
const RUNTIME_CONFIG_PATH = '/config.js'

/**
 * 오리진이 있을 때만 절대 주소가 필요한 OG 태그를 붙인다 (#137, design-gaps E-3).
 *
 * ## 왜 `index.html` 에 그냥 적지 않는가
 *
 * `og:url` 과 `og:image` 는 **규격이 절대 주소를 요구한다.** 상대 경로를 적으면 카카오톡 ·
 * 슬랙 · X 의 스크레이퍼가 그것을 풀지 못한다. 그런데 **운영 도메인은 이 레포에 적지
 * 않는다 (S-11)** — 공개 레포라 커밋되는 순간 세계가 읽는다. 그래서 그 한 조각만 밖에서
 * 받는다. 나머지 OG 태그(`og:title` · `og:description` · `og:type` …)는 절대 주소가 필요
 * 없으므로 `index.html` 에 그대로 있고 **언제나 나간다.**
 *
 * ## 왜 `/config.js` 로 주지 않는가 — 이 플러그인이 dev 전용인 이유 (#188, ADR-0012)
 *
 * 설정은 이제 런타임에 온다. **그러나 OG 는 그 길로 못 온다** — `/config.js` 는 브라우저가
 * JS 를 돌릴 때 읽히는데 **스크레이퍼는 JS 를 돌리지 않는다.** 위키 `00-Overview/design-gaps`
 * 가 동적 OG(작품별 카드)를 만들지 않은 이유로 이미 적어 둔 벽이고, 여기서 같은 벽을 만난다.
 *
 * 그래서 이 값만 **마크업에 직접** 들어간다. 배포에서는 컨테이너 진입점이 `PUBLIC_ORIGIN` 을
 * 받아 `index.html` 의 `OG_ABSOLUTE_MARKER` 자리를 채우고, **`npm run dev` 에서는 이
 * 플러그인이 같은 자리를 같은 모양으로 채운다.** `apply: 'serve'` 인 이유가 그것이다 —
 * 빌드 산출물은 오리진을 모르는 채로 나가야 하고, 그래야 이미지 하나가 어디서든 돈다.
 *
 * **두 곳이 같은 것을 만든다.** 그 값은 치른다 — 대신 둘이 공유하는 계약을 `OG_ABSOLUTE_MARKER`
 * 와 `absoluteOpenGraphMarkup` 둘로 좁혀 두었다.
 *
 * ## 값이 없으면 왜 실패시키지 않는가
 *
 * `${VAR:기본값}` 금지(#40)와 **다른 경우다.** 그 규칙이 막는 것은 *설정을 빠뜨린 빌드가
 * 정상인 척 뜨다가 엉뚱한 곳을 부르는 일*이고, `src/api/config.ts` 의 `required()` 가 그
 * 자리를 지킨다 — API 오리진이 없으면 앱이 뜨면 안 된다. 여기서 없는 것은 **미리보기
 * 카드**이고, 그것이 없다고 앱이 잘못 도는 것은 아니다. 즉 앱이 뜨는 조건이 아니라
 * **선택적 개선**이다.
 *
 * 그리고 기본값을 지어내는 쪽이 더 나쁘다 — 없는 주소를 가리키는 `og:image` 는 스크레이퍼가
 * 404 를 받아 카드가 깨진 채로 남고, 그 상태는 태그가 아예 없는 것보다 알아채기 어렵다.
 * **표시자를 그대로 두면** 제목과 소개만 있는 멀쩡한 카드가 된다.
 *
 * **다만 값이 *있는데* 주소가 아니면 던진다.** 그건 빠뜨린 것이 아니라 잘못 적은 것이고,
 * 잘못 적힌 오리진은 조용히 넘어가면 모든 공유 링크를 남의 도메인으로 보낸다.
 */
function absoluteOpenGraphTags(): Plugin {
  let publicOrigin: URL | null = null
  let base = '/'

  return {
    name: 'neowadaeum:absolute-open-graph-tags',
    // 배포에서는 진입점이 한다. 빌드 산출물은 오리진을 모른다.
    apply: 'serve',

    configResolved(config) {
      base = config.base
      const configured = String(loadEnv(config.mode, config.envDir, '').PUBLIC_ORIGIN ?? '').trim()
      publicOrigin = configured === '' ? null : parsePublicOrigin(configured)
    },

    transformIndexHtml: {
      // 표시자가 남아 있는 상태에서 마지막에 친다.
      order: 'post',
      handler(html) {
        if (publicOrigin === null) return
        return html.replace(OG_ABSOLUTE_MARKER, absoluteOpenGraphMarkup(new URL(base, publicOrigin)))
      },
    },
  }
}

/**
 * 표시자 자리에 들어가는 마크업.
 *
 * **컨테이너 진입점이 만드는 것과 같아야 한다.** 이 함수가 그 모양의 정본이며, 진입점은
 * 이것을 셸로 옮긴 것이다 (#187). 둘을 한 번 맞대 보는 것이 그 PR 의 일이다.
 */
function absoluteOpenGraphMarkup(canonical: URL): string {
  const image = new URL(OG_IMAGE_FILE, canonical)

  return [
    `<meta property="og:url" content="${canonical.href}" />`,
    `<meta property="og:image" content="${image.href}" />`,
    /* 카드 크기는 규격값 1200x630 이다. 미리 알려 주면 스크레이퍼가 이미지를 받기 전에
       큰 카드로 자리를 잡는다 */
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="너와다음" />`,
    /* 이미지가 있을 때만 큰 카드를 요청한다 — 이미지 없이 이 값만 있으면 X 가 빈 카드를
       그린다 */
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n    ')
}

/**
 * 설정을 런타임에 넘긴다 (#188, ADR-0012).
 *
 * ## 무엇을 하는가
 *
 * 1. `<head>` 맨 앞에 `<script src="/config.js">` 를 넣는다 — **모듈보다 먼저 실행돼야 한다.**
 *    `src/api/config.ts` 가 모듈 평가 중에 그 값을 읽기 때문이다.
 * 2. `npm run dev` 에서 그 경로를 답한다. 값은 `.env` 에서 읽는다.
 *
 * 배포에서는 2 번을 **컨테이너 진입점**이 한다 — 파일을 한 번 써 내리고 nginx 가 서빙한다.
 * **1 번은 양쪽이 같다**: 태그는 빌드 산출물에 들어 있다.
 *
 * ## 왜 `index.html` 에 태그를 직접 적지 않는가
 *
 * 적으면 Vite 가 그것을 **번들 입력으로 보려 한다.** `/config.js` 는 빌드 산출물이 아니라
 * 컨테이너가 뜰 때 생기는 것이므로 빌드 시점에는 존재하지 않는다.
 *
 * ## 왜 dev 에서도 같은 길을 걷는가
 *
 * `import.meta.env` 를 폴백으로 두면 코드는 적게 바뀌지만 **읽는 길이 둘**이 된다 — dev 에서
 * 되는 것이 배포에서 된다는 증거가 아니게 되고, 그 착시는 이 레포가 개발 서버 프록시를 두지
 * 않은 이유(`F-8`, 아래 `server`)와 같은 것이다. 그 문제를 배포까지 미루지 않는다.
 */
function runtimeConfigScript(): Plugin {
  let values: Partial<Record<RuntimeConfigName, string>> = {}

  return {
    name: 'neowadaeum:runtime-config',

    configResolved(config) {
      // 개발 서버일 때만 값을 읽는다.
      //
      // **`command` 만으로는 러너가 걸러지지 않는다.** vitest 도 설정을 `serve` 로 풀기 때문에
      // 아래 검사가 `npm test` 를 startup 에서 죽였다 — `.env` 가 없는 CI 와 새 워크트리에서
      // 전부다. `#113` 이 세운 *"테스트에는 `.env` 가 필요하지 않다"* 를 그대로 지킨다:
      // 러너의 값은 `vitest.setup.ts` 가 넣는다.
      if (config.command !== 'serve' || config.mode === 'test') return
      values = runtimeConfigValues(loadEnv(config.mode, config.envDir, ''))
    },

    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split('?')[0]
        if (path !== RUNTIME_CONFIG_PATH) {
          next()
          return
        }

        response.setHeader('Content-Type', 'application/javascript; charset=utf-8')
        // 배포의 nginx 도 이 파일만은 캐시하지 않아야 한다 (#187) — 캐시되면 값을 바꾸고
        // 컨테이너를 갈아 끼워도 브라우저가 옛 값을 계속 쓴다.
        response.setHeader('Cache-Control', 'no-store')
        response.end(runtimeConfigSource(values))
      })
    },

    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { src: RUNTIME_CONFIG_PATH },
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

/**
 * `.env` 에서 앱이 읽는 키만 골라 낸다.
 *
 * **`API_BASE_URL` 이 없으면 dev 서버가 뜨지 않는다.** 그대로 두면 브라우저에서 `required()`
 * 가 던지고 **흰 화면**이 되는데, 흰 화면은 무엇이 빠졌는지 말하지 않는다 (#183). 배포에서는
 * 컨테이너 진입점이 같은 자리에서 `exit 1` 한다 — 값이 없으면 실패시킨다는 규칙(§7.3)이
 * 읽는 시점을 옮긴 뒤에도 서야 한다.
 *
 * **`GOOGLE_OAUTH_CLIENT_ID` 는 없어도 뜬다.** 그 값의 실패는 *버튼을 누른 순간* 나야 한다는
 * 판단이 따로 있다 (ADR-0011 · `googleIdToken.ts`). 여기서 막으면 로그인을 쓰지 않는 작업까지
 * OAuth 앱을 요구하게 된다.
 */
function runtimeConfigValues(env: Record<string, string>): Partial<Record<RuntimeConfigName, string>> {
  const values: Partial<Record<RuntimeConfigName, string>> = {}

  for (const name of RUNTIME_CONFIG_NAMES) {
    const configured = (env[name] ?? '').trim()
    if (configured !== '') values[name] = configured
  }

  if (values.API_BASE_URL === undefined) {
    throw new Error(
      'API_BASE_URL 이 없다 — .env 에 적는다 (.env.example 참고).\n' +
        '  기본값을 두지 않는다: 지어낸 주소로 뜨면 엉뚱한 곳을 부르고, 값 없이 뜨면 흰 화면이 된다.',
    )
  }

  return values
}

/** `/config.js` 의 내용. 진입점이 만드는 것과 **같은 모양**이다 (#187). */
function runtimeConfigSource(values: Partial<Record<RuntimeConfigName, string>>): string {
  return `window.${RUNTIME_CONFIG_GLOBAL} = ${JSON.stringify(values)}\n`
}

/** 오리진으로 쓸 수 있는 모양인지 본다. 경로 · 질의 · 조각이 붙으면 오리진이 아니다. */
function parsePublicOrigin(configured: string): URL {
  let parsed: URL
  try {
    parsed = new URL(configured)
  } catch {
    throw new Error(
      'PUBLIC_ORIGIN 이 절대 주소가 아니다. 예: https://example.test (값 없이 두면 ' +
        'og:url · og:image 를 내지 않고 나머지 OG 태그만 나간다)',
    )
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('PUBLIC_ORIGIN 은 http 또는 https 여야 한다')
  }
  if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
    throw new Error('PUBLIC_ORIGIN 에 경로를 붙이지 않는다 — 오리진까지만 적는다')
  }
  return parsed
}

/**
 * 개발 서버 설정.
 *
 * 프록시를 두지 않는다. 백엔드가 CORS 를 정식으로 열었으므로(backend #248) 브라우저가 직접
 * 부르고, 그것이 운영에서 일어나는 일과 같다. 프록시로 덮으면 dev 에서만 통하고 배포에서
 * 터진다 — 그 문제를 배포까지 미루지 않는다.
 *
 * 포트를 5173 에 고정한다. 백엔드의 app.cors.allowed-origins 가 이 오리진을 알고 있어야 하며,
 * 포트가 매번 바뀌면 그 목록이 맞을 수 없다.
 */
export default defineConfig({
  plugins: [react(), runtimeConfigScript(), absoluteOpenGraphTags()],
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    /*
     * 테스트에서만 쓰는 가짜 API 오리진 (#113).
     *
     * `src/api/config.ts` 는 값이 없으면 던진다. 그래서 `.env` 가 없는 자리 — 특히 `.env` 가
     * gitignore 라 복사되지 않는 에이전트 워크트리 — 에서 `src/api/client.ts` 를 타고 들어가는
     * 파일이 통째로 수집에 실패했다. **테스트가 실패한 것이 아니라 아예 돌지 않았고**, 요약의
     * `Tests` 줄은 실패 0 으로 초록이었다. 그 상태를 각자 `.env` 를 복사해 넘긴 흔적이
     * 두 번 있었고, 어디에도 남지 않았다.
     *
     * **픽스처가 `env` 에서 `setupFiles` 로 옮겨졌다 (#188).** 값을 읽는 곳이
     * `import.meta.env` 가 아니라 런타임 전역이 됐으므로, 러너도 같은 자리에 넣어야 한다 —
     * `vitest.setup.ts` 가 그 일을 하고 **왜 가짜여야 하는지**도 거기 적혀 있다. 넣는 자리만
     * 바뀌었고 이 픽스처가 있는 이유는 그대로다.
     *
     * **`${VAR:기본값}` 금지를 어기지 않는다.** 그 규칙은 *런타임 설정*을 향한다 — 설정을
     * 빠뜨린 빌드가 정상인 척 뜨다가 엉뚱한 곳을 부르는 것을 막는 것이 목적이고, `config.ts`
     * 의 `required()` 는 그대로 남아 그 일을 계속한다 (`src/api/config.test.ts` 가 못박는다).
     * 여기 있는 것은 **러너의 픽스처**이며 `vite build` 가 만드는 번들에는 들어가지 않는다.
     */
    setupFiles: ['./vitest.setup.ts'],

    /*
     * 이 설정이 잡는 테스트 셋이 디스크의 테스트 파일과 같은지 센다 (#113).
     * 근거는 `vitest.guard.ts` 에 적었다.
     *
     * `env` 는 *이번* 원인 하나를 없앨 뿐이다. 다음에 다른 이유로 파일이 빠지면 같은 거짓
     * 초록이 다시 온다 — 그것을 막는 것은 이쪽이다.
     */
    reporters: ['default', new EveryTestFileRuns()],

    /*
     * 에이전트 워크트리를 테스트에서 제외한다 (#81).
     *
     * `.claude/worktrees/` 안에는 이 레포의 **전체 복사본**이 산다. 기본 `include` 는 그것을
     * 그대로 집어 올려, 머지된 브랜치의 낡은 테스트가 현재 테스트와 함께 돌았다 — `src/` 가
     * 33개일 때 러너는 84개를 셌다.
     *
     * **두 방향 모두 나쁘다.** 낡은 쪽이 실패하면 현재 작업과 무관한 빨간불의 원인을 `src/`
     * 에서 찾다가 못 찾고, 통과하면 지켜지는 것의 두 배가 넘는 숫자가 커버리지처럼 보인다.
     *
     * **CI 는 새로 체크아웃하므로 이 디렉터리가 없다.** 즉 제외하지 않으면 같은 `npm test`
     * 가 로컬과 CI 에서 다른 테스트 셋을 돈다 — `#32`(CI 가 낡은 계약을 본다) · `#40`
     * (`api:types` 가 실행 위치에 따라 다른 곳을 가리킨다) 과 같은 종류의 문제다.
     *
     * 기본값을 잃지 않도록 `configDefaults.exclude` 위에 더한다.
     */
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
