import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../client'
import {
  appealStorySuspension,
  createDraft,
  deleteDraft,
  deleteStory,
  getAuthoringMetadata,
  getDraft,
  listDrafts,
  outlineDraft,
  precheckDraft,
  previewDraft,
  submitDraft,
  updateDraft,
} from './authoring'

function stubFetch(response: Response) {
  const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(
    () => Promise.resolve(response),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const DRAFT_ID = '11111111-2222-3333-4444-555555555555'

const DRAFT = {
  draftId: DRAFT_ID,
  storyId: null,
  step: 1,
  payload: {},
  safetyState: 'clean',
  findings: [],
  updatedAt: '2026-09-01T00:00:00Z',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('원고 경로', () => {
  it('listDrafts_는_배열을_그대로_돌려준다 — 커서가 없다 (listDrafts)', async () => {
    const fetchMock = stubFetch(json([DRAFT], 200))

    const drafts = await listDrafts()

    expect(drafts).toHaveLength(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/api\/v1\/authoring\/drafts$/)
  })

  it('createDraft_는_본문_없이_POST_한다 — 계약에 requestBody 가 없다 (createDraft)', async () => {
    const fetchMock = stubFetch(json(DRAFT, 201))

    await createDraft()

    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeUndefined()
  })

  it('createDraft_의_409_는_ApiError_로_올라온다 — 원고 개수 상한 (R8.12 · §13-32)', async () => {
    // 상한 숫자는 응답에 없다. 화면이 그것을 지어내지 못하게 계약이 주지 않는 것이다.
    const fetchMock = stubFetch(
      json({ error: 'ALREADY_EXISTS', message: '이미 등록되어 있어요.', details: {} }, 409),
    )

    const failure = await createDraft().catch((cause: unknown) => cause)

    expect(failure).toBeInstanceOf(ApiError)
    expect((failure as ApiError).status).toBe(409)
    expect((failure as ApiError).message).toBe('이미 등록되어 있어요.')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('I8_getDraft_는_남의_원고에_404_를_받고_403_과_구분하지_않는다', async () => {
    // 존재 여부가 새면 원고 id 를 훑어 남이 무엇을 쓰고 있는지 알 수 있다. 그래서 이 함수는
    // 두 경우를 나누는 값을 만들지 않는다 — 호출부가 받는 것은 `ApiError` 하나다.
    stubFetch(json({ error: 'NOT_FOUND', message: '찾을 수 없어요.', details: {} }, 404))

    const failure = await getDraft(DRAFT_ID).catch((cause: unknown) => cause)

    expect(failure).toBeInstanceOf(ApiError)
    expect((failure as ApiError).errorCode).toBe('NOT_FOUND')
  })

  it('updateDraft_는_step_과_payload_를_PATCH_한다 (patchDraft)', async () => {
    const fetchMock = stubFetch(json({ ...DRAFT, step: 2 }, 200))

    const saved = await updateDraft(DRAFT_ID, { step: 2, payload: { title: '봄' } })

    expect(saved.step).toBe(2)
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('PATCH')
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ step: 2, payload: { title: '봄' } }))
  })

  it('deleteDraft_는_204_에_본문을_읽지_않는다 — 없어도 성공이다 (deleteDraft)', async () => {
    stubFetch(new Response(null, { status: 204 }))

    await expect(deleteDraft(DRAFT_ID)).resolves.toBeUndefined()
  })

  it('precheckDraft_는_fields_만_보낸다 — step 을 담지 않는다 (3d · §13-33)', async () => {
    const fetchMock = stubFetch(json({ state: 'clean', findings: [] }, 200))

    await precheckDraft(DRAFT_ID, { fields: { 'characters[0].name': '유나' } })

    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ fields: { 'characters[0].name': '유나' } }),
    )
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/precheck$/)
  })

  it('submitDraft_의_202_는_검수_상태를_담는다 — 본문이 있다 (submitDraft)', async () => {
    stubFetch(
      json(
        {
          storyId: DRAFT_ID,
          reviewStatus: 'pending',
          visibility: 'private',
          rejectReasons: [],
          updatedAt: DRAFT.updatedAt,
        },
        202,
      ),
    )

    const review = await submitDraft(DRAFT_ID, 'public')

    expect(review.reviewStatus).toBe('pending')
  })

  it('F7_원고_경로에는_Idempotency_Key_를_붙이지_않는다 — 계약이 턴 생성에만 선언했다', async () => {
    // 선언되지 않은 헤더는 서버가 무시하고, 무시된 헤더는 잘못된 안심을 준다.
    const fetchMock = stubFetch(json({ chapters: [], endings: [] }, 200))

    await outlineDraft(DRAFT_ID)

    const headers = (fetchMock.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>
    expect(headers['Idempotency-Key']).toBeUndefined()
  })

  it('previewDraft_는_turnLimit_을_응답에서_받는다 — 3 을 프론트가 적지 않는다 (§13-36)', async () => {
    stubFetch(json({ sessionId: DRAFT_ID, turnNo: 1, turnLimit: 3 }, 201))

    const preview = await previewDraft(DRAFT_ID)

    expect(preview.turnLimit).toBe(3)
  })
})

