/**
 * 검수 상세의 이미지 자리가 **무엇을 그리는가** (9차 캔버스 `Main` · `ReviewDetail768`, 이슈 #153).
 *
 * 컴포넌트에서 꺼내 둔 이유는 `reviewDetail.ts` · `authoring/imageSlotView.ts` 와 같다 —
 * **이 레포의 러너에 DOM 이 없다.** 아트보드가 값으로 적어 둔 것(버튼에 무엇이 적히는가,
 * 어느 상태에 그림이 오는가)은 테스트가 지킬 수 있어야 한다.
 *
 * 이 파일이 지키는 것은 셋이다.
 *
 * 1. **감사가 걸린 문은 사람이 누를 때만 연다** (§13-78/4, `#86` 의 선례). 그래서 첫 상태가
 *    `unopened` 이고, 그 상태에서 나가는 길은 사람의 손 하나뿐이다 — 렌더링이 아니다.
 * 2. **문구는 아트보드의 것이다.** 여기서 짓지 않는다. 실패만 예외이고 그것은 **서버가 준
 *    문장 그대로**다 (F-4).
 * 3. **객체 키가 상태에 남지 않는다** (S-11). 자리에 그리는 주소는 언제나 우리가
 *    `URL.createObjectURL` 로 만든 `blob:` 이며, 키는 부르는 데만 쓰인다 (I-8).
 */

/**
 * 이미지 자리 하나가 지나는 네 상태.
 *
 * `url` 과 `message` 를 따로 두고 둘 다 nullable 로 만들지 않는다 — `useResource` 의
 * `Resource<T>` 와 같은 이유다: 그러면 "열었는데 그림도 문구도 없는" 다섯째 상태가 생기고
 * 화면이 그 경우를 잊는다.
 */
export type ReviewImageState =
  | { readonly status: 'unopened' }
  | { readonly status: 'opening' }
  | { readonly status: 'shown'; readonly url: string }
  | { readonly status: 'failed'; readonly message: string }

/** 아직 아무도 누르지 않았다 — **열람 기록도 아직 없다.** */
export const UNOPENED: ReviewImageState = { status: 'unopened' }

/** 눌렀고 서버가 바이트를 중계하는 중이다. 이 순간 이미 감사 한 줄이다 (§13-78). */
export const OPENING: ReviewImageState = { status: 'opening' }

/**
 * 받은 바이트를 그린다. `url` 은 **`blob:`** 이다 — 객체 키가 아니다 (I-8, S-11).
 *
 * 만든 쪽이 거둔다. 이 함수는 주소를 담기만 한다.
 */
export function shown(url: string): ReviewImageState {
  return { status: 'shown', url }
}

/**
 * 못 받았다. **문구를 여기서 짓지 않는다** (F-4) — 부르는 쪽이 `failureMessage` 로 옮긴
 * 서버의 문장을 그대로 담는다.
 *
 * `404` 와 네트워크 실패를 나누지 않는다. 계약이 *"커버를 올리지 않은 원고가 정상이고 그때
 * `404`"* 라고 적었지만, 그 경우 원고의 키가 `null` 이라 이 자리는 애초에 그려지지 않는다 —
 * 여기 오는 `404` 는 *키가 있는데 객체가 없다* 는 뜻이고, 그것을 화면이 따로 해석해 문장을
 * 지어내면 서버가 하지 않은 말이 된다.
 */
export function failed(message: string): ReviewImageState {
  return { status: 'failed', message }
}

/** 자리에 그릴 그림의 주소. **`shown` 에서만 있다** — 다른 상태에는 그림이 없다. */
export function imageOf(state: ReviewImageState): string | null {
  return state.status === 'shown' ? state.url : null
}

/** 자리 아래에 적는 실패 문구. **`failed` 에서만 있다.** */
export function failureOf(state: ReviewImageState): string | null {
  return state.status === 'failed' ? state.message : null
}

/** 다시 누를 수 없는 동안 — 누를 때마다 요청도 감사도 한 줄씩 는다 (§13-78/4). */
export function isOpening(state: ReviewImageState): boolean {
  return state.status === 'opening'
}

/** 받는 중에 여는 자리에 적히는 말. */
export const OPENING_LABEL = '받는 중…'

/**
 * 여는 자리에 적히는 말.
 *
 * **아트보드의 라벨을 부르는 쪽이 준다** — 커버와 초상이 다른 말을 적었기 때문이다
 * (*커버 보기* · *초상 보기*). 상태로 그 둘을 다시 가르면 분기가 두 곳에 생긴다.
 *
 * 받는 중에는 라벨이 바뀐다. 이 화면이 판정을 보내는 동안 쓰는 *"보내는 중…"* 과 같은
 * 구성이며, 여기서 새 상태를 만든 것이 아니라 **누른 뒤에 무엇이 보이는가**를 적은 것이다 —
 * 서버가 바이트를 중계하는 데 시간이 걸리고(§13-78), 그동안 아무 말도 없으면 검수자는 누른
 * 것이 먹혔는지 알 수 없어 한 번 더 누른다. 그 한 번이 곧 감사 한 줄이다.
 */
export function openLabel(state: ReviewImageState, idle: string): string {
  return isOpening(state) ? OPENING_LABEL : idle
}

/** 커버가 있다는 사실 (아트보드). 그림은 아직 없다 — 누르면 온다. */
export const COVER_PRESENT = '커버가 있어요'

/** 커버를 여는 자리 (아트보드). */
export const OPEN_COVER = '커버 보기'

/** 초상을 여는 자리 (아트보드). 인물 카드 안의 자리 자체가 이 버튼이다. */
export const OPEN_PORTRAIT = '초상 보기'

/**
 * 커버가 없을 때 적는 문장.
 *
 * **덧붙이지 않는다.** 커버를 올리지 않은 원고가 정상이므로(계약 · §13-68) 결함처럼 적을
 * 자리가 아니고, 열 것이 없으므로 여는 자리도 두지 않는다 — **갈 수 없는 곳으로 가는 문을
 * 그리지 않는다** (`B-2` 의 규칙).
 */
export const COVER_ABSENT = '올린 커버가 없어요.'

/**
 * 누르기 전의 안내 — 아트보드가 커버 옆(768 이하에서는 아래)에 적은 두 문장이다.
 *
 * 둘로 나눠 두는 이유는 아트보드가 뒷문장만 굵게 적었기 때문이다. **그 강조가 이 화면의
 * 핵심**이다 — 누르는 것이 공짜가 아니라는 사실을 누르기 전에 말한다 (§13-78/4:
 * `Cache-Control: private, no-store` 라 다시 볼 때마다 기록이 다시 남는다).
 */
export const OPEN_NOTE_LEAD = '누르면 원본을 받아 이 자리에 그립니다.'

/** 위 문장의 뒷부분. 굵게 적는다 (아트보드). */
export const OPEN_NOTE_EMPHASIS = '열람 기록이 남습니다.'
