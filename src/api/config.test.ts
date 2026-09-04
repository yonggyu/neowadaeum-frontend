import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `config.ts` 는 모듈을 읽는 순간 값을 검사한다. 그래서 매번 캐시를 버리고 새로 import 해야
 * 검사가 다시 돈다.
 */
async function loadConfig() {
  vi.resetModules()
  return import('./config')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('API_BASE_URL', () => {
  /*
   * 이 파일이 있는 이유 (#113).
   *
   * `vite.config.ts` 의 `test.env` 가 테스트에 가짜 오리진을 넣어 준다. 그 픽스처 때문에
   * "값이 없으면 실패한다" 는 런타임 규칙이 **테스트에서 영영 확인되지 않는** 상태가 되면,
   * 다음 사람은 그 규칙이 아직 살아 있는지 알 수 없다. 아래 두 테스트가 그 자리를 메운다 —
   * 픽스처가 있어도 `required()` 자체는 여전히 던진다.
   */
  it('값이_없으면_던진다 — 기본값을 두지 않는다 (${VAR:기본값} 금지)', async () => {
    vi.stubEnv('VITE_API_BASE_URL', undefined)

    await expect(loadConfig()).rejects.toThrowError(/VITE_API_BASE_URL is required/)
  })

  it('값이_공백뿐이면_던진다 — 빈 문자열은 설정된 것이 아니다', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '   ')

    await expect(loadConfig()).rejects.toThrowError(/VITE_API_BASE_URL is required/)
  })

  it('끝_슬래시를_지운다 — 붙으면 경로에 // 가 생긴다', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.invalid///')

    await expect(loadConfig()).resolves.toMatchObject({
      API_BASE_URL: 'http://api.invalid',
      API_PREFIX: '/api/v1',
    })
  })
})
