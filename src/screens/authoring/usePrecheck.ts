import { useCallback, useEffect, useRef, useState } from 'react'

import type { ApiError } from '../../api/client'
import { precheckDraft, type Finding } from '../../api/endpoints/authoring'
import { toApiError } from '../library/useResource'
import { hasBlocked, mergeFindings, PRECHECK_DEBOUNCE_MS } from './precheck'

/**
 * 입력 중 실시간 검수 (3d · R8.1).
 *
 * **제출 후 일괄 반려가 아니다** (3d). 작성자는 고칠 자리를 그 자리에서 알아야 하고, 그래서
 * 이 훅이 하는 일은 하나다 — 입력이 멈추면 바뀐 필드들을 서버에 물어보고 그 답을 들고 있는 것.
 *
 * **한 번에 모아 보낸다.** `PrecheckRequest.fields` 가 맵이고(`step` 은 없다), 제한이 분당
 * 20회다 (R8.4) — 필드마다 타이머를 따로 두면 세 칸을 고치는 동안 세 번이 나간다.
 */
export interface PrecheckHandle {
  /** 지금 화면이 그려야 하는 것 전부. `blocked` 응답의 것만 들어 있다 (`acceptedFindings`). */
  readonly findings: readonly Finding[]
  /** 검사 중인 필드인가 (3d — *"검사 중에는 필드 우측에 확인 중"*). */
  isChecking: (field: string) => boolean
  /** 하나라도 걸렸는가 — 다음 버튼을 막는 판정 (6a). */
  readonly blocked: boolean
  /** 검수 자체가 실패했을 때의 서버 오류 (429 · 네트워크). 문구는 서버의 것이다 (F-4). */
  readonly error: ApiError | null
  /** 값이 바뀌었다고 알린다. 0.8초 동안 다시 불리지 않으면 검사가 나간다. */
  check: (field: string, value: string) => void
  /** 그 자리가 사라졌거나 다른 값의 자리가 되었다 — 옛 결과를 버린다 (등장인물 순서 변경 · 삭제). */
  forget: (fields: readonly string[]) => void
}

export function usePrecheck(draftId: string, initial: readonly Finding[]): PrecheckHandle {
  const [findings, setFindings] = useState<readonly Finding[]>(initial)
  const [checking, setChecking] = useState<readonly string[]>([])
  const [error, setError] = useState<ApiError | null>(null)

  const pending = useRef(new Map<string, string>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const controller = useRef<AbortController | null>(null)

  // 화면을 떠난 뒤에 검사가 도착하지 않게 한다. 타이머만 지우면 이미 나간 요청이 남는다.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
      controller.current?.abort()
    },
    [],
  )

  const run = useCallback(() => {
    const fields = Object.fromEntries(pending.current)
    pending.current.clear()
    const checked = Object.keys(fields)
    if (checked.length === 0) return

    /*
     * **앞선 요청을 취소한다.** 취소하지 않으면 느린 첫 응답이 빠른 두 번째 응답 뒤에 도착해,
     * 이미 고친 자리의 밑줄을 되살린다 — 사용자에게는 고쳐지지 않는 필드로 보인다.
     */
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setChecking(checked)

    precheckDraft(draftId, { fields }, current.signal).then(
      (response) => {
        if (current.signal.aborted) return
        setFindings((previous) => mergeFindings(previous, checked, response))
        setError(null)
        setChecking([])
      },
      (cause: unknown) => {
        if (current.signal.aborted) return
        /*
         * **옛 findings 를 지우지 않는다.** 검사가 실패했다는 것은 통과했다는 뜻이 아니다 —
         * 지우면 막혀 있던 필드가 조용히 풀리고, 작성자는 다음 단계에서 서버의 거부로
         * 그 사실을 처음 만난다.
         */
        setError(toApiError(cause))
        setChecking([])
      },
    )
  }, [draftId])

  const check = useCallback(
    (field: string, value: string) => {
      pending.current.set(field, value)
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = setTimeout(run, PRECHECK_DEBOUNCE_MS)
    },
    [run],
  )

  const forget = useCallback((fields: readonly string[]) => {
    const dropped = new Set(fields)
    for (const field of dropped) pending.current.delete(field)
    setFindings((previous) => previous.filter((finding) => !dropped.has(finding.field)))
  }, [])

  return {
    findings,
    isChecking: (field: string) => checking.includes(field),
    blocked: hasBlocked(findings),
    error,
    check,
    forget,
  }
}
