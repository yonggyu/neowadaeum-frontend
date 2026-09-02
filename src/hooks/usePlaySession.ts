import { useCallback, useEffect, useRef, useState } from 'react'

import { advanceTurn, getCurrentTurn, type Turn, type TurnRequest } from '../api/endpoints/play'
import { ApiError } from '../api/client'
import { UNKNOWN_ERROR, currentTurnNo } from '../api/errors'

/**
 * Play 화면의 상태 전이 한 곳.
 *
 * 열 가지 화면 상태가 있지만 **여기서 나누는 것은 다섯이다** — 나머지는 이 다섯의 내용으로
 * 갈린다. Ending 은 `ready` 이고 `turn.isEnding` 이 참인 경우이며, SafetyBlocked·TurnConflict 는
 * `error` 이고 `error.errorCode` 가 그 코드인 경우다. 짧은 본문·긴 본문은 상태가 아니라
 * 같은 `ready` 의 두 모습이고, Resume 진입은 `restoring` 으로 시작한다는 뜻이다.
 * 화면 상태마다 분기를 하나씩 만들면 **같은 것을 두 군데서 다르게 판단하게 된다.**
 */
export type PlayStatus = 'restoring' | 'ready' | 'generating' | 'chapter' | 'error'

interface PlayState {
  status: PlayStatus
  /**
   * 지금 화면에 떠 있는 턴. 첫 복원 전에만 `null` 이다.
   *
   * 오류가 나도 비우지 않는다 — **이미 읽은 본문은 화면에 유지한다** (1e). 실패했다고
   * 읽던 글을 걷어 가면 사용자는 진행이 날아간 것으로 본다.
   */
  turn: Turn | null
  /** 생성 중 상단에 잔상으로 남길 선택 (1e · 2c). */
  selectedChoiceId: string | null
  /** 생성이 시작된 시각. 10초 문구 교체의 기준이다. */
  startedAt: number | null
  error: ApiError | null
}

export interface PlaySession extends PlayState {
  /** 선택지를 제출한다. **`choiceId` 만 보낸다** (F-1). */
  select: (choiceId: string) => void
  /** 같은 선택을 **같은 `Idempotency-Key` 로** 다시 보낸다 (F-7). */
  retry: () => void
  /** 직전 턴을 그대로 다시 그린다. 사용자가 다른 번호를 고른다 (4a). */
  chooseOther: () => void
  /** `GET /current` 로 서버 상태에 맞춘다 (409 · I-6). */
  refresh: () => void
  /** 챕터 인터스티셜을 닫는다. 2.5초 자동 · 탭으로 즉시. */
  skipChapter: () => void
}

/** 재시도가 같은 키를 써야 하므로 제출 하나에 키 하나를 만들어 들고 있는다 (R6.2). */
interface Submission {
  body: TurnRequest
  idempotencyKey: string
}

const INITIAL: PlayState = {
  status: 'restoring',
  turn: null,
  selectedChoiceId: null,
  startedAt: null,
  error: null,
}

