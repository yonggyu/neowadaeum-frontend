import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../client'
import {
  StorageUploadError,
  commitDraftImageUpload,
  issueDraftImageUpload,
  putToStorage,
  uploadDraftImage,
} from './draftImages'

type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>

function stubFetch(): FetchMock {
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function initOf(fetchMock: FetchMock, call: number): RequestInit {
  return (fetchMock.mock.calls[call]?.[1] ?? {}) as RequestInit
}

function urlOf(fetchMock: FetchMock, call: number): string {
  return String(fetchMock.mock.calls[call]?.[0])
}

const DRAFT_ID = '11111111-2222-3333-4444-555555555555'
const STORAGE_URL = 'https://storage.example.invalid/bucket/drafts/x/cover/abc.png?X-Amz-Signature=s'

const ISSUED = {
  objectKey: 'drafts/11111111-2222-3333-4444-555555555555/cover/abc.png',
  uploadUrl: STORAGE_URL,
  uploadMethod: 'PUT',
  contentType: 'image/png',
  maxBytes: 5_242_880,
  expiresAt: '2026-09-04T00:05:00Z',
} as const

const COMMITTED = {
  objectKey: ISSUED.objectKey,
  contentType: 'image/png',
  sizeBytes: 1234,
} as const

const FILE = new Blob(['bytes'], { type: 'image/png' })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('발급 (issueDraftImageUpload)', () => {
  it('slot_과_contentType_만_보낸다 — 키(경로)는 서버가 정한다 (§13-65)', async () => {
    // 클라이언트가 경로를 정하면 남의 원고 자리에 덮어쓸 수 있다. 파일 이름도 확장자도
    // 보내지 않으며, 이 함수에는 그것을 받을 매개변수 자체가 없다.
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(json(ISSUED, 200))

    await issueDraftImageUpload(DRAFT_ID, 'cover', 'image/png')

    expect(initOf(fetchMock, 0).method).toBe('POST')
    expect(JSON.parse(String(initOf(fetchMock, 0).body))).toEqual({
      slot: 'cover',
      contentType: 'image/png',
    })
    expect(urlOf(fetchMock, 0)).toMatch(
      new RegExp(`/api/v1/authoring/drafts/${DRAFT_ID}/images$`),
    )
  })

  it('I8_남의_원고는_404_로_올라오고_403_과_구분되지_않는다', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(
      json({ error: 'NOT_FOUND', message: '찾을 수 없어요.', details: {} }, 404),
    )

    const failure = await issueDraftImageUpload(DRAFT_ID, 'portrait', 'image/jpeg').catch(
      (cause: unknown) => cause,
    )

    expect(failure).toBeInstanceOf(ApiError)
    expect((failure as ApiError).errorCode).toBe('NOT_FOUND')
  })
})

describe('저장소로 직접 PUT (putToStorage)', () => {
  it('F3_서명된_URL_에_우리_자격증명을_붙이지_않는다', async () => {
    // 서명된 URL 의 상대는 제3자의 저장소다. 우리 액세스 토큰은 API 전체를 여는 값이며
    // 저장소는 그것을 요구한 적이 없다 — 실어 보내면 남에게 자격 증명을 주는 일이 된다.
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

    await putToStorage(ISSUED, FILE)

    const headers = initOf(fetchMock, 0).headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
    expect(Object.keys(headers)).toEqual(['Content-Type'])
    expect(initOf(fetchMock, 0).credentials).toBeUndefined()
  })

  it('우리_API_클라이언트를_타지_않는다 — API_BASE_URL 이 앞에 붙지 않는다', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

    await putToStorage(ISSUED, FILE)

    expect(urlOf(fetchMock, 0)).toBe(STORAGE_URL)
    expect(urlOf(fetchMock, 0)).not.toContain('/api/v1')
  })

  it('Content_Type_은_발급받은_값_그대로다 — 서명된 헤더다 (§13-65)', async () => {
    // 발급 때 고른 형식과 다른 값으로 올리면 저장소가 서명 불일치로 거절한다. 그래서
    // 파일 쪽의 `type` 을 다시 읽지 않는다 — 갈라질 수 있는 자리를 만들지 않는다.
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))
    const mismatched = new Blob(['bytes'], { type: 'image/webp' })

    await putToStorage(ISSUED, mismatched)

    expect((initOf(fetchMock, 0).headers as Record<string, string>)['Content-Type']).toBe(
      'image/png',
    )
  })

  it('메서드를_우리가_정하지_않는다 — 계약의 uploadMethod 를 쓴다', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }))

    await putToStorage(ISSUED, FILE)

    expect(initOf(fetchMock, 0).method).toBe(ISSUED.uploadMethod)
  })

  it('F4_저장소_실패는_ApiError_가_아니다 — 우리 오류 형태로 오지 않았다', async () => {
    // 저장소가 준 것은 XML 이다. 그것을 `{error, message, details}` 로 옮기면 화면이
    // 서버가 하지 않은 말을 하게 된다.
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(
      new Response('<Error><Code>AccessDenied</Code></Error>', { status: 403 }),
    )

    const failure = await putToStorage(ISSUED, FILE).catch((cause: unknown) => cause)

    expect(failure).toBeInstanceOf(StorageUploadError)
    expect(failure).not.toBeInstanceOf(ApiError)
    expect((failure as StorageUploadError).status).toBe(403)
  })

  it('응답이_아예_없으면_status_가_null_이다 — CORS · 오프라인', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const failure = await putToStorage(ISSUED, FILE).catch((cause: unknown) => cause)

    expect(failure).toBeInstanceOf(StorageUploadError)
    expect((failure as StorageUploadError).status).toBeNull()
  })

  it('취소는_실패가_아니다 — AbortError 를 그대로 올린다', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))

    const failure = await putToStorage(ISSUED, FILE).catch((cause: unknown) => cause)

    expect(failure).toBeInstanceOf(DOMException)
    expect(failure).not.toBeInstanceOf(StorageUploadError)
  })
})

