import { describe, expect, it } from 'vitest'

import { ApiError } from '../../api/client'
import { StorageUploadError } from '../../api/endpoints/draftImages'
import {
  ACTION_LABEL,
  RESTORE_FAILED_NOTE,
  acceptNote,
  actionsFor,
  formatBytes,
  formatImageType,
  restoreStateOf,
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
  objectKeyOf,
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

/** 되받기의 세 자리. `RestoreState` 를 다 훑는 검사가 여기서 값을 집어 든다 */
const RESTORE_STATES = ['idle', 'fetching', 'failed'] as const

describe('버튼 — 아트보드가 그린 다섯 칸', () => {
  it('취소는_올리는_중에만_있다', () => {
    // 확정 중에 그만두면 화면은 "취소했다" 고 믿는데 서버 쪽에서는 확정이 끝나 있을 수 있다.
    expect(actionsFor(uploading(ISSUED), 'idle')).toEqual(['cancel'])
    expect(actionsFor(committing(), 'idle')).toEqual([])
    expect(actionsFor(EMPTY, 'idle')).not.toContain('cancel')
    expect(actionsFor(uploaded(COMMITTED), 'idle')).not.toContain('cancel')
  })

  it('세_버튼이_동시에_있는_순간이_없다 (390 아트보드)', () => {
    // 되받기의 두 자리가 늘어난 뒤에도 그대로다 — ⑤-b 가 셋이 아니라 하나인 이유가 이것이다.
    for (const state of FIVE_STATES) {
      for (const restore of RESTORE_STATES) {
        expect(actionsFor(state, restore).length).toBeLessThanOrEqual(2)
      }
    }
  })

  it('올라간_자리에만_교체와_제거가_함께_있다', () => {
    expect(actionsFor(uploaded(COMMITTED), 'idle')).toEqual(['replace', 'remove'])
  })

  it('모든_버튼에_아트보드의_말이_있다', () => {
    for (const state of FIVE_STATES) {
      for (const restore of RESTORE_STATES) {
        for (const action of actionsFor(state, restore)) {
          expect(ACTION_LABEL[action]).not.toBe('')
        }
      }
    }
  })
})

describe('자리 안의 한 줄', () => {
  it('F4_실패는_서버가_준_문구_그대로다', () => {
    const message = '이미지가 너무 커요.'

    expect(
      statusNote(failed(new ApiError(400, 'VALIDATION_ERROR', message, {})), 'idle'),
    ).toBe(message)
  })

  it('F4_서버가_말하지_않은_실패에는_하나뿐인_문구를_쓴다', () => {
    // 서명된 URL 의 상대는 우리 서버가 아니어서 `{error, message, details}` 를 주지 않는다.
    // 저장소가 준 것을 읽어 우리 말로 옮기면 그것이 곧 없는 계약을 지어내는 일이 된다.
    expect(statusNote(failed(new StorageUploadError(403)), 'idle')).toBe(UPLOAD_FAILED_MESSAGE)
    expect(statusNote(failed(new StorageUploadError(null)), 'idle')).toBe(UPLOAD_FAILED_MESSAGE)
  })

  it('다섯_상태가_모두_말할_것을_갖는다', () => {
    for (const state of FIVE_STATES) {
      expect(statusNote(state, 'idle')).not.toBe('')
    }
  })
})

describe('자리 안에 무엇이 오는가', () => {
  it('실패에는_그림을_그리지_않는다 — 확정 400 이면 서버가 그 객체를 지웠다', () => {
    // 우리 브라우저에 파일이 남아 있어도 그린 순간 화면은 "올라갔다" 고 말하는 셈이 된다.
    expect(
      slotBody(failed(new ApiError(400, 'VALIDATION_ERROR', '거절', {})), true, 'idle'),
    ).toEqual({
      image: false,
      note: true,
      icon: null,
    })
  })

  it('I8_되받기_전의_자리에는_그림이_없다 — 키만 있고 볼 수 있는 URL 이 없다', () => {
    // 되받기가 시작되기 전의 짧은 사이다. 시작되면 아래 ⑤-a 가 이 한 줄을 걷는다.
    const reopened = savedImage(COMMITTED.objectKey)

    expect(slotBody(reopened, false, 'idle')).toEqual({ image: false, note: true, icon: null })
    expect(statusNote(reopened, 'idle')).toBe('올라간 이미지')
  })

  it('진행_중에는_그림과_한_줄이_함께_온다', () => {
    // 그림만 두면 올라간 것과 올라가는 중이 같아 보인다.
    expect(slotBody(uploading(ISSUED), true, 'idle')).toEqual({
      image: true,
      note: true,
      icon: null,
    })
    expect(slotBody(committing(), true, 'idle')).toEqual({ image: true, note: true, icon: null })
  })

  it('방금_올린_자리는_그림만_그린다', () => {
    expect(slotBody(uploaded(COMMITTED), true, 'idle')).toEqual({
      image: true,
      note: false,
      icon: null,
    })
  })
})

/**
 * 되받기의 두 자리 — ⑤-a 받는 중 · ⑤-b 못 받음 (9차 아트보드 `SlotStates`, #173).
 *
 * 여기서 지키는 것이 이슈가 연 자리다: **둘이 화면에서 구분된다.** 그전에는 받는 중과 못
 * 받음이 똑같이 *"올라간 이미지"* 한 줄이어서, 작성자는 아직 오는 중인지 영영 안 오는지를
 * 알 수 없었다.
 */
describe('되받기 — ⑤ 안의 두 자리 (#173)', () => {
  const REOPENED = savedImage(COMMITTED.objectKey)
  const KEY = COMMITTED.objectKey
  const OTHER = 'drafts/abc/portrait/2.png'

  it('173_받는_중과_못_받음이_같은_모양이_아니다', () => {
    // 이슈가 연 자리 그대로다 — 둘이 갈라지지 않으면 나머지 검사는 뜻이 없다.
    expect(slotBody(REOPENED, false, 'fetching')).not.toEqual(slotBody(REOPENED, false, 'failed'))
  })

  it('173_받는_중은_여섯째_칸이_아니다 — ⑤ 의 버튼이 그대로다', () => {
    // 아트보드: *"칸을 늘리지 않는다 — ⑤ 안에서 그림 자리만 비운다"*.
    expect(actionsFor(REOPENED, 'fetching')).toEqual(['replace', 'remove'])
    expect(slotBody(REOPENED, false, 'fetching')).toEqual({
      image: false,
      note: false,
      icon: null,
    })
  })

  it('173_못_받음은_④_의_다시_고르기를_권하지_않는다', () => {
    // 올라간 것은 그대로 있다 — 다시 고르라고 하면 그것을 지우라고 권하는 셈이 된다.
    // `#211` 이 이 자리에 `remove` 를 더한 뒤에도 **이 경계는 그대로다** (아래 describe).
    expect(actionsFor(REOPENED, 'failed')).not.toContain('repick')
    expect(ACTION_LABEL.refetch).toBe('다시 불러오기')
  })

  it('173_못_받은_자리는_아트보드의_한_줄을_적는다', () => {
    expect(statusNote(REOPENED, 'failed')).toBe(RESTORE_FAILED_NOTE)
    expect(RESTORE_FAILED_NOTE).toBe('이미지를 불러오지 못했어요')
    expect(slotBody(REOPENED, false, 'failed')).toEqual({
      image: false,
      note: true,
      icon: 'broken',
    })
  })

  it('173_그림이_있으면_기다릴_것이_없다', () => {
    expect(restoreStateOf('blob:restored', null, KEY)).toBe('idle')
    // 교체하는 중이라 방금 고른 파일을 그리고 있어도 마찬가지다.
    expect(restoreStateOf('blob:picked', KEY, KEY)).toBe('idle')
  })

  it('173_그림이_없고_확정된_키가_있으면_받는_중이다', () => {
    expect(restoreStateOf(null, null, KEY)).toBe('fetching')
  })

  it('173_실패는_그_키의_자리에서만_못_받음이다', () => {
    // 인물의 순서가 바뀌면 같은 자리에 다른 키가 온다 — 앞 키의 실패를 물려받으면 화면은
    // 불러 본 적도 없는 그림을 못 받았다고 말한다.
    expect(restoreStateOf(null, KEY, KEY)).toBe('failed')
    expect(restoreStateOf(null, OTHER, KEY)).toBe('fetching')
  })

  it('173_되받기는_⑤_밖으로_새지_않는다 — 확정된 키가 있는 자리뿐이다', () => {
    // 확정된 키는 `uploaded` 에서만 나온다 (`objectKeyOf`). 그래서 ①②③④ 에서는 이 축이
    // 언제나 `idle` 이고, 받는 중이 여섯째 칸이 아니라는 말이 구조로 지켜진다.
    for (const state of FIVE_STATES) {
      const saved = objectKeyOf(state)
      if (saved !== null) continue
      expect(restoreStateOf(null, KEY, saved)).toBe('idle')
    }
  })
})

/**
 * 못 받은 자리에서 나가는 길 (⑤-b, #211).
 *
 * 아트보드는 여기 버튼을 하나만 그렸다. 그 하나로는 **객체가 영영 없는 경우** 작성자가
 * 되살릴 수도 치울 수도 없는 이미지를 원고에 붙인 채 남는다 — *다시 불러오기* 가 몇 번이든
 * 같은 결과를 내기 때문이고, 그것이 `B-2` 가 금지한 **갈 수 없는 곳으로 가는 문**이다.
 */
describe('못 받은 자리에서 나가는 길 (#211)', () => {
  const REOPENED = savedImage(COMMITTED.objectKey)

  it('211_영구히_못_받는_이미지를_작성자가_스스로_치울_수_있다', () => {
    expect(actionsFor(REOPENED, 'failed')).toEqual(['refetch', 'remove'])
    expect(ACTION_LABEL.remove).toBe('제거')
  })

  it('211_④_의_다시_고르기와_경계가_흐려지지_않는다', () => {
    // 사용자가 하지 않은 일을 그의 잘못으로 만들지 않는다 — 그 경계를 긋는 것이 `repick` 의
    // 부재이고, `remove` 는 ⑤ · ⑤-a 에서와 **같은 뜻**(원고에서 키를 뗀다)이라 겹치지 않는다.
    expect(actionsFor(REOPENED, 'failed')).not.toContain('repick')
    expect(actionsFor(failed(new StorageUploadError(403)), 'idle')).toEqual(['repick'])
  })

  it('211_교체는_두지_않는다 — 제거하면 자리가 ① 이 되고 거기에 참인 말이 서 있다', () => {
    // 셋을 나란히 두면 *"세 버튼이 동시에 있는 순간이 없다"* 가 그 자리에서 깨진다.
    expect(actionsFor(REOPENED, 'failed')).not.toContain('replace')
    expect(actionsFor(EMPTY, 'idle')).toEqual(['pick'])
    expect(ACTION_LABEL.pick).toBe('이미지 고르기')
  })

  it('211_되받기가_실패해도_원고의_값은_이_함수가_건드리지_않는다', () => {
    // 나가는 길이 생겼다고 상태가 바뀌지는 않는다 — 누르기 전까지 ⑤ 는 ⑤ 다.
    expect(objectKeyOf(REOPENED)).toBe(COMMITTED.objectKey)
    expect(statusNote(REOPENED, 'failed')).toBe(RESTORE_FAILED_NOTE)
  })
})

/**
 * 자리 안의 그림 조각 (#213).
 *
 * 9차 아트보드 `SlotStates` 는 **① 과 ⑤-b 에만** 조각을 그렸고, 뒤의 것은 앞의 것의 액자에
 * 대각선을 그은 모양이다. 코드는 ⑤-b 의 것만 갖고 있어서 **한 슬롯 안에서 어떤 상태는
 * 아이콘이 있고 어떤 상태는 없는** 모양이었다.
 */
describe('자리 안의 그림 조각 (#213)', () => {
  const REOPENED = savedImage(COMMITTED.objectKey)

  it('213_비어_있음도_아이콘을_갖는다', () => {
    expect(slotBody(EMPTY, false, 'idle').icon).toBe('picture')
  })

  it('213_아트보드가_그린_두_자리에만_조각이_있다', () => {
    // ①(picture) · ⑤-b(broken) 둘. 나머지는 그림이나 서버가 준 문구가 그 칸을 쓴다.
    expect(slotBody(REOPENED, false, 'failed').icon).toBe('broken')
    expect(slotBody(uploading(ISSUED), true, 'idle').icon).toBeNull()
    expect(slotBody(committing(), true, 'idle').icon).toBeNull()
    expect(slotBody(failed(new StorageUploadError(403)), false, 'idle').icon).toBeNull()
    expect(slotBody(uploaded(COMMITTED), true, 'idle').icon).toBeNull()
    expect(slotBody(REOPENED, false, 'fetching').icon).toBeNull()
  })

  it('213_조각은_그림이_없는_자리에만_온다', () => {
    // 그림 위에 얹으면 조각이 말할 것을 이미 그림이 말하고 있다. 고른 직후의 한 프레임이
    // 아직 `empty` 인데 미리보기는 있는 자리라(`start`), 이 규칙이 값으로 지켜져야 한다.
    for (const state of FIVE_STATES) {
      for (const restore of RESTORE_STATES) {
        for (const hasPreview of [false, true]) {
          const body = slotBody(state, hasPreview, restore)
          if (body.icon !== null) expect(body.image).toBe(false)
        }
      }
    }
    expect(slotBody(EMPTY, true, 'idle').icon).toBeNull()
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
