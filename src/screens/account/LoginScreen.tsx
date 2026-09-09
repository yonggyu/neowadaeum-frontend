import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError } from '../../api/client'
import { loginWithOAuth, type TokenResponse } from '../../api/endpoints/auth'
import { ROUTES } from '../../routes/routes'
import shared from './account.module.css'
import { ConsentScreen } from './ConsentScreen'
import { mountGoogleSignInButton, requestGoogleIdToken } from './googleIdToken'
import styles from './LoginScreen.module.css'

/**
 * 로그인 · 가입 (와이어프레임 5a · 6b).
 *
 * **수단은 Google 하나뿐이다.** 이메일·비밀번호도, Apple 도, 닉네임 칸도 만들지 않는다 —
 * 계약의 `provider` enum 이 `[google]` 뿐이고 `/auth/email/*` 는 명시적으로 제외됐다 (§13-11).
 * 입력 필드가 없으므로 **실패 상태도 하나**다.
 *
 * 추가 정보(생년월일 · 약관)는 **별 라우트가 아니라 이 화면의 단계**다. 페이지를 나누면
 * 새로고침에 `idToken` 이 사라진다 — 토큰을 메모리에만 두기 때문이다 (F-3).
 */
type Step = { kind: 'signIn' } | { kind: 'consent'; idToken: string }

