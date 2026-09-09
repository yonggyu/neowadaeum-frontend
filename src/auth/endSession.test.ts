import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { hasAccessToken, setAccessToken } from '../api/client'
import { guardDecision } from './guard'
import { endSession } from './session'

/**
 * **나갔다는 사실이 가드가 보는 자리까지 간다** (#231, §13-94).
 *
 * `beginSession.test.ts` 와 같은 이유로 두 모듈을 함께 부른다 — 세우려는 문장이
 * *"로그아웃하면 보호 라우트가 닫힌다"* 이고, 그것은 어느 한쪽만으로 참이 되지 않는다.
 * `#217` 이 그 틈에서 나왔다.
 *
 * **여기서 검증하지 못하는 한 칸** — 브라우저의 리프레시 쿠키가 실제로 사라지는가. 그것은
 * 서버가 보낸 `Set-Cookie` 를 브라우저가 처리하는 일이라 러너에 없다. 계약 쪽은
 * `auth.test.ts` 가 *`credentials: 'include'` 를 싣는가* 로 지키고, 나머지는 실제 브라우저
 * 확인에 남는다 (#231 의 DoD).
 */
function noContent(): Response {
  return new Response(null, { status: 204 })
}

describe('endSession', () => {
  beforeEach(() => {
    setAccessToken('access-1')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setAccessToken(null)
  })

  it('로그아웃_뒤_보호_라우트가_닫힌다_231', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(noContent())))

    expect(guardDecision(await endSession())).toBe('signIn')
  })

  it('S13_94_메모리의_액세스_토큰을_비운다__저장소에는_애초에_없다_F3', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(noContent())))

    await endSession()

    expect(hasAccessToken()).toBe(false)
  })

  it('서버가_무르지_못하면_나가지_않는다__화면만_익명이_되면_새로고침이_그것을_뒤집는다', async () => {
    // 쿠키는 `HttpOnly` 라 JS 가 지우지 못한다. 서버가 실패했는데 상태만 익명으로 만들면
    // 브라우저는 여전히 들고 있고, 새로고침 한 번에 다시 로그인된다.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))

    await expect(endSession()).rejects.toBeDefined()
    expect(hasAccessToken()).toBe(true)
  })

  it('서버를_먼저_부른다__토큰을_먼저_비우면_요청이_자격_증명_없이_나간다', async () => {
    const seen: boolean[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        seen.push(hasAccessToken())
        return Promise.resolve(noContent())
      }),
    )

    await endSession()

    expect(seen).toEqual([true])
  })
})
