import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { configDefaults, defineConfig } from 'vitest/config'

import { EveryTestFileRuns } from './vitest.guard'

/** `public/` 안의 OG 카드. 파일을 옮기면 여기도 함께 옮긴다 (#137). */
const OG_IMAGE_FILE = 'og-card.png'

/**
 * 오리진이 있을 때만 절대 주소가 필요한 OG 태그를 붙인다 (#137, design-gaps E-3).
 *
 * ## 왜 `index.html` 에 그냥 적지 않는가
 *
 * `og:url` 과 `og:image` 는 **규격이 절대 주소를 요구한다.** 상대 경로를 적으면 카카오톡 ·
 * 슬랙 · X 의 스크레이퍼가 그것을 풀지 못한다. 그런데 **운영 도메인은 이 레포에 적지
 * 않는다 (S-11)** — 공개 레포라 커밋되는 순간 세계가 읽는다. 그래서 그 한 조각만 빌드
 * 시점에 `VITE_PUBLIC_ORIGIN` 으로 받는다. 나머지 OG 태그(`og:title` · `og:description` ·
 * `og:type` …)는 절대 주소가 필요 없으므로 `index.html` 에 그대로 있고 **언제나 나간다.**
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
 * **태그를 내지 않으면** 제목과 소개만 있는 멀쩡한 카드가 된다.
 *
 * **다만 값이 *있는데* 주소가 아니면 던진다.** 그건 빠뜨린 것이 아니라 잘못 적은 것이고,
 * 잘못 적힌 오리진은 조용히 넘어가면 모든 공유 링크를 남의 도메인으로 보낸다.
 */
function absoluteOpenGraphTags(): Plugin {
  let publicOrigin: URL | null = null
  let base = '/'

  return {
    name: 'neowadaeum:absolute-open-graph-tags',

    configResolved(config) {
      base = config.base
      const configured = String(config.env.VITE_PUBLIC_ORIGIN ?? '').trim()
      publicOrigin = configured === '' ? null : parsePublicOrigin(configured)
    },

    transformIndexHtml() {
      if (publicOrigin === null) return

      const canonical = new URL(base, publicOrigin)
      const image = new URL(OG_IMAGE_FILE, canonical)

      return [
        { tag: 'meta', attrs: { property: 'og:url', content: canonical.href }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image', content: image.href }, injectTo: 'head' },
        /* 카드 크기는 규격값 1200x630 이다. 미리 알려 주면 스크레이퍼가 이미지를 받기 전에
           큰 카드로 자리를 잡는다 */
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: '너와다음' }, injectTo: 'head' },
        /* 이미지가 있을 때만 큰 카드를 요청한다 — 이미지 없이 이 값만 있으면 X 가 빈 카드를
           그린다 */
        {
          tag: 'meta',
          attrs: { name: 'twitter:card', content: 'summary_large_image' },
          injectTo: 'head',
        },
      ]
    },
  }
}

/** 오리진으로 쓸 수 있는 모양인지 본다. 경로 · 질의 · 조각이 붙으면 오리진이 아니다. */
function parsePublicOrigin(configured: string): URL {
  let parsed: URL
  try {
    parsed = new URL(configured)
  } catch {
    throw new Error(
      'VITE_PUBLIC_ORIGIN 이 절대 주소가 아니다. 예: https://example.test (값 없이 두면 ' +
        'og:url · og:image 를 내지 않고 나머지 OG 태그만 나간다)',
    )
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('VITE_PUBLIC_ORIGIN 은 http 또는 https 여야 한다')
  }
  if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
    throw new Error('VITE_PUBLIC_ORIGIN 에 경로를 붙이지 않는다 — 오리진까지만 적는다')
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
  plugins: [react(), absoluteOpenGraphTags()],
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
     * **`${VAR:기본값}` 금지를 어기지 않는다.** 그 규칙은 *런타임 설정*을 향한다 — 설정을
     * 빠뜨린 빌드가 정상인 척 뜨다가 엉뚱한 곳을 부르는 것을 막는 것이 목적이고, `config.ts`
     * 의 `required()` 는 그대로 남아 그 일을 계속한다 (`src/api/config.test.ts` 가 못박는다).
     * 여기 있는 것은 **러너의 픽스처**다. `test` 블록은 vitest 만 읽으므로 `vite build` 가
     * 만드는 번들에는 이 값이 들어가지 않는다 — 들어갔다면 규칙을 진짜로 어긴 것이다.
     *
     * 값은 **명백히 가짜여야 한다.** `.invalid` 는 RFC 2606 이 예약해 둔 TLD 라 이름이 절대
     * 풀리지 않는다. 테스트가 실수로 진짜 요청을 보내면 성공하는 대신 실패하고, 이 값을 실제
     * 호스트로 오해할 수도 없다. 운영 오리진은 이 레포 어디에도 적지 않는다 (S-11).
     */
    env: {
      VITE_API_BASE_URL: 'http://api.invalid',
    },

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
