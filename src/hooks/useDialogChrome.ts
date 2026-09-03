import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 초점이 판 안의 **어디**에 있는가.
 *
 * 감아 돌릴지는 양 끝인지 여부로만 정해진다 — 가운데 어느 칸인지는 브라우저가 알아서 옮긴다.
 * `none` 은 누를 것이 하나도 없는 판이고, `only` 는 누를 것이 **하나뿐**이라 그 하나가 첫이자
 * 마지막인 경우다. `only` 를 `first` 와 합치면 그 판에서 Tab 이 그대로 밖으로 나간다.
 */
export type FocusSpot = 'none' | 'only' | 'root' | 'first' | 'last' | 'middle'

/**
 * 키 하나에 대한 판정.
 *
 * `hold` 는 판 밖으로 나가지 못하게 붙들어 두는 것이고, `pass` 는 브라우저에 맡기는 것이다.
 */
export type DialogKeyAction = 'close' | 'focus-first' | 'focus-last' | 'hold' | 'pass'

/**
 * 초점 가둠과 Esc 의 **판정만** 떼어 둔다.
 *
 * 아래 훅은 이 판정에 DOM 을 붙이는 일만 한다. 나누어 둔 이유는 확인 다이얼로그(#43·#63)가
 * 되돌릴 수 없는 동작 앞에 서면서 이 판정이 **테스트가 지켜야 하는 것**이 됐는데, 이 레포의
 * 테스트 러너에 DOM 이 없기 때문이다. 판정에만 분기가 있고 나머지(`focus()` · `overflow`)는
 * 한 줄짜리 부작용이라, 이 선이 그 둘을 가르는 자리와 같다.
 */
export function dialogKeyAction(
  key: string,
  shiftKey: boolean,
  spot: FocusSpot,
): DialogKeyAction {
  if (key === 'Escape') {
    return 'close'
  }
  if (key !== 'Tab') {
    return 'pass'
  }
  // 초점이 판 밖으로 나가면 **보이지 않는 곳에서 버튼이 눌린다.** 양 끝에서만 감아 돌리고
  // 나머지 이동은 브라우저에 맡긴다.
  if (spot === 'none') {
    return 'hold'
  }
  if (spot === 'only') {
    // 어느 쪽으로 돌아도 같은 하나로 돌아온다. 그래도 막아 두어야 밖으로 나가지 않는다.
    return shiftKey ? 'focus-last' : 'focus-first'
  }
  if (shiftKey && (spot === 'first' || spot === 'root')) {
    return 'focus-last'
  }
  if (!shiftKey && spot === 'last') {
    return 'focus-first'
  }
  return 'pass'
}

/**
 * 열려 있는 동안의 공통 처리 — Esc · 초점 가둠 · 배경 스크롤 잠금 · 닫을 때 초점 복귀.
 *
 * **쓰는 곳이 셋이다** (Play Menu · 신고 시트 · 확인 다이얼로그). 컴포넌트가 아니라 훅인 이유는
 * 그 셋의 마크업이 서로 다르기 때문이다 — 껍데기를 하나로 만들면 다른 것 셋이 같아 보인다.
 * 확인 다이얼로그 공통화(#43·#63)가 흡수한 것도 **동작이지 마크업이 아니다**: 신고는 6c 의
 * Mobile 하단 시트이고 확인은 6d 의 Mobile 전체화면이라, 같은 판이 아니다.
 */
export function useDialogChrome(ref: RefObject<HTMLElement | null>, onEscape: () => void): void {
  // 매 렌더 새로 오는 핸들러를 의존성에 그대로 넣으면 렌더마다 리스너를 다시 걸게 된다.
  const escape = useRef(onEscape)
  escape.current = onEscape

  useEffect(() => {
    const opener = document.activeElement
    const restore = document.body.style.overflow
    // 시트 뒤의 화면이 따라 스크롤되지 않게 한다 — 모바일에서 특히 그렇게 보인다.
    document.body.style.overflow = 'hidden'
    ref.current?.focus()

    return () => {
      document.body.style.overflow = restore
      if (opener instanceof HTMLElement) {
        opener.focus()
      }
    }
  }, [ref])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const root = ref.current
      if (event.key !== 'Escape' && root === null) {
        return
      }

      const items = root === null ? [] : Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
      const action = dialogKeyAction(event.key, event.shiftKey, focusSpot(root, items))

      if (action === 'close') {
        escape.current()
        return
      }
      if (action === 'pass' || root === null) {
        return
      }
      event.preventDefault()
      if (action === 'hold') {
        root.focus()
        return
      }
      const target = action === 'focus-first' ? items[0] : items[items.length - 1]
      target?.focus()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [ref])
}

function focusSpot(root: HTMLElement | null, items: readonly HTMLElement[]): FocusSpot {
  const first = items[0]
  const last = items[items.length - 1]
  if (first === undefined || last === undefined) {
    return 'none'
  }
  const active = document.activeElement
  if (active === first) {
    return first === last ? 'only' : 'first'
  }
  if (active === last) {
    return 'last'
  }
  return active === root ? 'root' : 'middle'
}
