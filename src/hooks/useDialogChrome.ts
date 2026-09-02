import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 열려 있는 동안의 공통 처리 — Esc · 초점 가둠 · 배경 스크롤 잠금 · 닫을 때 초점 복귀.
 *
 * **쓰는 곳이 둘이라 만들었다** (Play Menu · 신고). 컴포넌트가 아니라 훅인 이유는 그 둘의
 * 마크업이 서로 다르기 때문이다 — 껍데기를 하나로 만들면 다른 것 둘이 같아 보인다. 확인
 * Modal 공통화(#43)가 나중에 흡수하더라도 흡수되는 것은 **동작이지 마크업이 아니다.**
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
      if (event.key === 'Escape') {
        escape.current()
        return
      }
      if (event.key !== 'Tab' || root === null) {
        return
      }
      // 초점이 시트 밖으로 나가면 **보이지 않는 곳에서 버튼이 눌린다.** 양 끝에서만 감아
      // 돌리고 나머지 이동은 브라우저에 맡긴다.
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (first === undefined || last === undefined) {
        event.preventDefault()
        root.focus()
      } else if (event.shiftKey && (active === first || active === root)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [ref])
}
