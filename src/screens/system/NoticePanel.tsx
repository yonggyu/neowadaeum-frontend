import type { ReactNode } from 'react'

import css from './system.module.css'

/**
 * 실패 한 판의 **껍데기** — 표시(선택) · 문구 · 그 아래 동작 자리 (8차 B-2 · B-4).
 *
 * 세 자리가 이것을 함께 쓴다: 부팅에서 서버에 닿지 못한 화면(`UnreachableScreen`) · 화면 안의
 * 같은 실패(`UnreachableNotice`, #122) · `sessionId` 없이 열린 Play(#129). 사용처가 셋이라
 * `CLAUDE.md` 의 추상화 조건("실제 사용처가 둘 이상")을 지나서 만든 조각이며, 마크업이 비슷해
 * 합친 것이 아니라 셋이 **같은 일을 한다** — 420 컬럼 하나에 문장 하나와 동작을 세운다.
 *
 * **공유하는 것은 여기까지다.** 동작이 무엇인지(다시 부르기인가 나가는 문인가) · 눌린 뒤
 * 어떻게 되는지(돌아오는가 아닌가)는 부르는 쪽이 든다. 그 둘을 이 안으로 들이면 `pending`
 * 같은 값 하나가 두 가지 뜻을 갖게 되고, 그때부터 어느 화면 이야기인지 매번 물어야 한다 —
 * 신고 시트와 확인 판이 `useDialogChrome` 만 나눠 갖고 형태를 둘로 남긴 것과 같은 선이다.
 *
 * `role="alert"` 다. 셋 다 **사용자가 보려던 것 대신** 나타나는 판이므로 낭독기가 그 자리에서
 * 알려야 한다. `main` 이 아니라 안쪽 덩어리가 갖는다 — `main` 에 얹으면 랜드마크가 사라진다.
 */
export function NoticePanel({
  mark,
  headline,
  headlineTag,
  body,
  children,
}: {
  /** 표시 그림 하나. 디자인이 그린 자리에만 온다 — 없는 화면에 그려 넣지 않는다 */
  mark?: ReactNode
  headline: string
  /**
   * 문구를 어느 요소로 낼 것인가.
   *
   * 화면 전체를 대신하는 자리는 `h1` 이고, 화면 **안**의 한 덩어리는 `p` 다 — 이미 제목이 선
   * 문서에 두 번째 `h1` 을 만들면 낭독기의 목차가 어긋난다. 그래서 `boolean` 이 아니라 낼
   * 요소 자체를 받는다.
   */
  headlineTag: 'h1' | 'p'
  body?: string
  /** 동작 자리 — 버튼이든 링크든 **부르는 쪽이 정한다** */
  children?: ReactNode
}) {
  const Headline = headlineTag

  return (
    <div className={css.column} role="alert">
      {mark}
      <Headline className={css.headline}>{headline}</Headline>
      {body === undefined ? null : <p className={css.body}>{body}</p>}
      {children}
    </div>
  )
}

/**
 * 닿지 못했다는 표시 — 끊긴 구름.
 *
 * 두 자리가 같은 그림을 쓴다(부팅의 전용 화면 · 화면 안의 같은 실패). 같은 사실에 서로 다른
 * 그림을 두면 사용자는 두 번째 것을 새로운 사실로 읽는다.
 */
export function UnreachableMark() {
  return (
    <svg
      className={css.icon}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.5 24h11a5.5 5.5 0 0 0 1.2-10.87A7.5 7.5 0 0 0 8.6 11.4" />
      <path d="M9.5 24a5.5 5.5 0 0 1-1.6-10.77" />
      <path d="M5 5l22 22" />
    </svg>
  )
}
