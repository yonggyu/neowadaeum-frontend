import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError } from '../../api/client'
import { loginWithOAuth, type TokenResponse } from '../../api/endpoints/auth'
import { ROUTES } from '../../routes/routes'
import shared from './account.module.css'
import { ConsentScreen } from './ConsentScreen'
import { mountGoogleSignInButton, requestGoogleIdToken } from './googleIdToken'
import styles from './LoginScreen.module.css'
import {
  FALLBACK_REVEAL_MS,
  fallbackView,
  nextFallbackStage,
  recoveryHint,
  type FallbackStage,
} from './signInFallback'

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
  /** 빠져나갈 길이 어디까지 와 있는가 (#218). 판정은 `signInFallback.ts` 가 한다. */
  const [fallback, setFallback] = useState<FallbackStage>('hidden')
  /**
   * **GIS 가 아무 말도 하지 않은 채 흐르는 중**인가 (#218).
   *
   * `submitting` 과 나눈다. 저것은 *로그인 왕복 전체*라 우리 서버를 기다리는 동안에도 참인데,
   * 아래 타이머가 재는 것은 **GIS 쪽 침묵**이다 — `NO_RESPONSE_TIMEOUT_MS` 가 재는 것과 같은
   * 시간이며, 그래서 눈금 둘이 같은 시계를 본다. 합치면 로그인 요청이 느린 날에도 *"창이
   * 열리지 않으면"* 이 떠서, 아무 상관 없는 자리에 다른 길을 권하게 된다.
   */
  const [oneTapPending, setOneTapPending] = useState(false)

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

  /*
   * 아무 소식 없이 `FALLBACK_REVEAL_MS` 가 흐르면 **다른 길을 하나 제안한다** (#218).
   *
   * **감시 타이머를 대신하지 않는다.** 실패를 선언하는 자리는 여전히 `googleIdToken.ts` 의
   * 120초이고, 여기서는 아무것도 선언하지 않는다 — 창이 떴는지 코드는 알 수 없으므로 판정을
   * 사람에게 넘길 자리 하나를 세울 뿐이다. 그동안 주 버튼은 `확인 중…` 그대로 둔다:
   * 되살리면 사람이 그것을 다시 눌러 `prompt()` 가 두 번 불린다.
   */
  useEffect(() => {
    if (!oneTapPending) return
    const timer = setTimeout(
      () => setFallback((stage) => nextFallbackStage(stage, { kind: 'reveal' })),
      FALLBACK_REVEAL_MS,
    )
    return () => clearTimeout(timer)
  }, [oneTapPending])

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
    // 시도가 시작되면 자리가 내려간다. 다음에 서는 것은 **새 nonce 로 세운 버튼**이다 (#212).
    setFallback((stage) => nextFallbackStage(stage, { kind: 'attempt' }))
    const controller = new AbortController()
    signInRef.current = controller

    let idToken: string
    try {
      setOneTapPending(true)
      idToken = await requestGoogleIdToken(controller.signal)
    } catch (error) {
      // 걷힌 것은 실패가 아니다 — 사용자가 떠났거나(화면도 이미 없다) 다른 길을 골랐다.
      // 그것을 "로그인에 실패했어요" 로 그리면 하지 않은 일이 화면에 남는다.
      if (controller.signal.aborted) return
      setFailure(error)
      setSubmitting(false)
      return
    } finally {
      // GIS 쪽 침묵이 여기서 끝난다 — 성공이든 실패든 더 잴 것이 없다.
      setOneTapPending(false)
    }

    await exchange(idToken, controller.signal)
  }

  /**
   * 사람이 **창이 열리지 않았다고 답했다** (#218).
   *
   * 코드가 하지 못하는 판정이다 — FedCM 전환으로 표시 계열 moment 알림이 사라져 화면은 창이
   * 떴는지 알 수 없다. 그 판정은 **보고 있는 사람 쪽이 확실하다.**
   *
   * **여기서 One Tap 왕복을 끊는다.** 창을 뺏는 것이 아니라 **사람이 다른 길을 고른 결과**이며,
   * 끊어 두지 않으면 GIS 설정이 둘이 된다 — 렌더 버튼이 `initialize()` 를 한 번 더 부르는데,
   * GIS 는 One Tap 과 렌더 버튼을 함께 써도 그것을 **한 번만** 부르라고 적어 두었다.
   *
   * **실패로 그리지 않는다.** 아무것도 실패하지 않았고 화면이 아는 것도 여전히 없다. 주 버튼은
   * 다시 누를 수 있는 상태로 돌아간다 — 기다리던 왕복이 여기서 끝났으므로 그것을 누르는 것은
   * 두 번째 `prompt()` 가 아니라 **새 시도**다.
   */
  const takeFallback = useCallback((): void => {
    signInRef.current?.abort()
    signInRef.current = null
    setOneTapPending(false)
    setSubmitting(false)
    setFallback((stage) => nextFallbackStage(stage, { kind: 'taken' }))
  }, [])

  /**
   * Google 이 그린 버튼이 토큰을 줬다 (#181).
   *
   * **자리를 먼저 걷는다.** 그리고 다음 실패가 그것을 **새 nonce 로 다시 세운다.** 걷었다
   * 세우는 것이 이 화면의 재시도이며, nonce 하나가 왕복 하나에 묶여 있다는 사실이 그렇게
   * 그려진다. **`#212` 가 물은 것이 이것이다** — 걷지 않으면 만료된 nonce 를 든 버튼이 자리에
   * 남아, 누를 때마다 같은 `401 LOGIN_NONCE_INVALID` 를 되풀이한다.
   *
   * **신호는 화면의 것을 그대로 쓴다** (#182). 이 요청을 무의미하게 만드는 사건은 여전히
   * *화면을 떠났다* 하나이고, 방금 걷힌 버튼의 신호로 보내면 **자기가 보낸 요청을 자기가
   * 끊는다.**
   */
  const signInWithRenderedButton = useCallback(
    (idToken: string): void => {
      setSubmitting(true)
      setFailure(null)
      // 자리를 걷는 것이 `failure` 하나에 매여 있지 않다 (#218 이 조건을 늘렸다). 시도가
      // 시작될 때마다 명시적으로 내린다 — 이 한 줄이 **만료된 nonce 를 든 버튼이 자리에
      // 남는 것**을 막는다 (#212).
      setFallback((stage) => nextFallbackStage(stage, { kind: 'attempt' }))
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
            fallback={fallback}
            onTakeFallback={takeFallback}
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
 * **넷째 것이 붙는 조건이 둘이 됐다** (#218) — 빠져나갈 길은 실패했을 때뿐 아니라 **아무
 * 소식 없이 오래 기다린 뒤**에도 선다. 그 자리와 소제목은 9차 캔버스 `LoginOptionA` 가
 * 정했고, 무엇이 언제 서는지는 `signInFallback.ts` 가 정한다.
 *
 * **두 조건이 한 자리를 쓴다.** 아래 셋은 각자 자리를 지키는 슬롯이라 조건이 바뀌어도 서로의
 * 자리를 밀지 않는다 — 밀면 Google 버튼이 통째로 다시 그려지고 **nonce 가 하나 더 든다**.
 */
function SignIn({
  onSignIn,
  submitting,
  failure,
  fallback,
  onTakeFallback,
  onRenderedIdToken,
  onRenderedFailure,
}: {
  onSignIn: () => void
  submitting: boolean
  failure: unknown
  fallback: FallbackStage
  onTakeFallback: () => void
  onRenderedIdToken: (idToken: string) => void
  onRenderedFailure: (failure: unknown) => void
}) {
  const view = fallbackView(fallback, failure)
  const hint = recoveryHint(failure)

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
          /* 서버 문장과 회복 방법을 **한 번에** 읽어 준다 — 나누면 알림이 둘이 된다 */
          <div className={`${shared.meta} ${styles.stacked} ${styles.notice}`} role="alert">
            <p>
              로그인에 실패했어요 · 다시 시도
              {failure instanceof Error ? ` (${failure.message})` : null}
            </p>
            {/* 서버 문장은 위에 그대로 두고, 그 아래에 **무엇을 누르면 되는가**만 적는다 (#212, F-4) */}
            {hint !== null ? <p>{hint}</p> : null}
          </div>
        ) : null}
        {/* 아직 아무 일도 일어나지 않았다 — 창이 떴는지 아는 사람에게 묻는다 (#218) */}
        {view === 'offer' ? (
          <FallbackBlock>
            <button
              type="button"
              className={`${shared.button} ${shared.wide}`}
              onClick={onTakeFallback}
            >
              다른 방법으로 로그인
            </button>
          </FallbackBlock>
        ) : null}
        {/* 실패 문구는 그대로 두고 그 **아래에** 다른 길을 놓는다 (#181, `LoginOptionA`) */}
        {view === 'button' ? (
          <GoogleRenderedSignIn onIdToken={onRenderedIdToken} onFailure={onRenderedFailure} />
        ) : null}
      </div>
    </div>
  )
}