export function LoginScreen({
  onSignedIn,
}: {
  /**
   * 로그인 성공을 앱의 인증 상태로 들이는 길 (#217).
   *
   * **화면이 직접 `setAccessToken` 을 부르지 않는 이유가 이것이다.** 토큰만 넣으면 가드가
   * 보는 `AuthState` 는 부팅 때의 값 그대로여서, 성공한 로그인이 곧바로 로그인 화면으로
   * 되돌아왔다. 이 prop 이 그 두 자리를 하나의 길로 잇는다.
   */
  onSignedIn: (tokens: TokenResponse) => Promise<void>
}) {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>({ kind: 'signIn' })
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)

  /**
   * 이 화면이 띄운 One Tap 과 그 뒤의 로그인 요청을 함께 걷는 신호 (#182).
   *
   * **`ref` 에 둔다.** 이 레포에는 관례가 둘 있다 — effect 안의 지역 변수(`ConsentScreen` ·
   * `useResource`)와 `ref`(`ImageSlotField` · `usePlaySession`). 앞의 것은 *effect 가 만든
   * 요청*에만 맞고 `signIn()` 은 effect 가 아니라 **이벤트 핸들러**다. 같은 모양이
   * `ImageSlotField.start` 에 이미 있으므로 그것을 따른다.
   *
   * **신호는 하나다.** One Tap 을 걷는 것과 로그인 요청을 끊는 것을 나누지 않는다 — 둘을
   * 무의미하게 만드는 사건이 *화면을 떠났다* 하나이기 때문이다. 나누면 같은 사건에
   * 반응하는 신호가 둘이 되고, 어느 쪽이 무엇을 덮는지 다음 사람이 매번 확인해야 한다.
   */
  const signInRef = useRef<AbortController | null>(null)

  /*
   * 화면에서 사라지면 걷는다.
   *
   * 걷지 않으면 `googleIdToken.ts` 가 갖춰 둔 정리 경로에 아무도 닿지 않는다 — **Google 이
   * 그린 창이 남고**, 거기서 고른 계정의 콜백이 이미 떠난 화면의 `setStep` · `navigate` 로
   * 돌아온다. 감시 타이머가 2분이라 그동안 약속과 리스너가 살아 있다.
   *
   * **단계 전환(`signIn` → `consent`)에서는 걷지 않는다.** 그 전환은 토큰이 이미 도착한
   * 뒤에만 일어나고, 그 시점의 One Tap 은 스스로 끝나 리스너를 거둔 상태다. 걷을 것이 없다.
   */
  useEffect(() => () => signInRef.current?.abort(), [])

  /**
   * 토큰이 도착하는 유일한 자리 (#217).
   *
   * **인증 상태가 선 뒤에 옮긴다.** `onSignedIn` 이 토큰을 메모리에 넣고(F-3 — 저장소에 쓰지
   * 않는다) `GET /me` 로 계정을 확인해 앱의 `AuthState` 를 세운다. 기다리지 않고 `navigate`
   * 하면 가드가 아직 `anonymous` 를 보고 여기로 되돌린다 — 그것이 이 이슈가 본 화면이다.
   *
   * **성공하지 못했을 때 여기서 다시 판정하지 않는다.** `GET /me` 가 답하지 못했으면 그
   * 사실은 `unreachable` 로 상태에 남고, 그것을 화면으로 옮기는 일은 가드 하나가 한다
   * (`RequireAuth`). 여기서 한 번 더 해석하면 같은 상태를 읽는 자리가 둘이 된다.
   *
   * **신호를 받는다** (#182). `onSignedIn` 이 왕복 하나를 더 기다리므로 그동안 사용자가
   * 화면을 떠날 수 있고, 떠난 뒤의 `navigate` 는 사용자를 라이브러리까지 끌고 간다.
   * 인증 상태는 그대로 세운다 — 로그인은 실제로 성립했고, 걷힌 것은 **이 화면의 이동**뿐이다.
   */
  const enter = useCallback(
    async (tokens: TokenResponse, signal?: AbortSignal): Promise<void> => {
      await onSignedIn(tokens)
      if (signal?.aborted === true) return
      navigate(ROUTES.library, { replace: true })
    },
    [onSignedIn, navigate],
  )

  /**
   * 받은 ID 토큰을 계약으로 바꾼다 — **두 진입점이 만나는 자리** (#181).
   *
   * One Tap 이 준 토큰이든 Google 이 그린 버튼이 준 토큰이든 **여기서부터는 같다.** 나누면
   * `CONSENT_REQUIRED` 분기와 `#182` 의 신호 처리가 두 벌이 되고, 한쪽만 고쳐지는 날이 온다.
   *
   * **`useCallback` 인 것은 아래 `GoogleRenderedSignIn` 이 이 값을 effect 의존성으로 들기
   * 때문이다.** 렌더마다 새 함수면 그 effect 가 매번 다시 돌고, **그때마다 서버에 nonce 가
   * 하나씩 생긴다** (S-8).
   */
  const exchange = useCallback(
    async (idToken: string, signal: AbortSignal): Promise<void> => {
      try {
        // 기존 회원은 `idToken` 만 보낸다. 매번 동의를 다시 받으면 동의 이력이 로그인 이력이 된다.
        // **같은 신호를 넘긴다** — 넘기지 않으면 떠난 뒤 도착한 응답이 `enter()` 를 지나
        // `navigate` 로 사용자를 라이브러리까지 끌고 간다 (#182).
        await enter(await loginWithOAuth({ idToken }, signal), signal)
      } catch (error) {
        if (signal.aborted) return
        // 최초 로그인이면 서버가 "가입 정보가 더 필요하다"고 답한다 — 실패가 아니라 다음 단계다.
        // **`idToken` 은 서버가 되돌려 주지 않는다.** 방금 받은 값을 그대로 들고 간다 (F-3 —
        // 어디에도 저장하지 않으므로 이 컴포넌트가 살아 있는 동안만 존재한다).
        if (error instanceof ApiError && error.errorCode === 'CONSENT_REQUIRED') {
          setStep({ kind: 'consent', idToken })
          return
        }
        setFailure(error)
      } finally {
        if (!signal.aborted) setSubmitting(false)
      }
    },
    [enter],
  )

  async function signIn(): Promise<void> {
    setSubmitting(true)
    setFailure(null)
    const controller = new AbortController()
    signInRef.current = controller

    let idToken: string
    try {
      idToken = await requestGoogleIdToken(controller.signal)
    } catch (error) {
      // 걷힌 것은 실패가 아니다 — 사용자가 떠난 것이고, 그것을 "로그인에 실패했어요" 로
      // 그리면 하지 않은 일이 화면에 남는다. 화면도 이미 없다 (`ImageSlotField.start` 와 같다).
      if (controller.signal.aborted) return
      setFailure(error)
      setSubmitting(false)
      return
    }

    await exchange(idToken, controller.signal)
  }

  /**
   * Google 이 그린 버튼이 토큰을 줬다 (#181).
   *
   * **실패 문구를 먼저 지운다.** 그러면 빠져나갈 길이 화면에서 내려가고(`failure` 가 그것을
   * 세우는 조건이다), 다음 실패가 그것을 **새 nonce 로 다시 세운다.** 걷었다 세우는 것이
   * 이 화면의 재시도이며, nonce 하나가 왕복 하나에 묶여 있다는 사실이 그렇게 그려진다.
   *
   * **신호는 화면의 것을 그대로 쓴다** (#182). 이 요청을 무의미하게 만드는 사건은 여전히
   * *화면을 떠났다* 하나이고, 방금 걷힌 버튼의 신호로 보내면 **자기가 보낸 요청을 자기가
   * 끊는다.**
   */
  const signInWithRenderedButton = useCallback(
    (idToken: string): void => {
      setSubmitting(true)
      setFailure(null)
      const controller = new AbortController()
      signInRef.current = controller
      void exchange(idToken, controller.signal)
    },
    [exchange],
  )

  return (
    <main className={styles.shell} data-screen="LoginScreen">
      {/* 대표 작품 장면(랜딩 HERO 재사용). 이미지 경로는 랜딩 계약이 주므로 지금은 폴백만 그린다 */}
      <div className={styles.visual} aria-hidden="true" />
      <div className={styles.panel}>
        {step.kind === 'consent' ? (
          <ConsentScreen idToken={step.idToken} onSignedIn={enter} />
        ) : (
          <SignIn
            onSignIn={() => void signIn()}
            submitting={submitting}
            failure={failure}
            onRenderedIdToken={signInWithRenderedButton}
            onRenderedFailure={setFailure}
          />
        )}
      </div>
    </main>
  )
}

