import { RUNTIME_CONFIG_GLOBAL } from './src/runtimeConfig'
import type { RuntimeConfigName } from './src/runtimeConfig'

/**
 * 러너가 넣는 설정 픽스처 (#113, #188).
 *
 * ## 왜 필요한가
 *
 * `src/api/config.ts` 는 값이 없으면 **모듈을 읽는 순간** 던진다. 그래서 값이 없는 자리 —
 * 특히 `.env` 가 gitignore 라 복사되지 않는 에이전트 워크트리 — 에서 `src/api/client.ts` 를
 * 타고 들어가는 파일이 **통째로 수집에 실패했다.** 테스트가 실패한 것이 아니라 아예 돌지
 * 않았고, 요약의 `Tests` 줄은 실패 0 으로 초록이었다.
 *
 * 값을 읽는 곳이 `import.meta.env` 에서 런타임 전역으로 바뀌었으므로(#188) 러너도 같은 자리에
 * 넣는다. **배포에서 컨테이너 진입점이 하는 일과 같은 일**이고, 그래서 테스트도 앱과 같은
 * 길을 걷는다.
 *
 * ## 값이 명백히 가짜여야 하는 이유
 *
 * `.invalid` 는 RFC 2606 이 예약해 둔 TLD 라 이름이 **절대 풀리지 않는다.** 테스트가 실수로
 * 진짜 요청을 보내면 성공하는 대신 실패하고, 이 값을 실제 호스트로 오해할 수도 없다.
 * 운영 오리진은 이 레포 어디에도 적지 않는다 (S-11).
 *
 * ## 여기에 클라이언트 ID 를 넣지 않는다
 *
 * `GOOGLE_OAUTH_CLIENT_ID` 가 없을 때의 동작(버튼을 누른 순간 던진다)이 **검사 대상**이다
 * (ADR-0011). 여기서 채워 두면 그 테스트가 픽스처를 지우는 것부터 해야 하고, 지우는 것을
 * 잊으면 *없을 때* 를 영영 확인하지 않게 된다. 필요한 테스트가 자기 것을 넣는다.
 */
export const RUNTIME_CONFIG_FIXTURE: Partial<Record<RuntimeConfigName, string>> = {
  API_BASE_URL: 'http://api.invalid',
}

Object.defineProperty(globalThis, RUNTIME_CONFIG_GLOBAL, {
  value: { ...RUNTIME_CONFIG_FIXTURE },
  writable: true,
  configurable: true,
})
