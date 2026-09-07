import { afterEach, describe, expect, it, vi } from 'vitest'

import { RUNTIME_CONFIG_GLOBAL } from '../runtimeConfig'

/**
 * `config.ts` 는 모듈을 읽는 순간 값을 검사한다. 그래서 매번 캐시를 버리고 새로 import 해야
 * 검사가 다시 돈다.
 */
async function loadConfig() {
  vi.resetModules()
  return import('./config')
}

/** 진입점이 `/config.js` 로 놓는 자리를 테스트가 대신 놓는다 (#188). */
function stubRuntimeConfig(value: unknown) {
  vi.stubGlobal(RUNTIME_CONFIG_GLOBAL, value)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('API_BASE_URL', () => {
  /*
   * 이 파일이 있는 이유 (#113).
   *
   * `vitest.setup.ts` 가 테스트에 가짜 오리진을 넣어 준다. 그 픽스처 때문에 "값이 없으면
   * 실패한다" 는 런타임 규칙이 **테스트에서 영영 확인되지 않는** 상태가 되면, 다음 사람은
   * 그 규칙이 아직 살아 있는지 알 수 없다. 아래 테스트들이 그 자리를 메운다 —
   * 픽스처가 있어도 `required()` 자체는 여전히 던진다.
   */
  it('값이_없으면_던진다 — 기본값을 두지 않는다 (${VAR:기본값} 금지)', async () => {
    stubRuntimeConfig({})

    await expect(loadConfig()).rejects.toThrowError(/API_BASE_URL is required/)
  })

  it('값이_공백뿐이면_던진다 — 빈 문자열은 설정된 것이 아니다', async () => {
    stubRuntimeConfig({ API_BASE_URL: '   ' })

    await expect(loadConfig()).rejects.toThrowError(/API_BASE_URL is required/)
  })

  /*
   * `/config.js` 는 **이미지 안에 없다.** 컨테이너가 뜰 때 생기고, nginx 가 그것을 서빙한다
   * (#187 · #188). 그 파일이 오지 못하는 경우 — 진입점이 쓰지 못했거나, SPA fallback 이
   * 삼켰거나, 경로가 틀렸거나 — 전역 자체가 없다. **값이 빠진 것과 같은 실패여야 한다.**
   */
  it('전역이_아예_없어도_던진다 — 설정 스크립트가 오지 못한 경우다', async () => {
    stubRuntimeConfig(undefined)

    await expect(loadConfig()).rejects.toThrowError(/API_BASE_URL is required/)
  })

  it('끝_슬래시를_지운다 — 붙으면 경로에 // 가 생긴다', async () => {
    stubRuntimeConfig({ API_BASE_URL: 'http://api.invalid///' })

    await expect(loadConfig()).resolves.toMatchObject({
      API_BASE_URL: 'http://api.invalid',
      API_PREFIX: '/api/v1',
    })
  })

  it('앞뒤_공백을_지운다 — compose 의 KEY= 값에 흔하다', async () => {
    stubRuntimeConfig({ API_BASE_URL: '  http://api.invalid  ' })

    await expect(loadConfig()).resolves.toMatchObject({
      API_BASE_URL: 'http://api.invalid',
    })
  })
})
