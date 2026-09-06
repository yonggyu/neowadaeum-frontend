import type { ImageUploadState } from './imageUpload'

/**
 * 대표 이미지 자리가 **무엇을 그리는가** — 7차 와이어프레임 `UploadStates` 의 다섯 칸.
 *
 * `imageUpload.ts` 가 상태를 정하고 여기가 그 상태의 **표시**를 정한다. 둘을 한 파일에 두지
 * 않은 이유는 지키는 것이 다르기 때문이다 — 저쪽은 *"확정되지 않은 키를 원고에 적지 않는다"*
 * (§13-65)를 타입으로 막고, 이쪽은 아트보드가 그린 다섯 칸을 화면이 여섯으로 늘리지 못하게
 * 막는다. 저 파일은 이미 머지됐고(#112) 고치지 않는다.
 *
 * 컴포넌트에서 꺼내 둔 이유는 `precheck.ts` · `imageUpload.ts` 와 같다 — **이 레포의 러너에
 * DOM 이 없다.** 버튼이 언제 몇 개인지는 아트보드가 값으로 적어 둔 것이고(390 — *"세 버튼이
 * 동시에 있는 순간이 없습니다"*), 값으로 적힌 것은 테스트가 지킬 수 있어야 한다.
 */

/**
 * 자리 하나가 내놓는 행동 — **다섯 상태에 걸쳐 다섯 가지뿐이다.**
 *
 * `pick` 과 `repick` 과 `replace` 는 **같은 일**(파일 고르기 → 발급부터 다시)을 하고 이름만
 * 다르다. 셋을 하나로 합치지 않은 것은 아트보드가 세 자리에 다른 말을 적었기 때문이다 —
 * ① *이미지 고르기* · ④ *다시 고르기* · ⑤ *교체*. 라벨을 컴포넌트가 상태로 다시 갈라 쓰면
 * 그 분기가 두 곳(여기와 화면)에 생긴다.
 */
export type SlotAction = 'pick' | 'cancel' | 'repick' | 'replace' | 'remove'

/** 버튼에 적히는 말. 아트보드의 것이며 여기서 짓지 않는다. */
export const ACTION_LABEL: Record<SlotAction, string> = {
  pick: '이미지 고르기',
  cancel: '취소',
  repick: '다시 고르기',
  replace: '교체',
  remove: '제거',
}

/**
 * 이 상태에서 누를 수 있는 것.
 *
 * **`committing` 에는 아무것도 없다.** 취소는 ②에서만 뜻이 있다 (아트보드) — 저장소는 이미
 * 바이트를 받았고 서버가 그것을 확인하는 중이라, 여기서 그만두면 화면은 "취소했다" 고 믿는데
 * 서버 쪽에서는 확정이 끝나 있을 수 있다. 그 둘이 갈라지는 버튼을 두지 않는다.
 *
 * **`uploaded` 에서만 둘이다.** 셋이 동시에 있는 순간이 없다 (390 아트보드) — 올리는 중에는
 * 버튼 자리가 `cancel` 하나로 바뀐다.
 */
export function actionsFor(state: ImageUploadState): readonly SlotAction[] {
  switch (state.status) {
    case 'empty':
      return ['pick']
    case 'uploading':
      return ['cancel']
    case 'committing':
      return []
    case 'failed':
      return ['repick']
    case 'uploaded':
      return ['replace', 'remove']
  }
}

/**
 * 자리 안에 적히는 한 줄.
 *
 * **실패는 서버가 준 문구 그대로다** (F-4). `imageUpload.ts` 의 `failed` 가 이미 `ApiError`
 * 의 `message` 를 그 자리에 담아 두었으므로 여기서는 **옮겨 적기만 한다** — 상태를 보고
 * 다시 문장을 고르면 그때부터 문구를 정하는 곳이 둘이 된다.
 *
 * ⑤ 는 *"올라간 이미지"* 다. **그림을 못 그릴 때 남는 자리다** — 원래는 그것이 ⑤ 의 항상이었다
 * (응답에 이미지 주소가 없어서, I-8). §13-78 이 바이트를 받는 길을 열어 지금은 그림이 오고,
 * 이 한 줄은 **아직 못 받았거나 받지 못한 경우**에 그대로 남는다. 어느 쪽이든 화면이 새로
 * 지어내는 문장은 없다.
 */
