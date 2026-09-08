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
  slotImageUrl,
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

/**
 * 되받은 그림을 어느 자리에 그리는가 (§13-78).
 *
 * 여기서 지키는 것은 **남의 초상을 이 사람의 것으로 그리지 않는다** 하나다. 인물의 순서가
 * 바뀌거나 하나가 지워지면 같은 자리에 다른 키가 오고, 그 판정을 컴포넌트의 정리 순서에
 * 맡기면 한 프레임이 새어 나간다.
 */
describe('그릴 그림 하나 (slotImageUrl)', () => {
  const KEY = 'drafts/abc/portrait/1.png'
  const OTHER = 'drafts/abc/portrait/2.png'

  it('S13_78_되받은_그림은_그_키의_자리에서만_그린다', () => {
    const restored = { key: KEY, url: 'blob:restored' }

    expect(slotImageUrl(null, restored, KEY)).toBe('blob:restored')
    expect(slotImageUrl(null, restored, OTHER)).toBeNull()
  })

  it('방금_고른_것이_이긴다 — 교체하는 중에 보고 싶은 것은 새 파일이다', () => {
    const restored = { key: KEY, url: 'blob:restored' }

    expect(slotImageUrl('blob:picked', restored, KEY)).toBe('blob:picked')
    // 자리가 바뀌어 되받은 것이 남의 것이 됐어도, 고른 파일은 이 사람의 것이다.
    expect(slotImageUrl('blob:picked', restored, OTHER)).toBe('blob:picked')
  })

  it('확정된_키가_없으면_되받은_것도_그리지_않는다 — 제거한 자리에 그림이 남지 않는다', () => {
    expect(slotImageUrl(null, { key: KEY, url: 'blob:restored' }, null)).toBeNull()
  })

  it('둘_다_없으면_없다 — 그때 자리에 남는 것은 한 줄이다', () => {
    expect(slotImageUrl(null, null, KEY)).toBeNull()
  })

  it('I8_키를_src_로_내보내지_않는다 — 돌려주는 것은 우리가 만든 blob 뿐이다', () => {
    // 키로 열리는 주소는 존재하지 않는다. 이 함수가 키를 받는 것은 대조하기 위해서이고,
    // 어떤 조합에서도 키 자체가 돌아 나오지 않는다.
    const cases = [
      slotImageUrl(null, { key: KEY, url: 'blob:restored' }, KEY),
      slotImageUrl('blob:picked', { key: KEY, url: 'blob:restored' }, KEY),
      slotImageUrl(null, { key: KEY, url: 'blob:restored' }, OTHER),
      slotImageUrl(null, null, KEY),
    ]

    for (const value of cases) {
      expect(value).not.toBe(KEY)
      expect(value).not.toBe(OTHER)
    }
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
