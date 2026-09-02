import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '../../api/client'

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
        // 계약 밖의 실패(네트워크 단절 · CORS)도 화면은 하나의 모양으로 다뤄야 한다.
        // `ApiError` 가 아닌 것을 그대로 두면 화면이 `message` 를 읽지 못한다.
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

/**
 * 계약 형태가 아닌 실패를 화면이 다룰 수 있는 모양으로 옮긴다.
 *
 * 문구를 지어내지 않는 것이 원칙이지만(F-4), **서버가 아무 말도 하지 않은 실패**가 있다 —
 * 요청이 서버에 닿지도 못한 경우다. 그때만 최소한의 문구를 두고, 코드는 계약의 것을 빌리지
 * 않고 `UNKNOWN` 으로 남긴다.
 */
export function toApiError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause
  return new ApiError(0, 'UNKNOWN', '서버에 연결하지 못했어요.', {})
}