export function usePlaySession(sessionId: string): PlaySession {
  const [state, setState] = useState<PlayState>(INITIAL)
  const submission = useRef<Submission | null>(null)
  const inFlight = useRef<AbortController | null>(null)
  /** 409 가 알려준 서버의 턴 번호. 복원이 여기 못 미치면 화면은 아직 낡은 것이다. */
  const conflictAt = useRef<number | null>(null)

  /** 앞선 요청을 접고 새 컨트롤러를 연다. 뒤늦게 도착한 응답이 화면을 되돌리지 못하게 한다. */
  const open = useCallback(() => {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    return controller
  }, [])

  const fail = useCallback((controller: AbortController, thrown: unknown) => {
    if (controller.signal.aborted) {
      return
    }
    // 서버에 닿지도 못하면(네트워크 · CORS · 서버 미기동) 계약 응답 자체가 없다. 그때 쓸
    // 문구는 와이어프레임 2c 의 ERROR 문장이며, 프론트가 원인을 짐작해 적지 않는다 (F-4) —
    // 무엇이 잘못됐는지는 우리도 모른다.
    const cause =
      thrown instanceof ApiError
        ? thrown
        : new ApiError(0, UNKNOWN_ERROR, '이야기를 이어가지 못했어요.', {})
    if (cause.errorCode === 'TURN_CONFLICT') {
      // 이 턴의 선택지는 이제 제출될 수 없다 — 이전 턴의 `choiceId` 는 재사용 불가다 (§13-9).
      submission.current = null
      conflictAt.current = currentTurnNo(cause.details)
    }
    setState((prev) => ({ ...prev, status: 'error', startedAt: null, error: cause }))
  }, [])

  const restore = useCallback(() => {
    const controller = open()
    setState((prev) => ({ ...prev, status: 'restoring', startedAt: null, error: null }))
    getCurrentTurn(sessionId, controller.signal)
      .then((turn) => {
        if (controller.signal.aborted) {
          return
        }
        const expected = conflictAt.current
        if (expected !== null && turn.turnNo < expected) {
          // 서버가 알려준 턴에 못 미쳤다. 이대로 그리면 사용자는 최신 화면인 줄 알고 고르고,
          // 같은 409 를 다시 만난다 — 조용히 도는 대신 오류를 그대로 둔다.
          setState((prev) => ({ ...prev, status: 'error' }))
          return
        }
        conflictAt.current = null
        submission.current = null
        setState({
          status: turn.chapterChanged ? 'chapter' : 'ready',
          turn,
          selectedChoiceId: null,
          startedAt: null,
          error: null,
        })
      })
      .catch((cause: unknown) => fail(controller, cause))
  }, [sessionId, open, fail])

  const submit = useCallback(() => {
    const pending = submission.current
    if (pending === null) {
      return
    }
    const controller = open()
    setState((prev) => ({
      ...prev,
      status: 'generating',
      selectedChoiceId: pending.body.choiceId,
      startedAt: Date.now(),
      error: null,
    }))
    advanceTurn(sessionId, pending.body, pending.idempotencyKey, controller.signal)
      .then((turn) => {
        if (controller.signal.aborted) {
          return
        }
        submission.current = null
        setState({
          // 챕터가 바뀌었으면 인터스티셜이 턴 사이에 끼어든다 (R7.3). 본문은 이미 이 안에 있다.
          status: turn.chapterChanged ? 'chapter' : 'ready',
          turn,
          selectedChoiceId: null,
          startedAt: null,
          error: null,
        })
      })
      .catch((cause: unknown) => fail(controller, cause))
  }, [sessionId, open, fail])

  const select = useCallback(
    (choiceId: string) => {
      if (state.status !== 'ready' || state.turn === null) {
        return
      }
      submission.current = {
        // 계약이 받는 것은 이 둘뿐이다. 화면에 보이는 `text` 를 담을 자리가 없다 (F-1).
        body: { choiceId, turnNo: state.turn.turnNo },
        // 선택 하나에 키 하나다. 이 뒤의 "다시 시도"는 **같은 키**를 다시 보내며,
        // 그래서 Provider 가 두 번 불리지 않는다 (F-7 · R6.2).
        idempotencyKey: crypto.randomUUID(),
      }
      submit()
    },
    [state.status, state.turn, submit],
  )

  const chooseOther = useCallback(() => {
    submission.current = null
    setState((prev) => ({ ...prev, status: 'ready', selectedChoiceId: null, error: null }))
  }, [])

  const skipChapter = useCallback(() => {
    setState((prev) => (prev.status === 'chapter' ? { ...prev, status: 'ready' } : prev))
  }, [])

  useEffect(() => {
    restore()
    return () => inFlight.current?.abort()
  }, [restore])

  return { ...state, select, retry: submit, chooseOther, refresh: restore, skipChapter }
}
