import { describe, expect, it } from 'vitest'

import { ApiError } from '../../api/client'
import { StorageUploadError } from '../../api/endpoints/draftImages'
import {
  ACTION_LABEL,
  acceptNote,
  actionsFor,
  formatBytes,
  formatImageType,
  sizeNote,
  slotBody,
  statusNote,
} from './imageSlotView'
import {
  EMPTY,
  FILE_ACCEPT,
  UPLOAD_FAILED_MESSAGE,
  committing,
  failed,
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
  contentType: 'image/jpeg',
  sizeBytes: 1_258_291,
} as const

const FIVE_STATES = [
  EMPTY,
  uploading(ISSUED),
  committing(),
  failed(new StorageUploadError(403)),
  uploaded(COMMITTED),
] as const

describe('버튼 — 아트보드가 그린 다섯 칸', () => {
  it('취소는_올리는_중에만_있다', () => {
    // 확정 중에 그만두면 화면은 "취소했다" 고 믿는데 서버 쪽에서는 확정이 끝나 있을 수 있다.
    expect(actionsFor(uploading(ISSUED))).toEqual(['cancel'])
    expect(actionsFor(committing())).toEqual([])
    expect(actionsFor(EMPTY)).not.toContain('cancel')
    expect(actionsFor(uploaded(COMMITTED))).not.toContain('cancel')
  })

  it('세_버튼이_동시에_있는_순간이_없다 (390 아트보드)', () => {
    for (const state of FIVE_STATES) {
      expect(actionsFor(state).length).toBeLessThanOrEqual(2)
    }
  })

  it('올라간_자리에만_교체와_제거가_함께_있다', () => {
    expect(actionsFor(uploaded(COMMITTED))).toEqual(['replace', 'remove'])
  })

  it('모든_버튼에_아트보드의_말이_있다', () => {
    for (const state of FIVE_STATES) {
      for (const action of actionsFor(state)) {
        expect(ACTION_LABEL[action]).not.toBe('')
      }
    }
  })
})

describe('자리 안의 한 줄', () => {
  it('F4_실패는_서버가_준_문구_그대로다', () => {
    const message = '이미지가 너무 커요.'

    expect(statusNote(failed(new ApiError(400, 'VALIDATION_ERROR', message, {})))).toBe(message)
  })

  it('F4_서버가_말하지_않은_실패에는_하나뿐인_문구를_쓴다', () => {
    // 서명된 URL 의 상대는 우리 서버가 아니어서 `{error, message, details}` 를 주지 않는다.
    // 저장소가 준 것을 읽어 우리 말로 옮기면 그것이 곧 없는 계약을 지어내는 일이 된다.
    expect(statusNote(failed(new StorageUploadError(403)))).toBe(UPLOAD_FAILED_MESSAGE)
    expect(statusNote(failed(new StorageUploadError(null)))).toBe(UPLOAD_FAILED_MESSAGE)
  })

  it('다섯_상태가_모두_말할_것을_갖는다', () => {
    for (const state of FIVE_STATES) {
      expect(statusNote(state)).not.toBe('')
    }
  })
})

describe('자리 안에 무엇이 오는가', () => {
  it('실패에는_그림을_그리지_않는다 — 확정 400 이면 서버가 그 객체를 지웠다', () => {
    // 우리 브라우저에 파일이 남아 있어도 그린 순간 화면은 "올라갔다" 고 말하는 셈이 된다.
    expect(slotBody(failed(new ApiError(400, 'VALIDATION_ERROR', '거절', {})), true)).toEqual({
      image: false,
      note: true,
    })
  })

  it('I8_원고를_다시_열면_그림이_없다 — 키만 있고 볼 수 있는 URL 이 없다', () => {
    const reopened = savedImage(COMMITTED.objectKey)

    expect(slotBody(reopened, false)).toEqual({ image: false, note: true })
    expect(statusNote(reopened)).toBe('올라간 이미지')
  })

  it('진행_중에는_그림과_한_줄이_함께_온다', () => {
    // 그림만 두면 올라간 것과 올라가는 중이 같아 보인다.
    expect(slotBody(uploading(ISSUED), true)).toEqual({ image: true, note: true })
    expect(slotBody(committing(), true)).toEqual({ image: true, note: true })
  })

  it('방금_올린_자리는_그림만_그린다', () => {
    expect(slotBody(uploaded(COMMITTED), true)).toEqual({ image: true, note: false })
  })
})

describe('크기와 형식 — 화면이 적은 값이 하나도 없다', () => {
  it('상한은_발급_응답의_값이다', () => {
    // 5 MiB = 5,242,880. 1000 으로 나누면 아트보드가 "5 MB" 라고 적은 자리에 5.2 가 적힌다.
    expect(formatBytes(ISSUED.maxBytes)).toBe('5 MB')
    expect(formatBytes(COMMITTED.sizeBytes)).toBe('1.2 MB')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(512)).toBe('512 B')
  })

  it('올리는_중에는_고른_파일과_서버가_준_상한을_함께_말한다', () => {
    expect(sizeNote(uploading(ISSUED), 1_258_291)).toBe('1.2 MB / 5 MB')
  })

  it('확정된_형식과_크기는_저장소가_말한_것이다', () => {
    expect(sizeNote(uploaded(COMMITTED), null)).toBe('JPEG · 1.2 MB')
  })

  it('원고를_다시_열면_형식도_크기도_말하지_않는다', () => {
    // 원고가 든 것은 키뿐이다 — 아는 척하는 대신 줄을 통째로 두지 않는다.
    expect(sizeNote(savedImage(COMMITTED.objectKey), null)).toBeNull()
    expect(sizeNote(EMPTY, null)).toBeNull()
    expect(sizeNote(failed(null), null)).toBeNull()
  })

  it('고를_수_있는_형식은_계약의_열거에서_온다 — 화면이 목록을 적지 않는다', () => {
    // `FILE_ACCEPT` 의 출처는 `ImageUploadRequest.contentType` 이다 (`imageUpload.ts`).
    // 계약이 형식을 늘리면 이 줄도 함께 는다.
    expect(acceptNote(FILE_ACCEPT)).toBe('JPEG · PNG · WEBP')
    expect(formatImageType('image/webp')).toBe('WEBP')
  })
})
