import { useCallback, useEffect, useRef, useState } from 'react'

import { getResume, type ResumeResponse } from '../api/endpoints/resume'

/**
 * Resume 요약 한 건.
 *
 * 목록이 아니므로 `usePagedApi` 와 나눈다 — 커서도 "더 보기"도 없는 호출에 그 훅을 끼우면
 * 쓰지 않는 상태가 넷 따라온다.
 */
export type SessionResume =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: unknown }
  | { readonly status: 'ready'; readonly resume: ResumeResponse }

/**
 * 상태와 **다시 부르는 길** (#142).
 *
 * 상태 하나만 돌려주던 것을 손잡이로 바꾼다. `#122` 가 닿지 못한 실패에서 나가는 문을 걷어 낸
 * 뒤 이 화면에는 **할 수 있는 일이 하나도 남지 않았고**, 그 자리에 맞는 것은 문이 아니라
 * *다시 부르기*다 — 그런데 훅이 그 길을 내주지 않아 화면이 줄 수가 없었다.
 *
 * `PreviewHandle` 과 같은 모양이다. 상태 유니온에 함수를 섞지 않는 이유는 `loading` ·
 * `error` · `ready` 어느 갈래든 **다시 부를 수 있다는 사실은 같기** 때문이다.
 */
export interface ResumeHandle {
  readonly state: SessionResume
  /**
   * 같은 `GET` 을 한 번 더 부른다.
   *
   * **다시 부르는 것이 무엇도 만들지 않는다** — `getResume` 은 조회 하나이고 세션을 새로
   * 여는 경로가 아니다. 그래서 이 자리는 열어도 되는 재시도다 (§13-26).
   */
  reload: () => void
}

export function useSessionResume(sessionId: string): ResumeHandle {
  const [state, setState] = useState<SessionResume>({ status: 'loading' })
  const inFlight = useRef<AbortController | null>(null)

  /**
   * 부르기 한 번. 첫 진입과 [다시 시도]가 **같은 이것**을 부른다.
   *
   * 앞선 요청을 먼저 접는다 (`usePlaySession` 의 `open` 과 같은 이유) — 실패한 뒤 두 번
   * 눌리면 요청이 둘 떠 있게 되고, 뒤늦게 도착한 앞의 응답이 화면을 되돌린다.
   */
  const load = useCallback(() => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    setState({ status: 'loading' })

    getResume(sessionId, controller.signal)
      .then((resume) => {
        if (controller.signal.aborted) return
        setState({ status: 'ready', resume })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', error })
      })
  }, [sessionId])

  useEffect(() => {
    load()
    return () => inFlight.current?.abort()
  }, [load])

  return { state, reload: load }
}
