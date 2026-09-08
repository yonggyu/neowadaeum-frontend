import { useEffect, useState } from 'react'

import { restoreSession, type AuthState } from './session'

/**
 * 부팅 복원을 한 번 돌리고 그 결과를 준다.
 *
 * 상태 전이를 컴포넌트에 두지 않는 이유는 그것이 훅의 몫이기 때문이다 — `App` 은 세 상태를
 * **그리기만** 한다.
 *
 * StrictMode 는 이 이펙트를 두 번 돌린다. 첫 번째는 정리되면서 요청이 끊기고, 끊긴 결과가
 * 나중에 도착해 두 번째 결과를 덮는 일이 없도록 `settled` 로 막는다 — `abort` 만으로는
 * 부족하다. `restoreSession` 은 끊긴 요청도 `unreachable` 로 **정상 반환**하기 때문이다.
 */
export function useAuthSession(): AuthState {
  const [state, setState] = useState<AuthState>({ kind: 'restoring' })

  useEffect(() => {
    const controller = new AbortController()
    let settled = false

    void restoreSession(controller.signal).then((next) => {
      if (!settled) {
        setState(next)
      }
    })

    return () => {
      settled = true
      controller.abort()
    }
  }, [])

  return state
}