export function statusNote(state: ImageUploadState): string {
  switch (state.status) {
    case 'empty':
      return '이미지 고르기'
    case 'uploading':
      return '올리는 중'
    case 'committing':
      return '확인하는 중'
    case 'failed':
      return state.message
    case 'uploaded':
      return '올라간 이미지'
  }
}

/** 자리 안에 무엇이 오는가 — 그림 · 한 줄. 둘 다 오기도 하고 하나만 오기도 한다. */
export interface SlotBody {
  /** 그림을 그린다 — 방금 고른 파일이거나, 서버에서 되받은 바이트다 (`slotImageUrl`) */
  readonly image: boolean
  /** `statusNote` 를 적는다 */
  readonly note: boolean
}

/**
 * 미리보기가 있어도 **그리지 않는 자리가 있다.**
 *
 * **실패(④)에는 그림이 없다.** 확정이 `400` 이면 서버가 그 객체를 지운다 (§13-65) — 우리
 * 브라우저에 남은 파일을 그 자리에 그리면 화면은 *"올라갔다"* 고 말하는 셈이 되고, 그것은
 * 이슈 #88 이 명시적으로 금지한 그림이다. 실패한 자리에는 서버가 준 문구만 있다.
 *
 * **⑤ 인데 그림이 없는 경우가 여전히 정상이다.** 원고를 다시 열면 우리가 가진 것은 객체 키
 * 뿐이고, 키 앞에 오리진을 붙여 URL 을 만들면 반드시 깨진 그림이 나온다 (I-8) — 그 길은 지금도
 * 없다. 달라진 것은 **바이트를 받아 오는 길**이 생겼다는 것뿐이며(§13-78), 아직 받지 못했거나
 * 받지 못하는 동안은 그림 없이 *"올라간 이미지"* 라고만 말한다. 없는 것을 지어내지 않는다.
 *
 * 진행 중(②③)에는 **둘 다** 온다. 방금 고른 파일이 무엇인지 보이면서, 지금 어느 걸음인지도
 * 함께 말해야 한다 — 그림만 두면 올라간 것과 올라가는 중이 같아 보인다.
 */
export function slotBody(state: ImageUploadState, hasPreview: boolean): SlotBody {
  if (state.status === 'failed') {
    return { image: false, note: true }
  }
  const image = hasPreview
  return { image, note: !image || state.status === 'uploading' || state.status === 'committing' }
}

/**
 * 서버에서 되받아 그리고 있는 그림 — **어느 키의 것인지를 함께 든다.**
 *
 * URL 만 들면 그것이 *어느 이미지였는지* 를 아무도 모른다. 그 사실이 왜 필요한지는 아래에 있다.
 */
export interface RestoredImage {
  /** 이 그림이 속한 객체 키. **화면에 적지 않는다** (S-11) — 판정에만 쓴다 */
  readonly key: string
  /** `URL.createObjectURL` 로 만든 자리. 만든 쪽이 거둔다 */
  readonly url: string
}

/**
 * 자리에 그릴 그림의 주소 — 방금 고른 것이 먼저고, 없으면 되받은 것이다.
 *
 * **되받은 그림은 그것이 속한 키가 지금 키일 때만 그린다.** 인물의 순서가 바뀌거나 하나가
 * 지워지면 같은 자리에 **다른 사람의 키**가 오는데, 그때 앞사람의 그림이 한 프레임이라도
 * 남으면 화면은 남의 초상을 이 사람의 것으로 보여 준다. 컴포넌트가 정리 순서로 그것을 막으려
 * 하면 효과가 도는 순서에 기대게 되므로, **키를 대조해서** 구조로 막는다.
 *
 * **방금 고른 것이 이긴다.** 교체하는 중이면 사용자가 지금 보고 싶은 것은 새로 고른 파일이지
 * 서버에 있는 옛 이미지가 아니다.
 *
 * **여기에 객체 키가 `src` 로 나가는 경로는 없다** (I-8). 나가는 것은 둘 다 우리가 만든
 * `blob:` 주소다 — 버킷이 비공개라 키로는 아무것도 열리지 않는다.
 *
 * @param picked 방금 고른 파일의 미리보기 주소
 * @param restored 서버에서 받아 둔 그림
 * @param savedKey 지금 이 자리가 가리키는 확정된 키 (`objectKeyOf`)
 */
