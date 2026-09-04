import { useEffect, useRef, useState } from 'react'

import { uploadDraftImage, type ImageSlot } from '../../api/endpoints/draftImages'
import {
  ACTION_LABEL,
  acceptNote,
  actionsFor,
  sizeNote,
  slotBody,
  statusNote,
  type SlotAction,
} from './imageSlotView'
import {
  EMPTY,
  FILE_ACCEPT,
  committing,
  failed,
  isBusy,
  objectKeyOf,
  requestableContentType,
  savedImage,
  uploaded,
  uploading,
  type ImageUploadState,
} from './imageUpload'
import css from './wizard.module.css'

/**
 * 대표 이미지 자리 하나 — **커버와 인물 초상이 같은 컴포넌트를 쓰고 폭만 다르다**
 * (7차 와이어프레임 `UploadStates` · `ImageUpload` · `ImageUploadMobile`).
 *
 * 실제 사용처가 둘이므로 공통 컴포넌트가 정당하다 (CLAUDE.md 추상화 제한 1번). **그 이상
 * 일반화하지 않는다** — 자리를 임의로 늘릴 수 있는 모양으로 만들면 계약이 열거한 둘
 * (`cover` · `portrait`) 밖의 자리가 있는 것처럼 보인다.
 *
 * **발급 → PUT → 확정을 이 컴포넌트가 나누어 부르지 않는다.** `uploadDraftImage` 하나가
 * 셋을 묶어 두었고(#112), 그것이 *"확정되지 않은 키를 원고에 적지 않는다"* (§13-65)를
 * 구조로 지키는 방식이다. 여기서는 걸음마다 화면 상태만 옮긴다.
 *
 * **미리보기는 로컬에서 만든다.** 응답에 이미지 주소가 없고(I-8) 버킷이 비공개라 볼 수 있는
 * URL 이 존재하지 않는다 — 키 앞에 오리진을 붙이는 코드는 반드시 깨진 그림을 그린다. 그래서
 * `URL.createObjectURL` 로 그리고, **원고를 다시 열었을 때는 그림 없이** 자리를 그린다
 * (`slotBody` 의 주석).
 */
export interface ImageSlotFieldProps {
  draftId: string
  /** 자리. **키(경로)는 서버가 정한다** — 여기서 보내는 것은 자리와 형식뿐이다 (§13-65) */
  slot: ImageSlot
  label: string
  /** 라벨 옆의 부연. 3d 는 여기에 **누구에게 보이는 값인지**를 적었다 */
  hint?: string
  /** 자리 아래 한 줄. 문장이 자리마다 다르므로 부르는 쪽이 준다 (`DraftField` 와 같다) */
  note?: string
  /** 원고에 이미 적혀 있는 값. **확정을 통과한 키다** — 아닌 키는 거기 적히지 않는다 */
  objectKey: string | null
  /** 확정이 끝난 뒤에만 키가, 제거하면 `null` 이 나간다 */
  onChange: (objectKey: string | null) => void
  /**
   * 진행 중인 동안 단계를 넘기지 못하게 하는 신호와, 그것을 구분하는 이름.
   *
   * 자리가 여럿이라(커버 하나 · 인물마다 하나) 마법사가 **어느 자리가 진행 중인지**를 알아야
   * 한다. 넘어가 버리면 확정이 끝나기 전의 원고가 저장되고 이 컴포넌트는 언마운트되면서
   * 업로드를 중단시킨다 — 사용자는 올렸다고 믿은 이미지가 없는 채로 다음 화면을 본다.
   */
  busyKey: string
  onBusyChange: (key: string, busy: boolean) => void
}

/** 방금 고른 파일 — **화면에만 있는 값이다.** 서버는 이 URL 도 이 크기도 모른다. */
interface Picked {
  readonly url: string
  readonly bytes: number
}