describe('deleteStory — backend #290, 정정본 §13-58', () => {
  const STORY_ID = '00000000-0000-4000-8000-0000000000ff'

  it('204_에는_본문이_없다 — 파싱하지_않는다', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }))

    await expect(deleteStory(STORY_ID)).resolves.toBeUndefined()
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/api\/v1\/stories\/[^/]+$/)
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE')
  })

  /** 이미 지운 작품 · 없는 작품 · 남의 작품이 같은 답을 받는다 (I-8). 화면도 구분하지 않는다. */
  it('I8_404_를_그대로_올린다 — 없는_작품과_남의_작품을_구분하지_않는다', async () => {
    stubFetch(json({ error: 'NOT_FOUND', message: '작품을 찾을 수 없어요.', details: {} }, 404))

    await expect(deleteStory(STORY_ID)).rejects.toMatchObject({
      status: 404,
      errorCode: 'NOT_FOUND',
      message: '작품을 찾을 수 없어요.',
    })
  })
})

describe('appealStorySuspension — backend #290, 정정본 §13-59', () => {
  const STORY_ID = '00000000-0000-4000-8000-0000000000ff'

  it('사유_하나만_보낸다 — 202_에는_본문이_없다', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 202 }))

    await expect(appealStorySuspension(STORY_ID, '오해가 있었습니다')).resolves.toBeUndefined()
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/appeal$/)
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST')
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ reason: '오해가 있었습니다' }))
  })

  /**
   * `409` 는 둘이고 **화면이 문구를 짓지 않는다** (F-4) — 이미 요청했는가와 정지 상태가
   * 아닌가는 다른 사실이지만, 둘 다 서버가 그 말을 한다.
   */
  it('F4_409_의_error_와_message_를_그대로_올린다', async () => {
    stubFetch(json({ error: 'ALREADY_EXISTS', message: '이미 요청하셨어요.', details: {} }, 409))

    await expect(appealStorySuspension(STORY_ID, '한 줄')).rejects.toMatchObject({
      status: 409,
      errorCode: 'ALREADY_EXISTS',
      message: '이미 요청하셨어요.',
    })
  })

  it('R6_2_Idempotency_Key_를_붙이지_않는다 — 계약이_선언한_자리가_아니다', async () => {
    const fetchMock = stubFetch(new Response(null, { status: 202 }))

    await appealStorySuspension(STORY_ID, '한 줄')

    const headers = (fetchMock.mock.calls[0]?.[1]?.headers ?? {}) as Record<string, string>
    expect(headers['Idempotency-Key']).toBeUndefined()
  })
})

describe('getAuthoringMetadata — 백엔드 #282 · #315, 정정본 §13-56', () => {
  it('F2_장르를_코드에_적지_않는다 — 응답이 준 순서 그대로 흘린다', async () => {
    const fetchMock = stubFetch(
      json(
        {
          genres: [
            { key: 'romance', label: '로맨스' },
            { key: 'fantasy', label: '판타지' },
          ],
          conditionTemplates: [],
        },
        200,
      ),
    )

    const metadata = await getAuthoringMetadata()

    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/\/api\/v1\/authoring\/metadata$/)
    // `display_order` 가 순서다 — 여기서 다시 정렬하면 라이브러리와 다른 순서를 보여 준다.
    expect(metadata.genres.map((genre) => genre.key)).toEqual(['romance', 'fantasy'])
  })

  it('조건_템플릿의_라벨과_입력_선언을_그대로_전한다 — 키를 옮겨 적지 않는다', async () => {
    stubFetch(
      json(
        {
          genres: [],
          conditionTemplates: [
            {
              key: 'affinity_at_least',
              label: '호감도 이상',
              description: '대상 인물의 호감도가 임계값 이상일 때 참입니다.',
              parameters: [
                { name: 'character', type: 'character', label: '인물' },
                { name: 'threshold', type: 'integer', label: '임계값' },
              ],
            },
          ],
        },
        200,
      ),
    )

    const [template] = (await getAuthoringMetadata()).conditionTemplates

    expect(template?.label).toBe('호감도 이상')
    expect(template?.parameters.map((parameter) => parameter.type)).toEqual([
      'character',
      'integer',
    ])
  })
})
