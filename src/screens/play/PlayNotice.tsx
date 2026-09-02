import { useEffect, useState } from 'react'

import type { ApiError } from '../../api/client'
import type { Choice } from '../../api/endpoints/play'
import { retryAfterSeconds } from '../../api/errors'
import { LONG_WAIT_MS, loadingMessage } from './generating'
import { recoveryActions, type RecoveryAction } from './recovery'
import s from './play.module.css'

/**
 * 기다리는 동안.
 *
 * 이미 읽은 본문은 지우지 않는다 — 위로 밀어 올릴 뿐이다 (2c). 고른 선택은 잔상으로
 * 남겨 둔다: 25초를 기다리는 사람에게 **무엇을 눌렀는지**가 가장 궁금한 것이다.
 */
export function Generating({ choice, startedAt }: { choice: Choice | null; startedAt: number }) {
  const message = useElapsedMessage(startedAt)

  return (
    <div className={s.notice} aria-live="polite" aria-busy="true">
      {choice === null ? null : (
        <p className={s.selected}>
          <span aria-hidden="true">✓ </span>
          {choice.text}
        </p>
      )}
      <p className={s.noticeMessage}>{message}</p>
      <span className={s.dots} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  )
}

/** 와이어프레임이 정한 버튼 이름. **오류 문구가 아니다** — 문구는 서버 `message` 를 쓴다. */
const LABELS: Readonly<Record<RecoveryAction, string>> = {
  retry: '다시 시도',
  chooseOther: '다른 선택하기',
  refresh: '최신 이야기 불러오기',
  leave: '나중에 이어하기',
}

interface ProblemProps {
  error: ApiError
  /** 저장돼 있는 턴. 진행이 날아가지 않았다는 것을 숫자로 보여 준다 (2c · 3a · 4a). */
  savedTurnNo: number | null
  handlers: Readonly<Record<RecoveryAction, () => void>>
}

/**
 * Error · SafetyBlocked · TurnConflict — **레이아웃은 하나이고 버튼만 다르다** (3a).
 *
 * 셋을 다른 컴포넌트로 나누지 않는다. 나누는 순간 같은 화면 셋이 조금씩 어긋나기 시작하고,
 * 실제로 다른 것은 서버가 준 `message` 와 `recoveryActions` 가 고른 버튼뿐이다.
 */
export function PlayProblem({ error, savedTurnNo, handlers }: ProblemProps) {
  const actions = recoveryActions(error.errorCode, error.details)
  const lockedFor = useCountdown(retryAfterSeconds(error.details))

  return (
    <div className={s.notice} role="alert">
      {/*
       * 서버 `message` 를 그대로 쓴다 (F-4). 세이프티 차단이어도 여기에 사유를 덧붙이지
       * 않는다 (F-5) — 무엇이 걸렸는지 알려주면 우회하는 법을 알려주는 것이 된다.
       */}
      <p className={s.noticeMessage}>{error.message}</p>
      {savedTurnNo === null ? null : (
        <p className={s.saved}>Turn {savedTurnNo}까지 저장되어 있습니다.</p>
      )}
      <div className={s.actions}>
        {actions.map((action) => {
          const locked = action === 'retry' && lockedFor > 0
          return (
            <button
              key={action}
              type="button"
              className={s.action}
              disabled={locked}
              onClick={handlers[action]}
            >
              {locked ? `${LABELS.retry} (${lockedFor}초)` : LABELS[action]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function useElapsedMessage(startedAt: number): string {
  const [message, setMessage] = useState(() => loadingMessage(Date.now() - startedAt))

  useEffect(() => {
    const remaining = LONG_WAIT_MS - (Date.now() - startedAt)
    setMessage(loadingMessage(Date.now() - startedAt))
    if (remaining <= 0) {
      return
    }
    // 초 단위로 다시 그리지 않는다. 바뀌는 시점이 하나뿐이므로 타이머도 하나면 된다.
    const timer = setTimeout(() => setMessage(loadingMessage(LONG_WAIT_MS)), remaining)
    return () => clearTimeout(timer)
  }, [startedAt])

  return message
}

/**
 * 재시도가 잠기는 시간.
 *
 * **서버가 준 `retryAfterSeconds` 로만 시작한다** — 값이 없으면 잠그지 않는다. 여기에
 * 기본값을 두면 서버가 아무 말도 하지 않았는데 화면이 기다리라고 말하게 된다.
 */
function useCountdown(seconds: number | null): number {
  const [left, setLeft] = useState(seconds ?? 0)

  useEffect(() => {
    setLeft(seconds ?? 0)
    if (seconds === null || seconds <= 0) {
      return
    }
    const timer = setInterval(() => {
      setLeft((remaining) => {
        if (remaining <= 1) {
          clearInterval(timer)
          return 0
        }
        return remaining - 1
      })
    }, 1_000)
    return () => clearInterval(timer)
  }, [seconds])

  return left
}
