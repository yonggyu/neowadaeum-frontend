import { afterEach, describe, expect, it, vi } from 'vitest'

import { RUNTIME_CONFIG_GLOBAL, RUNTIME_CONFIG_NAMES, readRuntimeConfig } from './runtimeConfig'

function stubRuntimeConfig(value: unknown) {
  vi.stubGlobal(RUNTIME_CONFIG_GLOBAL, value)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readRuntimeConfig', () => {
  it('놓인_값을_읽는다', () => {
    stubRuntimeConfig({ API_BASE_URL: 'http://api.invalid' })

    expect(readRuntimeConfig('API_BASE_URL')).toBe('http://api.invalid')
  })

  /*
   * 진입점이 쓰지 못했거나, SPA fallback 이 `/config.js` 를 삼켰거나, 경로가 틀렸을 때다.
   * **부르는 쪽이 값이 빠진 것과 같은 실패를 내야 하므로** 여기서 던지지 않고 `undefined` 를 준다.
   */
  it('전역이_없으면_undefined — 설정 스크립트가 오지 못한 경우다', () => {
    stubRuntimeConfig(undefined)

    expect(readRuntimeConfig('API_BASE_URL')).toBeUndefined()
  })

  it('키가_없으면_undefined', () => {
    stubRuntimeConfig({})

    expect(readRuntimeConfig('API_BASE_URL')).toBeUndefined()
  })

  /*
   * compose 의 `KEY=` 는 **키를 지운 것이 아니라 빈 값을 넘긴 것**이다. 그것을 설정된 것으로
   * 보면 실패가 한참 뒤 서버의 401 로 나타난다.
   */
  it('공백뿐이면_설정된_것이_아니다', () => {
    stubRuntimeConfig({ API_BASE_URL: '   ' })

    expect(readRuntimeConfig('API_BASE_URL')).toBeUndefined()
  })

  it('앞뒤_공백을_지운다', () => {
    stubRuntimeConfig({ API_BASE_URL: '  http://api.invalid \n' })

    expect(readRuntimeConfig('API_BASE_URL')).toBe('http://api.invalid')
  })

  /*
   * 진입점이 셸에서 만드는 JSON 이므로 **문자열이 아닌 것이 올 수 있다.** 그 경우도 값이 없는
   * 것으로 본다 — 숫자나 객체를 오리진으로 쓰면 그 다음 실패가 원인을 말하지 않는다.
   */
  it('문자열이_아니면_설정된_것이_아니다', () => {
    stubRuntimeConfig({ API_BASE_URL: 8080 })

    expect(readRuntimeConfig('API_BASE_URL')).toBeUndefined()
  })
})

describe('RUNTIME_CONFIG_NAMES', () => {
  /*
   * F1 과 같은 종류의 못이다 — 이름이 갈라지면 값이 오지 않고, **흰 화면은 무엇이 빠졌는지
   * 말하지 않는다** (#183). 이 목록은 `vite.config.ts` 의 dev 미들웨어와 컨테이너 진입점(#187)이
   * 그대로 읽는 **환경변수 이름**이다.
   *
   * `PUBLIC_ORIGIN` 은 여기 없다 — 스크레이퍼가 JS 를 돌리지 않으므로 `/config.js` 로는 닿지
   * 않고, 진입점이 `index.html` 에 직접 써 넣는다.
   */
  it('앱이_읽는_키는_둘이다 — 컨테이너 환경변수 이름과 같다', () => {
    expect([...RUNTIME_CONFIG_NAMES]).toEqual(['API_BASE_URL', 'GOOGLE_OAUTH_CLIENT_ID'])
  })
})