export function ImageSlotField({
  draftId,
  slot,
  label,
  hint,
  note,
  objectKey,
  onChange,
  busyKey,
  onBusyChange,
}: ImageSlotFieldProps) {
  const [state, setState] = useState<ImageUploadState>(() => savedImage(objectKey))
  const [picked, setPicked] = useState<Picked | null>(null)
  /*
   * 우리가 마지막으로 아는 원고의 값. **밖에서 바뀐 것과 우리가 바꾼 것을 가른다.**
   *
   * 인물의 순서가 바뀌거나 하나가 지워지면 같은 자리에 **다른 사람의 키**가 온다 — 그때도
   * 방금 올린 미리보기를 계속 그리면 화면은 남의 초상을 이 사람의 것으로 보여 준다.
   */
  const [known, setKnown] = useState(objectKey)

  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  /*
   * 거두어야 할 미리보기 URL. **ref 로 든다** — StrictMode 는 마운트 효과를 두 번 돌리므로
   * `useEffect(..., [picked])` 의 정리로 거두면 개발 모드에서 살아 있는 URL 이 즉시 취소되고
   * 그림이 깨진다. 만드는 자리와 거두는 자리를 `replacePreview` 하나로 모은다.
   */
  const previewRef = useRef<string | null>(null)

  function replacePreview(next: Picked | null): void {
    if (previewRef.current !== null) URL.revokeObjectURL(previewRef.current)
    previewRef.current = next === null ? null : next.url
    setPicked(next)
  }

  // 화면에서 사라지면 올리던 것을 멈추고 미리보기를 거둔다 — 둘 다 남기면 새는 자원이다.
  useEffect(
    () => () => {
      abortRef.current?.abort()
      if (previewRef.current !== null) URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
    },
    [],
  )

  const busy = isBusy(state)
  useEffect(() => {
    onBusyChange(busyKey, busy)
  }, [busy, busyKey, onBusyChange])
  useEffect(() => () => onBusyChange(busyKey, false), [busyKey, onBusyChange])

  /*
   * 밖에서 값이 바뀌었다 (인물 순서 · 삭제 · 원고 재로딩). 진행 중이 아니면 원고를 따른다 —
   * 우리가 방금 확정한 값은 `known` 에 함께 적어 두므로 여기 걸리지 않는다.
   */
  useEffect(() => {
    if (objectKey === known || busy) return
    setKnown(objectKey)
    setState(savedImage(objectKey))
    if (previewRef.current !== null) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
    setPicked(null)
  }, [objectKey, known, busy])

  async function start(file: File): Promise<void> {
    /*
     * **발급을 부르기 전에 형식을 본다** (§13-65). `accept` 도 이 검사도 방어가 아니다 —
     * 서명이 형식을 걸고 확정이 바이트를 확인한다. 여기서 거르는 이유는 하나다: 거르지
     * 않으면 서버가 거절할 형식으로 발급을 부르고, 사용자는 무엇을 잘못 골랐는지 모른 채
     * `400` 을 본다.
     */
    const contentType = requestableContentType(file.type)
    if (contentType === null) {
      // 서버가 아무 말도 하지 않은 자리다. `failureMessageOf` 의 **한 문장**을 쓴다 (F-4) —
      // 문구를 여기서 지으면 실패를 말하는 곳이 둘이 된다.
      replacePreview(null)
      setState(failed(null))
      return
    }

    replacePreview({ url: URL.createObjectURL(file), bytes: file.size })

    const controller = new AbortController()
    abortRef.current = controller
    try {
      const committed = await uploadDraftImage(draftId, slot, contentType, file, {
        // 상한은 **발급 응답이 준 값**이다. 코드에 5 MiB 를 적으면 서버가 바꾸는 날 갈라진다
        onIssued: (issued) => setState(uploading(issued)),
        onStored: () => setState(committing()),
        signal: controller.signal,
      })
      const next = uploaded(committed)
      setState(next)
      /*
       * **여기서만 원고에 적힌다.** 확정 응답으로만 만들어지는 상태이므로, 확정을 건너뛴
       * 키가 이 줄에 닿는 경로가 없다 (§13-65 · `objectKeyOf`).
       */
      const key = objectKeyOf(next)
      setKnown(key)
      onChange(key)
    } catch (error) {
      // 취소는 실패가 아니다 — 사용자가 그만두었거나 화면이 사라진 것이고, 그것을 "실패" 로
      // 그리면 사용자가 하지 않은 일이 화면에 남는다.
      if (controller.signal.aborted) return
      // **"올라갔다" 로 그리지 않는다.** 확정이 `400` 이면 서버가 그 객체를 이미 지웠다.
      replacePreview(null)
      setState(failed(error))
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  function act(action: SlotAction): void {
    if (action === 'cancel') {
      abortRef.current?.abort()
      abortRef.current = null
      replacePreview(null)
      /*
       * **원고가 든 값으로 되돌아간다** — 비우지 않는다. 교체를 그만둔 것이지 지운 것이
       * 아니므로, `EMPTY` 로 두면 원고에는 그대로 있는 이미지가 화면에서만 사라진다.
       * 처음부터 비어 있었으면 `savedImage(null)` 이 그대로 `EMPTY` 다.
       */
      setState(savedImage(objectKey))
      return
    }
    if (action === 'remove') {
      /*
       * 저장소의 객체를 지우지 않는다 — **계약에 그 길이 없다.** 원고가 그 키를 가리키지
       * 않게 될 뿐이고, 버려진 객체를 정리하는 것은 서버의 몫이다.
       */
      replacePreview(null)
      setState(EMPTY)
      setKnown(null)
      onChange(null)
      return
    }
    // pick · repick · replace — **셋이 같은 일이다.** 고르면 발급부터 다시 한다.
    fileRef.current?.click()
  }

  const body = slotBody(state, picked !== null)
  const size = sizeNote(state, picked?.bytes ?? null)

  return (
    <div className={css.field}>
      <div className={css.fieldHead}>
        <span className={css.fieldLabel}>
          {label}
          {hint === undefined ? null : <span className={css.fieldHint}>{` · ${hint}`}</span>}
        </span>
        {/* 계약이 둘 다 `null` 을 허락한다 — 없어도 원고가 성립한다 */}
        <span className={css.fieldMeta}>선택 사항</span>
      </div>

      <div className={css.imageRow}>
        <div className={slotClass(slot, state)}>
          {/*
           * **미리보기는 방금 고른 파일에서만 나온다.** 이 `src` 에 객체 키가 오는 경로는
           * 없다 (I-8). `alt` 가 비어 있는 것은 장식이어서가 아니라, 바로 아래·옆의 글이
           * 같은 것을 말하기 때문이다 — 읽어 주면 같은 말을 두 번 듣는다.
           */}
          {body.image && picked !== null ? (
            <img className={css.imagePreview} src={picked.url} alt="" />
          ) : null}
          {body.note ? (
            <span className={body.image ? `${css.imageSlotNote} ${css.overNote}` : css.imageSlotNote}>
              {statusNote(state)}
            </span>
          ) : null}
          {/*
           * **퍼센트를 그리지 않는다.** `fetch` 는 업로드 진행률을 알려 주지 않으므로
           * (`putToStorage`), 62% 같은 숫자를 그리면 그것은 화면이 지어낸 값이다. 아트보드의
           * 진행 막대는 남기되 **정해지지 않은 진행**으로 둔다 — 대신 아래 줄이 서버가 준
           * 상한에 대고 이 파일의 크기를 말한다.
           */}
          {state.status === 'uploading' ? (
            <span className={css.uploadBar} aria-hidden="true">
              <i />
            </span>
          ) : null}
        </div>

        <div className={css.imageControls}>
          <div className={css.imageActions}>
            {actionsFor(state).map((action) => (
              <button
                key={action}
                type="button"
                className={css.button}
                onClick={() => act(action)}
              >
                {ACTION_LABEL[action]}
              </button>
            ))}
          </div>
          {/*
           * 서버가 준 문구 그대로다 (F-4). 자리 안의 글과 같은 문장이므로 여기서는
           * `role="alert"` 만 두어 **읽어 주게** 한다 — 실패는 조용히 지나가면 안 된다.
           */}
          {state.status === 'failed' ? (
            <p className={css.srOnly} role="alert">
              {statusNote(state)}
            </p>
          ) : null}
          {/* 형식도 크기도 상한도 **서버가 준 값**이다 — 모르는 값은 말하지 않는다 */}
          {size === null ? null : <p className={css.fieldNote}>{size}</p>}
          {state.status === 'empty' ? (
            <p className={css.fieldNote}>{acceptNote(FILE_ACCEPT)}</p>
          ) : null}
          {note === undefined ? null : <p className={css.fieldNote}>{note}</p>}
        </div>
      </div>

      {/*
       * **파일을 고른 뒤에 발급을 부른다** — 서명된 주소는 짧게 만료되므로(`expiresAt`)
       * 화면을 열 때 미리 받아 두면 고르는 사이에 만료된다.
       *
       * 값을 비우는 것은 **같은 파일을 다시 고를 수 있게** 하기 위해서다. 실패한 뒤 같은
       * 파일을 다시 고르는 것이 사용자가 가장 먼저 하는 일이고, 비우지 않으면 `change` 가
       * 일어나지 않아 아무 일도 없는 것처럼 보인다.
       */}
      <input
        ref={fileRef}
        type="file"
        accept={FILE_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file !== undefined) void start(file)
        }}
      />
    </div>
  )
}

/** 커버 160 · 초상 96 (아트보드). **비율은 토큰이 정하고 높이를 px 로 박지 않는다** (F-9). */
function slotClass(slot: ImageSlot, state: ImageUploadState): string {
  const width = slot === 'cover' ? ` ${css.cover}` : ''
  if (state.status === 'failed') return `${css.imageSlot}${width} ${css.slotFailed}`
  if (state.status === 'empty') return `${css.imageSlot}${width}`
  return `${css.imageSlot}${width} ${css.slotFilled}`
}
