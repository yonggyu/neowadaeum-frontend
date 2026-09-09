import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hasAccessToken, setAccessToken } from '../api/client'
import type { TokenResponse } from '../api/endpoints/auth'
import type { MeResponse } from '../api/endpoints/me'
import { guardDecision } from './guard'
import { beginSession, restoreSession } from './session'

/**
 * **조각이 아니라 이음매를 본다** (#217).
 *
 * `session.test.ts` 는 부팅 복원이 옳은 `AuthState` 를 만드는지 보고, `guard.test.ts` 는
 * 주어진 `AuthState` 를 옳게 판정하는지 본다. **둘 다 통과하는 동안 로그인은 깨져 있었다** —
 * 로그인 성공을 그 상태로 옮기는 길이 없어서, 화면이 토큰을 넣어도 가드가 보는 값은 부팅
 * 때의 `anonymous` 그대로였기 때문이다.
 *
 * 그래서 이 파일은 일부러 **두 모듈을 함께** 부른다. 여기서 `guardDecision` 을 부르는 것이
 * 중복이 아니라 요구사항이다: 세우려는 문장이 *"로그인이 성공하면 보호 라우트가 열린다"* 이고,
 * 그 문장은 두 모듈 중 어느 한쪽만으로는 참이 되지 않는다.
 *
 * **여기서 검증하지 못하는 한 칸이 남는다** — 화면이 실제로 이 길을 부르는가. 이 레포에는
 * DOM 테스트 환경(jsdom · testing-library)이 없어 컴포넌트를 렌더할 수 없다. 그 칸은 지금
 * 타입이 든다: `LoginScreen` 이 `onSignedIn` 을 **필수 prop 으로** 요구하므로 라우터가,
 * 라우터가 요구하므로 `App` 이 그것을 내려보내야 한다.
 */
const ACCOUNT: MeResponse = { displayName: null, role: 'user', status: 'active' }

/** 계약의 `TokenResponse` — 계정을 싣지 않는다. 그래서 `GET /me` 가 뒤따른다. */
const TOKENS: TokenResponse = { accessToken: 'fresh-access', tokenType: 'Bearer', expiresIn: 1800 }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('beginSession', () => {
  beforeEach(() => {
    setAccessToken(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setAccessToken(null)
  })

  it('로그인_성공_뒤_보호_라우트가_열린다_217 — 가드가 보는 값이 이 한 번으로 바뀐다', async () => {
    // 1. 부팅 — 토큰도 리프레시 쿠키도 없다. 가드는 로그인으로 보낸다.
    vi.stubGlobal('fetch', vi.fn())
    expect(guardDecision(await restoreSession())).toBe('signIn')

    // 2. 로그인이 성공해 서버가 토큰을 줬다.
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, ACCOUNT))))

    // 3. **그 사실이 가드가 읽는 값이 된다.** 이 줄이 없던 것이 #217 이다 — 토큰만 모듈
    //    변수에 들어가고 `AuthState` 는 위 1번의 `anonymous` 그대로여서, 로그인 직후
    //    `RequireAuth` 가 사용자를 로그인 화면으로 되돌렸다.
    expect(guardDecision(await beginSession(TOKENS))).toBe('render')
  })

  it('로그인_직후에는_재발급하지_않는다 — 방금 받은 토큰으로 GET me 한 번이다', async () => {
    const paths: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        paths.push(new URL(url).pathname)
        return Promise.resolve(jsonResponse(200, ACCOUNT))
      }),
    )

    expect(await beginSession(TOKENS)).toEqual({ kind: 'authenticated', account: ACCOUNT })
    // 부팅과 같은 길을 타지만 앞의 재발급 단계는 지나간다 — 토큰이 이미 손에 있다.
    expect(paths).toEqual(['/api/v1/me'])
    // 저장소가 아니라 메모리다 (F-3). 그 자리는 `client.ts` 하나이며 화면이 직접 쓰지 않는다.
    expect(hasAccessToken()).toBe(true)
  })

  it('서버가_답하지_못해도_로그인으로_되돌리지_않는다 — 모르는 것과 로그아웃은 다르다', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))

    // 로그인은 이미 성립했다. `GET /me` 가 오지 않은 것은 그 사실을 무르지 않는다 —
    // 여기서 `signIn` 을 내면 사용자가 있지도 않은 로그아웃을 고치려 든다 (`guard.ts`).
    expect(guardDecision(await beginSession(TOKENS))).toBe('unreachable')
  })
})
