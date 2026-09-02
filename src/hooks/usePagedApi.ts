import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 커서 페이지네이션 하나를 화면 상태로 옮긴다.
 *
 * 계약의 목록 응답 셋(`MySessionsResponse` · `MyStoriesResponse` · `HistoryResponse`)이 **같은
 * 세 필드**를 갖는다 — 그래서 이 훅이 있다. 모양이 비슷해서가 아니라 계약이 같은 규약을
 * 세 곳에 쓰기 때문이다. 실제 사용처는 넷이다(My Stories 세 탭 · History).
 */
export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

export type PagedStatus = 'loading' | 'ready' | 'error'

export interface PagedApi<T> {
  readonly items: readonly T[]
  readonly status: PagedStatus
  /** 첫 쪽이 실패한 이유. 화면이 `errorCode` 로 분기하고 `message` 를 그대로 낸다 (F-4). */
  readonly error: unknown
  readonly hasMore: boolean
  readonly loadingMore: boolean
  loadMore: () => void
  /** 목록을 처음부터 다시 받는다. 세션을 지운 뒤처럼 서버가 진실인 순간에 쓴다. */
  reload: () => void
}

/**
 * @param fetchPage 커서 한 쪽을 받아 오는 함수. **`signal` 을 반드시 넘긴다** — 탭을 빠르게
 *   바꾸면 늦게 도착한 응답이 화면을 덮어쓴다.
 * @param key 이 값이 바뀌면 목록을 버리고 처음부터 받는다 (탭 · 세션 id).
 */
export function usePagedApi<T>(
  fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<CursorPage<T>>,
  key: string,
): PagedApi<T> {
  const [items, setItems] = useState<T[]>([])
  const [status, setStatus] = useState<PagedStatus>('loading')
  const [error, setError] = useState<unknown>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [generation, setGeneration] = useState(0)

  // 매 렌더 새 함수가 오더라도 effect 를 다시 돌리지 않는다 — 호출자가 useCallback 을
  // 기억해야 하는 훅은 잘못 쓰이기 쉽다. 최신 함수를 ref 에 담고 `key` 로만 다시 받는다.
  const latestFetch = useRef(fetchPage)
  latestFetch.current = fetchPage

  useEffect(() => {
    const controller = new AbortController()
    setItems([])
    setStatus('loading')
    setError(null)
    setCursor(null)
    setHasMore(false)

    latestFetch
      .current(null, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return
        setItems(page.items)
        setCursor(page.nextCursor)
        setHasMore(page.hasMore)
        setStatus('ready')
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause)
        setStatus('error')
      })

    return () => controller.abort()
  }, [key, generation])

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    latestFetch
      .current(cursor, new AbortController().signal)
      .then((page) => {
        setItems((previous) => [...previous, ...page.items])
        setCursor(page.nextCursor)
        setHasMore(page.hasMore)
      })
      .catch((cause: unknown) => {
        // 다음 쪽이 실패해도 이미 읽은 것을 지우지 않는다. 오류만 알리고 다시 누를 수 있게 둔다.
        setError(cause)
      })
      .finally(() => setLoadingMore(false))
  }, [cursor, hasMore, loadingMore])

  const reload = useCallback(() => setGeneration((value) => value + 1), [])

  return { items, status, error, hasMore, loadingMore, loadMore, reload }
}