describe('확정 (commitDraftImageUpload)', () => {
  it('발급이_준_objectKey_를_그대로_보낸다', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(json(COMMITTED, 200))

    await commitDraftImageUpload(DRAFT_ID, ISSUED.objectKey)

    expect(JSON.parse(String(initOf(fetchMock, 0).body))).toEqual({ objectKey: ISSUED.objectKey })
    expect(urlOf(fetchMock, 0)).toMatch(/\/images\/commit$/)
  })

  it('응답에_이미지_URL_이_없다 — 버킷은 비공개다 (I-8)', async () => {
    const fetchMock = stubFetch()
    fetchMock.mockResolvedValueOnce(json(COMMITTED, 200))

    const committed = await commitDraftImageUpload(DRAFT_ID, ISSUED.objectKey)

    expect(Object.keys(committed).sort()).toEqual(['contentType', 'objectKey', 'sizeBytes'])
  })
})

describe('세 걸음 (uploadDraftImage)', () => {
  it('발급_PUT_확정_순서로_한_번씩_부른다 — 다 끝나야 원고에 적는다 (§13-65)', async () => {
    const fetchMock = stubFetch()
    fetchMock
      .mockResolvedValueOnce(json(ISSUED, 200))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json(COMMITTED, 200))
    const phases: string[] = []

    const committed = await uploadDraftImage(DRAFT_ID, 'cover', 'image/png', FILE, {
      onIssued: () => phases.push('issued'),
      onStored: () => phases.push('stored'),
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(urlOf(fetchMock, 0)).toMatch(/\/images$/)
    expect(urlOf(fetchMock, 1)).toBe(STORAGE_URL)
    expect(urlOf(fetchMock, 2)).toMatch(/\/images\/commit$/)
    expect(phases).toEqual(['issued', 'stored'])
    expect(committed.objectKey).toBe(ISSUED.objectKey)
  })

  it('저장소가_실패하면_확정을_부르지_않는다 — 올라간 적이 없다', async () => {
    const fetchMock = stubFetch()
    fetchMock
      .mockResolvedValueOnce(json(ISSUED, 200))
      .mockResolvedValueOnce(new Response('<Error/>', { status: 403 }))

    const failure = await uploadDraftImage(DRAFT_ID, 'cover', 'image/png', FILE).catch(
      (cause: unknown) => cause,
    )

    expect(failure).toBeInstanceOf(StorageUploadError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('확정이_400_이면_거절한다 — 서버가 그 객체를 지웠다 (§13-65)', async () => {
    // 상한을 넘었거나 형식이 목록 밖이면 서버가 객체를 지우고 `400` 을 준다. 이 자리를
    // "올라갔다" 로 두면 원고에 **없는 객체의 키**가 적힌다.
    const fetchMock = stubFetch()
    fetchMock
      .mockResolvedValueOnce(json(ISSUED, 200))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        json({ error: 'VALIDATION_ERROR', message: '이미지가 너무 커요.', details: {} }, 400),
      )

    const failure = await uploadDraftImage(DRAFT_ID, 'cover', 'image/png', FILE).catch(
      (cause: unknown) => cause,
    )

    expect(failure).toBeInstanceOf(ApiError)
    expect((failure as ApiError).status).toBe(400)
    expect((failure as ApiError).message).toBe('이미지가 너무 커요.')
  })

  it('F7_Idempotency_Key_를_붙이지_않는다 — 계약이 선언한 오퍼레이션이 아니다', async () => {
    const fetchMock = stubFetch()
    fetchMock
      .mockResolvedValueOnce(json(ISSUED, 200))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(json(COMMITTED, 200))

    await uploadDraftImage(DRAFT_ID, 'cover', 'image/png', FILE)

    for (const call of [0, 1, 2]) {
      expect((initOf(fetchMock, call).headers as Record<string, string>)['Idempotency-Key'])
        .toBeUndefined()
    }
  })
})

describe('클라이언트를 우회하는 자리의 경계', () => {
  it('소스에서_fetch_를_직접_부르는_파일은_둘뿐이다 — 조용히 늘어나는 것을 막는다', () => {
    // `endpoints/auth.test.ts` 의 자격 증명 경계 검사와 같은 방식이다. 우리 API 클라이언트를
    // 지나치는 요청은 `Authorization` 도 `401` 재발급도 계약 오류 형태도 받지 않으므로,
    // 그런 자리가 늘어나는 것은 리뷰가 알아야 하는 사실이다.
    const allowed = new Set([
      // 계약 경로 전부가 지나는 자리.
      join('src', 'api', 'client.ts'),
      // 서명된 URL 로 저장소에 직접 올리는 자리 — 우리 오리진이 아니다 (§13-65).
      join('src', 'api', 'endpoints', 'draftImages.ts'),
    ])

    const offenders = sourceFiles(join(process.cwd(), 'src'))
      .filter((path) => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'))
      .filter((path) => /\bfetch\(/.test(readFileSync(path, 'utf8')))
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
    if (entry.name === 'schema.d.ts') {
      return []
    }
    return entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') ? [path] : []
  })
}
