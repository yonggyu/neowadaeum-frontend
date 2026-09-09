import { useCallback, useEffect, useRef, useState } from 'react'

import type { TokenResponse } from '../api/endpoints/auth'
import { beginSession, endSession, restoreSession, type AuthState } from './session'

/**
 * 이 훅이 내주는 것 — **읽는 값 하나와 쓰는 길 하나**.
 *
 * 읽는 쪽(`state`)의 소비자는 여전히 가드 하나다. 그래서 `#41` 의 판단(Context 로 올리지
 * 않는다)은 그대로 서고, 이 타입이 하는 일은 **쓰는 쪽이 하나 더 있다는 사실을 드러내는
 * 것**이다 (#217).
 */
export type AuthSession = {
  state: AuthState
  /**
   * 로그인이 성공했다 — 그 사실을 여기로 들인다.
   *
   * **`GET /me` 를 기다린다.** 부르는 쪽은 이것이 끝난 뒤에 다음 화면으로 옮긴다 — 기다리지
   * 않고 옮기면 가드가 아직 `anonymous` 를 보고 되돌린다. 그것이 `#217` 이 본 화면이다.
   */
  signIn: (tokens: TokenResponse) => Promise<void>
  /**
   * 로그아웃이 성공했다 — 그 사실을 여기로 들인다 (#231).
   *
   * **서버가 쿠키를 무른 뒤에만 상태가 바뀐다.** 실패는 그대로 던져 부르는 쪽이 서버 문구를
   * 보여 주게 한다 (F-4) — 나가지 못했는데 화면만 익명이 되면 새로고침이 그것을 뒤집는다.
   */
  signOut: (signal?: AbortSignal) => Promise<void>
}

/**
 * 인증 상태를 하나 들고, 그것을 바꾸는 두 사건을 받는다 — **부팅 복원**과 **로그인 성공**.
 *
 * 상태 전이를 컴포넌트에 두지 않는 이유는 그것이 훅의 몫이기 때문이다 — `App` 은 세 상태를
 * **그리기만** 한다.
 *
 * **처음에는 부팅 하나뿐이었고, 그것이 `#217` 이다.** 이 훅이 상태만 돌려주고 갱신 함수를
 * 내주지 않아서, 로그인 화면이 액세스 토큰(모듈 변수)을 넣어도 가드가 보는 값은 부팅 때의
 * `anonymous` 그대로였다. 빠진 것은 추상화가 아니라 **갱신 경로**였다: 소비자가 가드 하나여도
 * *쓰는 쪽*은 둘이다.
 *
 * ## 늦게 도착한 결과가 앞선 사실을 덮지 않는다
 *
 * 두 사건이 같은 자리에 쓰므로 순서를 지켜야 한다. 랜딩은 인증 밖이라 **부팅 복원이 아직
 * 도는 중에 로그인을 마칠 수 있고**, 그때 늦게 온 `restoreSession` 결과가 로그인 결과를
 * 덮으면 방금 로그인한 사람이 익명이 된다. `latest` 가 그 순서를 든다 — 나중에 시작한 쪽이
 * 번호를 올려 앞의 것을 무효로 만든다.
 *
 * StrictMode 는 부팅 이펙트를 두 번 돌린다. 첫 번째는 정리되면서 요청이 끊기고, 끊긴 결과가
 * 나중에 도착해 두 번째 결과를 덮는 일이 없도록 `settled` 로 막는다 — `abort` 만으로는
 * 부족하다. `restoreSession` 은 끊긴 요청도 `unreachable` 로 **정상 반환**하기 때문이다.
 */
export function useAuthSession(): AuthSession {
  const [state, setState] = useState<AuthState>({ kind: 'restoring' })
  const latest = useRef(0)

  useEffect(() => {
    const run = ++latest.current
    const controller = new AbortController()
    let settled = false

    void restoreSession(controller.signal).then((next) => {
      if (!settled && latest.current === run) {
        setState(next)
      }
    })

    return () => {
      settled = true
      controller.abort()
    }
  }, [])

  const signIn = useCallback(async (tokens: TokenResponse): Promise<void> => {
    const run = ++latest.current
    /*
     * 토큰은 들어갔지만 계정은 아직 모른다 — **그 사이는 `restoring` 이다.**
     *
     * 익명으로 두면 `GET /me` 가 오는 동안 가드가 로그인으로 되돌리고, 이 화면은 자기가
     * 만든 왕복 때문에 자기가 튕겨 나간다. `restoring` 은 "아직 모른다" 이고 가드는 그때
     * 판정하지 않는다 (`guard.ts`).
     */
    setState({ kind: 'restoring' })

    const next = await beginSession(tokens)
    if (latest.current === run) {
      setState(next)
    }
  }, [])

  const signOut = useCallback(async (signal?: AbortSignal): Promise<void> => {
    const run = ++latest.current
    // `beginSession` 과 달리 `restoring` 을 세우지 않는다 — 이 화면은 가드 **안**이라
    // 그 사이에 "불러오는 중…" 이 한 번 스치고, 나가는 길이 깜빡이는 것으로 보인다.
    const next = await endSession(signal)
    if (latest.current === run) {
      setState(next)
    }
  }, [])

  return { state, signIn, signOut }
}
