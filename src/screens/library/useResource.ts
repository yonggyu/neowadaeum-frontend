import { useCallback, useEffect, useState } from 'react'

import { toApiError, type ApiError } from '../../api/client'

/**
 * 한 번 읽어 오는 화면 데이터의 세 상태.
 *
 * `data` 와 `error` 를 따로 두고 둘 다 nullable 로 만들지 않는다 — 그러면 "로딩이 끝났는데
 * 둘 다 비어 있는" 네 번째 상태가 생기고, 화면이 그 경우를 잊는다.
 */
export type Resource<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'failed'; error: ApiError }

export interface ResourceHandle<T> {
  resource: Resource<T>
  reload: () => void
}

/**
 * 탐색의 세 화면이 같은 방식으로 데이터를 읽는다 — Landing · Library · Detail.
 *
 * 사용처가 셋이라 훅으로 뺀다. 화면마다 `useEffect` + 취소 + 재시도를 다시 적으면 그중 하나는
 * 반드시 취소를 빠뜨리고, 그 화면만 언마운트 뒤 상태를 갱신한다.
 *
 * `load` 는 호출자가 `useCallback` 으로 고정한다 — 매 렌더 새 함수를 주면 무한히 다시 부른다.
 */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>): ResourceHandle<T> {
  const [resource, setResource] = useState<Resource<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setResource({ status: 'loading' })

    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResource({ status: 'ready', data })
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return
        setResource({ status: 'failed', error: toApiError(cause) })
      },
    )

    return () => {
      controller.abort()
    }
  }, [load, attempt])

  const reload = useCallback(() => {
    setAttempt((n) => n + 1)
  }, [])

  return { resource, reload }
}
