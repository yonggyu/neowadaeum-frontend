import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../client'
import { createReport } from './reports'

function stubFetch(response: Response) {
  const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
    () => Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const BODY = {
  targetType: 'story',
  targetId: '11111111-2222-3333-4444-555555555555',
  reason: 'other',
  detail: null,
} as const

describe('createReport', () => {
  it('202_는_본문이_없다 — 접수 번호를 만들지 않는다 (§13-12)', async () => {
    // 몇 건인지도, 무엇이 일어났는지도 오지 않는다. 알려 주면 임계를 역산할 수 있기 때문이다.
    const fetchMock = stubFetch(new Response(null, { status: 202 }))

    const result = await createReport(BODY)

    expect(result).toBeUndefined()
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/api\/v1\/reports$/)
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
  })

  it('신고에는_Idempotency_Key_를_붙이지_않는다 — 중복은 409 로 알려야 한다 (F-7 의 대상이 아니다)', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 202 }))

    await createReport(BODY)

    const headers = (fetchMock.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>
    expect(headers['Idempotency-Key']).toBeUndefined()
  })

  it('409_ALREADY_EXISTS_는_서버의_message_와_함께_올라온다 (F-4 · 5d)', async () => {
    // 미리 판정할 수단이 계약에 없다 — 중복은 눌러 봐야 안다. 그래서 이 응답이 유일한 안내다.
    const fetchMock = stubFetch(
      new Response(
        JSON.stringify({ error: 'ALREADY_EXISTS', message: '이미 등록되어 있어요.', details: {} }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const failure = await createReport(BODY).catch((cause: unknown) => cause)

    expect(failure).toBeInstanceOf(ApiError)
    expect((failure as ApiError).errorCode).toBe('ALREADY_EXISTS')
    expect((failure as ApiError).message).toBe('이미 등록되어 있어요.')
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
