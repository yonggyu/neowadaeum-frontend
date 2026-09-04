import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

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
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
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