/**
 * Idle / Submitting / Failed — 6b 의 세 상태.
 *
 * 실패 문구가 하나인 것은 **입력이 없기 때문**이다. 무엇이 틀렸는지 나눌 입력면이 없으므로
 * 나누어 알릴 것도 없다. 서버가 준 `message` 가 있으면 그것을 그대로 덧붙인다 (F-4).
 *
 * **실패한 상태에만 넷째 것이 붙는다** (#181) — 빠져나갈 길. 그 자리는 9차 캔버스의
 * `LoginOptionA` 가 정했고, 문구도 거기서 온다.
 */
function SignIn({
  onSignIn,
  submitting,
  failure,
  onRenderedIdToken,
  onRenderedFailure,
}: {
  onSignIn: () => void
  submitting: boolean
  failure: unknown
  onRenderedIdToken: (idToken: string) => void
  onRenderedFailure: (failure: unknown) => void
}) {
  return (
    <div className={styles.card}>
      <div>
        <h1 className={styles.headline}>이어서 읽으려면 로그인이 필요해요.</h1>
        <p className={styles.sub}>진행 중 이야기를 계정에 저장합니다.</p>
      </div>
      <div className={styles.footer}>
        <button
          type="button"
          className={`${shared.button} ${shared.primary} ${shared.tall} ${shared.wide}`}
          onClick={onSignIn}
          disabled={submitting}
        >
          {submitting ? '확인 중…' : 'Google로 계속하기'}
        </button>
        {failure !== null ? (
          <>
            <p className={`${shared.meta} ${styles.stacked}`} role="alert">
              로그인에 실패했어요 · 다시 시도
              {failure instanceof Error ? ` (${failure.message})` : null}
            </p>
            {/* 실패 문구는 그대로 두고 그 **아래에** 다른 길을 놓는다 (#181, `LoginOptionA`) */}
            <GoogleRenderedSignIn onIdToken={onRenderedIdToken} onFailure={onRenderedFailure} />
          </>
        ) : null}
      </div>
    </div>
  )
}

/**
 * 빠져나갈 길 — Google 이 그린 버튼 (#181, 9차 캔버스 `LoginOptionA`).
 *
 * **원인을 말하지 않는다.** 위의 실패 문구는 그대로 두고 그 아래에 *다른 길*만 놓는다.
 * 화면이 아는 것은 "창이 열리지 않았다" 까지이고, 쿨다운인지 차단기인지 알 방법이 없다 —
 * FedCM 전환으로 표시 계열 moment 알림이 사라졌기 때문이다(`googleIdToken.ts`). 그래서
 * 소제목이 원인이 아니라 **조건**을 말한다: *창이 열리지 않으면.*
 *
 * **실패 상태에서만 산다.** 그래서 `failure` 가 지워지면 이 컴포넌트가 통째로 내려가고,
 * 다음 실패가 **새 nonce 로** 다시 세운다. 걷었다 세우는 것이 이 자리의 재시도이며, 코드가
 * 스스로 nonce 를 한 번 더 받는 자리는 없다 (#185).
 *
 * **세우지 못하면 자리를 지운다.** 빈 상자를 남기면 누를 것이 있는 것처럼 보이는데, 그것이
 * 프론트에서 가장 위험한 실패다. 실패 자체는 위의 `role="alert"` 문단이 말한다.
 *
 * **effect 의존성 둘은 렌더마다 새로 만들어지면 안 된다.** 새 함수면 이 effect 가 매번 다시
 * 돌고, 그때마다 서버에 nonce 가 하나씩 생긴다 (S-8). 부모가 `useCallback` 으로 붙들어 두는
 * 이유가 그것이다. (dev 의 `StrictMode` 는 effect 를 한 번 더 돌리지만, 그 첫 번째는 정리에서
 * 곧바로 걷혀 대개 발급 앞의 `signal.aborted` 검사에 걸린다.)
 */
function GoogleRenderedSignIn({
  onIdToken,
  onFailure,
}: {
  onIdToken: (idToken: string) => void
  onFailure: (failure: unknown) => void
}) {
  const parentRef = useRef<HTMLDivElement | null>(null)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const parent = parentRef.current
    const controller = new AbortController()
    if (parent !== null) {
      void mountGoogleSignInButton(parent, controller.signal).then(
        (idToken) => {
          if (!controller.signal.aborted) onIdToken(idToken)
        },
        (error: unknown) => {
          // 걷힌 것은 실패가 아니다 — 이 자리가 화면에서 내려간 것이다 (`signIn()` 과 같다).
          if (controller.signal.aborted) return
          setUnavailable(true)
          onFailure(error)
        },
      )
    }
    // 자리가 사라지면 반드시 걷는다. 이 한 줄이 렌더 버튼 쪽 약속의 **끝나는 길**이다.
    return () => controller.abort()
  }, [onIdToken, onFailure])

  if (unavailable) return null

  return (
    <div className={`${styles.stacked} ${styles.fallback}`}>
      <p className={styles.fallbackLabel}>창이 열리지 않으면</p>
      {/* Google 이 이 안을 그린다 — React 는 이 자리에 자식을 두지 않는다 */}
      <div className={styles.fallbackButton} ref={parentRef} />
    </div>
  )
}