export function slotImageUrl(
  picked: string | null,
  restored: RestoredImage | null,
  savedKey: string | null,
): string | null {
  if (picked !== null) return picked
  if (restored === null || savedKey === null) return null
  return restored.key === savedKey ? restored.url : null
}

/**
 * 바이트를 사람이 읽는 크기로. **1024 로 나눈다** — 계약의 `maxBytes` 가 5 MiB(5,242,880)
 * 이고, 1000 으로 나누면 아트보드가 *"5 MB"* 라고 적은 자리에 5.2 가 적힌다.
 *
 * 이 함수는 **표시만** 한다. 상한의 판정은 확정이 하고(§13-65) 그 `400` 에는 서버가 쓴
 * 문구가 실려 온다 — 화면이 먼저 재서 막으면 "얼마까지 되는가" 를 말하는 곳이 둘이 된다.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${String(Math.round(bytes))} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${trim(kb)} KB`
  return `${trim(kb / 1024)} MB`
}

/** 소수점 한 자리. 정수면 소수점을 적지 않는다 — 아트보드의 *"5 MB"* 와 *"1.2 MB"* 가 같은 함수에서 나온다. */
function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}

/**
 * `image/jpeg` → `JPEG`. 아트보드가 형식을 그렇게 적었다.
 *
 * **목록을 여기 적지 않는다.** 받는 값은 계약이 열거한 것(`FILE_ACCEPT`)이며, 이 함수는
 * 그것을 짧게 줄일 뿐이다 — 표를 하나 더 두면 계약이 형식을 늘리는 날 화면만 옛 목록을 안다.
 */
export function formatImageType(contentType: string): string {
  const subtype = contentType.split('/')[1]
  return subtype === undefined || subtype === '' ? contentType : subtype.toUpperCase()
}

/**
 * 자리 아래의 크기 한 줄 — 아트보드의 *"JPEG · 1.2 MB / 5 MB"*.
 *
 * **셋 다 화면이 적은 값이 아니다.** 형식과 크기는 확정 응답(`ImageCommitResponse`)이, 상한은
 * 발급 응답(`ImageUploadResponse.maxBytes`)이 준 것이다. 모르는 값은 **말하지 않는다** —
 * 원고를 다시 열면 형식도 크기도 원고가 들고 있지 않아 `null` 이고(`savedImage`), 그때 이
 * 줄은 통째로 없다. 아는 척하는 대신 없는 채로 둔다.
 *
 * @param pending 올리는 중인 파일의 바이트 수. 고르기 전에는 `null`
 */
export function sizeNote(state: ImageUploadState, pending: number | null): string | null {
  const parts: string[] = []
  if (state.status === 'uploading') {
    if (pending !== null) parts.push(formatBytes(pending))
    parts.push(`/ ${formatBytes(state.maxBytes)}`)
    return parts.join(' ')
  }
  if (state.status === 'uploaded') {
    if (state.contentType !== null) parts.push(formatImageType(state.contentType))
    if (state.sizeBytes !== null) parts.push(formatBytes(state.sizeBytes))
    return parts.length === 0 ? null : parts.join(' · ')
  }
  return null
}

/**
 * 고를 수 있는 형식을 사람이 읽는 줄로 — `JPEG · PNG · WEBP`.
 *
 * **`FILE_ACCEPT` 에서 만든다.** 그 값의 출처는 계약의 `ImageUploadRequest.contentType`
 * 열거이므로(`imageUpload.ts`), 열거가 늘면 이 줄도 함께 는다. 화면이 목록을 적으면
 * 서버가 형식을 바꾸는 날 화면만 옛 목록을 말한다 (#88).
 */
export function acceptNote(accept: string): string {
  return accept
    .split(',')
    .filter((type) => type !== '')
    .map(formatImageType)
    .join(' · ')
}
