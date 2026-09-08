import { afterEach, describe, expect, it, vi } from 'vitest'

import { advanceTurn, startSession } from './play'

/**
 * 계약 경로를 부르는 모양만 본다 — 응답 내용이 아니라 **요청이 계약대로 나가는지**다.
 *
 * 이 둘은 틀려도 화면이 멀쩡해 보이는 종류다: `restart` 를 빠뜨리면 409 로 끝나고,
 * `Idempotency-Key` 를 빠뜨리면 아무 표시 없이 **두 번 청구된다** (F-7).
 */
function stubFetch() {
  const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
    () => Promise.resolve(new Response(null, { status: 204 })),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const url = (mock: ReturnType<typeof stubFetch>): string => String(mock.mock.calls[0]?.[0])
const init = (mock: ReturnType<typeof stubFetch>): RequestInit => mock.mock.calls[0]?.[1] ?? {}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('startSession', () => {
  it('restart 없이는 쿼리를 붙이지 않는다 — 진행 중 세션을 버리는 것은 기본값이 아니다', async () => {
    const fetchMock = stubFetch()

    await startSession('11111111-2222-3333-4444-555555555555')

    expect(url(fetchMock)).toMatch(
      /\/api\/v1\/stories\/11111111-2222-3333-4444-555555555555\/sessions$/,
    )
    expect(init(fetchMock).method).toBe('POST')
  })

  it('다른_결말_보기는_restart_true_로_부른다 — 계약이 이 파라미터에 그 용도를 적었다 (§13-9)', async () => {
    const fetchMock = stubFetch()

    await startSession('11111111-2222-3333-4444-555555555555', { restart: true })

    // `restart=true` 는 기존 active 세션을 abandoned 로 전환한 뒤 새로 만든다 — 되돌릴 수 없다.
    expect(url(fetchMock)).toMatch(/\/sessions\?restart=true$/)
  })
})

describe('advanceTurn', () => {
  it('F7_턴_생성에는_Idempotency_Key_를_붙인다 — 없으면 재시도마다 두 번 청구된다 (R6.2)', async () => {
    const fetchMock = stubFetch()

    await advanceTurn(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      { choiceId: '12-2-1a2b3c4d', turnNo: 12 },
      'key-1',
    )

    const headers = init(fetchMock).headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBe('key-1')
  })

  it('F1_제출면은_choiceId_와_turnNo_뿐이다 — 화면에 보이는 text 를 보내지 않는다', async () => {
    const fetchMock = stubFetch()

    await advanceTurn(
      'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      { choiceId: '12-2-1a2b3c4d', turnNo: 12 },
      'key-1',
    )

    expect(JSON.parse(String(init(fetchMock).body))).toEqual({
      choiceId: '12-2-1a2b3c4d',
      turnNo: 12,
    })
  })
})
