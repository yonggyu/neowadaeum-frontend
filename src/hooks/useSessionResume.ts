import { useEffect, useState } from 'react'

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

export function useSessionResume(sessionId: string): SessionResume {
  const [state, setState] = useState<SessionResume>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
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

    return () => controller.abort()
  }, [sessionId])

  return state
}
