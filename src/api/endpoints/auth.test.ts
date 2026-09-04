import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../client'
import { getConsentTerms, loginWithOAuth, refreshToken } from './auth'
import { getLibrary } from './library'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const TOKENS = { accessToken: 'a', tokenType: 'Bearer', expiresIn: 1800 }

type FetchMock = ReturnType<typeof mockFetch>

function mockFetch(response: Response) {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** 마지막 요청의 `RequestInit`. 무엇을 실어 보냈는지는 여기 하나로만 확인한다. */
function lastInit(fetchMock: FetchMock): RequestInit {
  return fetchMock.mock.calls.at(-1)?.[1] ?? {}
}

function lastUrl(fetchMock: FetchMock): string {
  return fetchMock.mock.calls.at(-1)?.[0] ?? ''
}

function lastHeaders(fetchMock: FetchMock): Record<string, string> {
  return (lastInit(fetchMock).headers ?? {}) as Record<string, string>
}

describe('refreshToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('본문_없이_POST_한다 — 자격 증명이 쿠키 하나이므로 본문이 받을 것이 없다 (ADR-0008)', async () => {
    const fetchMock = mockFetch(json(200, TOKENS))

    await refreshToken('csrf-1')

    expect(lastUrl(fetchMock)).toMatch(/\/api\/v1\/auth\/refresh$/)
    expect(lastInit(fetchMock).method).toBe('POST')
    expect(lastInit(fetchMock).body).toBeUndefined()
  })

  it('자격_증명을_실어_보낸다 — 실지 않으면 브라우저가 쿠키도 Set-Cookie 도 버린다', async () => {
    const fetchMock = mockFetch(json(200, TOKENS))

    await refreshToken('csrf-1')

    expect(lastInit(fetchMock).credentials).toBe('include')
  })

  it('XSRF_쿠키_값을_그대로_헤더로_돌려보낸다 — double-submit 이 이 방식의 전부다', async () => {
    const fetchMock = mockFetch(json(200, TOKENS))

    await refreshToken('csrf-1')

    expect(lastHeaders(fetchMock)['X-XSRF-TOKEN']).toBe('csrf-1')
  })

  it('F4_403_이면_서버_message_를_그대로_나른다 — CSRF 불일치 문구를 프론트가 짓지 않는다', async () => {
    mockFetch(
      json(403, { error: 'FORBIDDEN', message: '요청을 처리할 수 없어요.', details: {} }),
    )

    const error = (await refreshToken('stale').catch((thrown: unknown) => thrown)) as ApiError

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(403)
    expect(error.errorCode).toBe('FORBIDDEN')
    expect(error.message).toBe('요청을 처리할 수 없어요.')
  })

  it('응답에_refreshToken_이_없다 — 본문으로 한 번 나가면 HttpOnly 보장이 문장으로만 남는다', async () => {
    mockFetch(json(200, TOKENS))

    const tokens = await refreshToken('csrf-1')

    // @ts-expect-error 계약의 TokenResponse 는 셋이다. 이 줄이 컴파일되면 계약이 되돌아간 것이다.
    expect(tokens.refreshToken).toBeUndefined()
  })
})

describe('loginWithOAuth', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('자격_증명을_실어_보낸다 — 이 응답의 Set-Cookie 가 리프레시 쿠키를 굽는다 (§13-60)', async () => {
    const fetchMock = mockFetch(json(200, TOKENS))

    await loginWithOAuth({ idToken: 'id-token' })

    expect(lastInit(fetchMock).credentials).toBe('include')
    // CSRF 를 요구하는 경로는 재발급 하나다. 로그인에는 붙지 않는다.
    expect(lastHeaders(fetchMock)['X-XSRF-TOKEN']).toBeUndefined()
  })
})

/**
 * **자격 증명이 다른 경로로 번지지 않는다** (이슈 #85 의 확인 항목).
 *
 * 번지면 모든 요청이 쿠키를 싣게 되고, 백엔드가 재발급 하나로 좁혀 둔 CSRF 경계(ADR-0008)와
 * 어긋난다. 실행으로 한 번, 소스로 한 번 못박는다 — 실행만 보면 **아직 테스트가 없는 새 경로**가
 * 조용히 통과한다.
 */
describe('withCredentials 는 인증 두 경로 밖으로 번지지 않는다', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('다른_경로는_쿠키를_싣지_않는다 — 기본값 same-origin 그대로다', async () => {
    // 응답 본문은 한 번만 읽힌다 — 호출마다 새로 만든다.
    const fetchMock = vi.fn(() => Promise.resolve(json(200, {})))
    vi.stubGlobal('fetch', fetchMock)

    await getLibrary()
    expect(lastInit(fetchMock).credentials).toBeUndefined()

    await getConsentTerms()
    expect(lastInit(fetchMock).credentials).toBeUndefined()
  })

  it('소스에서도_두_파일_밖에_없다 — 새 경로가 조용히 늘어나는 것을 막는다', () => {
    const allowed = new Set([
      // 옵션을 정의하고 `credentials: 'include'` 로 옮기는 자리.
      join('src', 'api', 'client.ts'),
      // 계약이 이 옵션을 허락한 오퍼레이션 둘이 사는 자리.
      join('src', 'api', 'endpoints', 'auth.ts'),
      // 이 테스트 자신.
      join('src', 'api', 'endpoints', 'auth.test.ts'),
    ])

    const offenders = sourceFiles(join(process.cwd(), 'src'))
      .filter((path) => readFileSync(path, 'utf8').includes('withCredentials'))
      .map((path) => path.slice(process.cwd().length + 1))
      .filter((path) => !allowed.has(path))

    expect(offenders).toEqual([])
  })
})

/** `src/**` 의 `.ts` · `.tsx` 전부. 생성물(`schema.d.ts`)은 소스가 아니다. */
function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      return sourceFiles(path)
    }
    if (entry.name.endsWith('.d.ts')) {
      return []
    }
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [path] : []
  })
}