/**
 * *"창이 열리지 않으면"* 아래의 한 덩어리 (9차 캔버스 `LoginOptionA`).
 *
 * 두 자리가 같은 상자를 쓴다 — **묻는 조건이 같기 때문**이다. 소제목은 원인이 아니라 조건을
 * 말하므로(창이 왜 안 떴는지 화면은 모른다) 아직 아무 일도 없는 자리에도 그대로 선다.
 */
function FallbackBlock({ children }: { children: ReactNode }) {
  return (
    <div className={`${styles.stacked} ${styles.fallback}`}>
      <p className={styles.fallbackLabel}>창이 열리지 않으면</p>
      {children}
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
 * **한 시도 안에서 한 번만 산다.** 시도가 시작되면 이 컴포넌트가 통째로 내려가고(`fallback`
 * 이 `hidden` 으로 돌아간다), 그 시도의 실패가 **새 nonce 로** 다시 세운다. 걷었다 세우는 것이
 * 이 자리의 재시도이며, 코드가 스스로 nonce 를 한 번 더 받는 자리는 없다 (#185).
 * **`#218` 이 서는 시점을 앞당겼지만 이 성질은 그대로다** — 앞당긴 것은 *사람이 요청했을 때*
 * 이고, 그 요청 하나가 여전히 nonce 하나다.
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
    <FallbackBlock>
      {/* Google 이 이 안을 그린다 — React 는 이 자리에 자식을 두지 않는다 */}
      <div className={styles.fallbackButton} ref={parentRef} />
    </FallbackBlock>
  )
}
