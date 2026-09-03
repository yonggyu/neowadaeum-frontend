import { useEffect, useRef, useState } from 'react'

import { toApiError, type ApiError } from '../../api/client'
import { previewDraft } from '../../api/endpoints/authoring'

/**
 * 미리보기 세션 (`previewDraft`, 와이어프레임 3e).
 *
 * **저장되지 않고 My Stories 에도 나타나지 않는다** (3e). 그것을 정하는 것은 서버다 —
 * 세션이 `isTestSession` 으로 열리고(R8.13) 그때 발행되는 작품은 `private` · `draft` 다
 * (정정본 §13-37). 화면이 따로 감출 것이 없고, 그래서 감추는 코드도 두지 않는다.
 *
 * **자동으로 만들지 않는다.** 미리보기는 부를 때마다 **새 작품을 발행하고**(§13-37) 일일
 * 횟수 상한이 걸려 있다 (R8.12). 단계를 오가는 것만으로 그것이 쌓이면 작성자는 자기가 하지도
 * 않은 체험 때문에 막힌다. 3e 의 "다시 체험" 도 같은 함수를 다시 부르는 것이며, 그때
 * **새 세션이 열린다** — 같은 세션을 되감는 경로가 계약에 없다.
 */
export type PreviewState =
  | { kind: 'idle' }
  | { kind: 'creating' }
  | { kind: 'failed'; error: ApiError }
  /** 열린 세션. `turnLimit` 은 **이 세션의 것**이며 상수가 아니다 (정정본 §13-36) */
  | { kind: 'open'; sessionId: string; turnLimit: number }

export interface PreviewHandle {
  readonly state: PreviewState
  start: () => void
}

export function usePreviewSession(draftId: string): PreviewHandle {
  const [state, setState] = useState<PreviewState>({ kind: 'idle' })
  const inFlight = useRef<AbortController | null>(null)

  useEffect(() => () => inFlight.current?.abort(), [])

  function start(): void {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    setState({ kind: 'creating' })
    previewDraft(draftId, controller.signal).then(
      (response) => {
        if (controller.signal.aborted) return
        setState({
          kind: 'open',
          sessionId: response.sessionId,
          turnLimit: response.turnLimit,
        })
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return
        // 문구는 서버의 것이다 (F-4). 429(일일 상한)도 여기로 오며 우리가 다시 쓰지 않는다.
        setState({ kind: 'failed', error: toApiError(cause) })
      },
    )
  }

  return { state, start }
}
