import { afterEach, describe, expect, it, vi } from 'vitest'

import { readCsrfToken } from './csrf'

/**
 * `XSRF-TOKEN` 쿠키를 읽는 자리 하나 (ADR-0008).
 *
 * 파싱을 여기 가둔 이유가 이 테스트들이다 — 부분 문자열 일치와 인코딩은 화면마다 다시 짜면
 * 그중 하나가 조용히 틀린다.
 */
describe('readCsrfToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function withCookies(cookie: string) {
    vi.stubGlobal('document', { cookie })
  }

  it('쿠키에서_값을_꺼낸다 — 그대로 X-XSRF-TOKEN 헤더로 돌아간다 (double-submit)', () => {
    withCookies('XSRF-TOKEN=abc123')

    expect(readCsrfToken()).toBe('abc123')
  })

  it('다른_쿠키들_사이에서도_찾는다 — 서버는 이 쿠키만 굽지 않는다', () => {
    withCookies('foo=1; XSRF-TOKEN=abc123; bar=2')

    expect(readCsrfToken()).toBe('abc123')
  })

  it('이름이_정확히_같을_때만_찾는다 — MY-XSRF-TOKEN 은 다른 쿠키다', () => {
    withCookies('MY-XSRF-TOKEN=wrong')

    expect(readCsrfToken()).toBeNull()
  })

  it('URL_인코딩된_값을_디코딩한다 — 서버가 인코딩해 굽는다', () => {
    withCookies('XSRF-TOKEN=a%2Bb%3Dc')

    expect(readCsrfToken()).toBe('a+b=c')
  })

  it('없으면_null_이다 — 빈 문자열로 대신하면 "없다"는 사실이 사라진다', () => {
    withCookies('other=1')

    expect(readCsrfToken()).toBeNull()
  })

  it('브라우저가_아니면_null_이다 — 쿠키가 있는 척하지 않는다', () => {
    expect(typeof document).toBe('undefined')
    expect(readCsrfToken()).toBeNull()
  })
})
