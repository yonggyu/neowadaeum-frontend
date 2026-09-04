import { describe, expect, it } from 'vitest'

import { ApiError } from '../../api/client'
import { StorageUploadError } from '../../api/endpoints/draftImages'
import {
  EMPTY,
  FILE_ACCEPT,
  UPLOAD_FAILED_MESSAGE,
  committing,
  failed,
  isBusy,
  objectKeyOf,
  requestableContentType,
  savedImage,
  uploaded,
  uploading,
} from './imageUpload'

const ISSUED = {
  objectKey: 'drafts/abc/cover/1.png',
  uploadUrl: 'https://storage.example.invalid/bucket/drafts/abc/cover/1.png?sig=s',
  uploadMethod: 'PUT',
  contentType: 'image/png',
  maxBytes: 5_242_880,
  expiresAt: '2026-09-04T00:05:00Z',
} as const

const COMMITTED = {
  objectKey: 'drafts/abc/cover/1.png',
  contentType: 'image/png',
  sizeBytes: 1234,
} as const

describe('원고에 적을 값', () => {
  it('확정_전에는_objectKey_를_내놓지_않는다 (§13-65)', () => {
    // 확정되지 않은 키는 **확인된 적이 없는 키**다. 다섯 상태 중 넷에서는 그 값을 꺼낼
    // 자리 자체가 없어야 한다 — 특히 `committing` 이 그렇다: 저장소는 받았지만 서버는
    // 아직 무엇이 올라왔는지 모른다.
    expect(objectKeyOf(EMPTY)).toBeNull()
    expect(objectKeyOf(uploading(ISSUED))).toBeNull()
    expect(objectKeyOf(committing())).toBeNull()
    expect(objectKeyOf(failed(new StorageUploadError(403)))).toBeNull()
  })

  it('확정된_뒤에만_원고에_적을_값이_나온다', () => {
    expect(objectKeyOf(uploaded(COMMITTED))).toBe(COMMITTED.objectKey)
  })

  it('I8_올라간_상태에도_URL_이_없다 — 화면이 URL 을 조립하지 않는다', () => {
    // 버킷이 비공개라 영구 공개 URL 이 존재하지 않는다. 키 앞에 오리진을 붙이는 코드는
    // 반드시 깨진 이미지를 그린다.
    const state = uploaded(COMMITTED)

    expect(Object.keys(state).sort()).toEqual(['contentType', 'objectKey', 'sizeBytes', 'status'])
    expect(JSON.stringify(state)).not.toContain('http')
  })

  it('확정_400_뒤의_상태는_올라감이_아니다 — 서버가 그 객체를 지웠다', () => {
    const rejected = failed(
      new ApiError(400, 'VALIDATION_ERROR', '이미지가 너무 커요.', {}),
    )

    expect(rejected.status).toBe('failed')
    expect(objectKeyOf(rejected)).toBeNull()
  })
})

describe('다섯 상태', () => {
  it('maxBytes_를_코드에_적지_않는다 — 발급 응답의 값을 그대로 든다', () => {
    // `5 * 1024 * 1024` 라고 쓰면 서버가 상한을 올리는 날 화면만 옛 숫자를 말한다.
    const state = uploading({ ...ISSUED, maxBytes: 7_340_032 })

    expect(state).toEqual({ status: 'uploading', maxBytes: 7_340_032 })
  })

  it('진행_중인_둘_동안은_막는다 — 확정 중에 다음 단계로 가면 키 없는 원고가 저장된다', () => {
    expect(isBusy(uploading(ISSUED))).toBe(true)
    expect(isBusy(committing())).toBe(true)
    expect(isBusy(EMPTY)).toBe(false)
    expect(isBusy(uploaded(COMMITTED))).toBe(false)
    expect(isBusy(failed(new StorageUploadError(null)))).toBe(false)
  })

  it('원고에_이미_적힌_키는_확정된_키다 — 다시 열면 올라감으로 복원한다', () => {
    // 확정되지 않은 키는 애초에 원고에 적히지 않는다. 형식과 크기는 원고가 들고 있지
    // 않으므로 `null` 이고, 화면은 그 둘 없이도 그려져야 한다.
    const restored = savedImage(COMMITTED.objectKey)

    expect(objectKeyOf(restored)).toBe(COMMITTED.objectKey)
    expect(restored).toEqual({
      status: 'uploaded',
      objectKey: COMMITTED.objectKey,
      contentType: null,
      sizeBytes: null,
    })
  })

  it('원고에_키가_없으면_비어_있음이다', () => {
    expect(savedImage(null)).toEqual(EMPTY)
    expect(savedImage(undefined)).toEqual(EMPTY)
    expect(savedImage('')).toEqual(EMPTY)
  })
})

describe('실패를 어떻게 말하는가', () => {
  it('F4_우리_서버가_말했으면_그_message_를_그대로_나른다', () => {
    const state = failed(new ApiError(404, 'NOT_FOUND', '찾을 수 없어요.', {}))

    expect(state).toEqual({ status: 'failed', message: '찾을 수 없어요.' })
  })

  it('F4_저장소가_실패하면_문구는_하나뿐이다 — 서버가 아무 말도 하지 않았다', () => {
    // 저장소는 우리 오류 형태로 말하지 않는다. 403(서명 만료) · CORS · 오프라인을 갈라
    // 적으면 우리가 모르는 것에 대해 화면마다 다른 추측이 남는다.
    expect(failed(new StorageUploadError(403))).toEqual({
      status: 'failed',
      message: UPLOAD_FAILED_MESSAGE,
    })
    expect(failed(new StorageUploadError(null)).status).toBe('failed')
    expect(failed(new TypeError('Failed to fetch'))).toEqual({
      status: 'failed',
      message: UPLOAD_FAILED_MESSAGE,
    })
  })

  it('저장소의_원문을_화면에_옮기지_않는다', () => {
    const state = failed(new StorageUploadError(403))

    expect(state.status === 'failed' && state.message).not.toContain('storage upload failed')
  })
})

describe('파일을 고르기 전의 형식 필터', () => {
  it('형식_목록은_계약의_열거에서_온다 — 코드가 새 형식을 만들지 않는다', () => {
    expect(requestableContentType('image/jpeg')).toBe('image/jpeg')
    expect(requestableContentType('image/png')).toBe('image/png')
    expect(requestableContentType('image/webp')).toBe('image/webp')
  })

  it('열거_밖은_발급을_부르지_않는다 — 서버가 거절할 요청을 보내지 않는다', () => {
    expect(requestableContentType('image/gif')).toBeNull()
    expect(requestableContentType('application/pdf')).toBeNull()
    expect(requestableContentType('')).toBeNull()
  })

  it('프로토타입_체인의_이름을_형식으로_받지_않는다', () => {
    // `fileType in REQUESTABLE` 로 적으면 `toString` 이 통과한다.
    expect(requestableContentType('toString')).toBeNull()
    expect(requestableContentType('constructor')).toBeNull()
  })

  it('accept_속성을_화면이_다시_적지_않는다', () => {
    expect(FILE_ACCEPT).toBe('image/jpeg,image/png,image/webp')
  })
})
