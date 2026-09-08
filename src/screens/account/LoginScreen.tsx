import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ApiError, setAccessToken } from '../../api/client'
import { loginWithOAuth, type TokenResponse } from '../../api/endpoints/auth'
import { ROUTES } from '../../routes/routes'
import shared from './account.module.css'
import { ConsentScreen } from './ConsentScreen'
import { requestGoogleIdToken } from './googleIdToken'
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

export function LoginScreen() {
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

  /** 토큰이 도착하는 유일한 자리. 메모리에만 둔다 — 저장소에 쓰지 않는다 (F-3). */
  function enter(tokens: TokenResponse): void {
    setAccessToken(tokens.accessToken)
    navigate(ROUTES.library, { replace: true })
  }

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

    try {
      // 기존 회원은 `idToken` 만 보낸다. 매번 동의를 다시 받으면 동의 이력이 로그인 이력이 된다.
      // **같은 신호를 넘긴다** — 넘기지 않으면 떠난 뒤 도착한 응답이 `enter()` 를 지나
      // `navigate` 로 사용자를 라이브러리까지 끌고 간다 (#182).
      enter(await loginWithOAuth({ idToken }, controller.signal))
    } catch (error) {
      if (controller.signal.aborted) return
      // 최초 로그인이면 서버가 "가입 정보가 더 필요하다"고 답한다 — 실패가 아니라 다음 단계다.
      // **`idToken` 은 서버가 되돌려 주지 않는다.** 방금 받은 값을 그대로 들고 간다 (F-3 —
      // 어디에도 저장하지 않으므로 이 컴포넌트가 살아 있는 동안만 존재한다).
      if (error instanceof ApiError && error.errorCode === 'CONSENT_REQUIRED') {
        setStep({ kind: 'consent', idToken })
        return
      }
      setFailure(error)
    } finally {
      if (!controller.signal.aborted) setSubmitting(false)
    }
  }

  return (
    <main className={styles.shell} data-screen="LoginScreen">
      {/* 대표 작품 장면(랜딩 HERO 재사용). 이미지 경로는 랜딩 계약이 주므로 지금은 폴백만 그린다 */}
      <div className={styles.visual} aria-hidden="true" />
      <div className={styles.panel}>
        {step.kind === 'consent' ? (
          <ConsentScreen idToken={step.idToken} onSignedIn={enter} />
        ) : (
          <SignIn onSignIn={() => void signIn()} submitting={submitting} failure={failure} />
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
 */
function SignIn({
  onSignIn,
  submitting,
  failure,
}: {
  onSignIn: () => void
  submitting: boolean
  failure: unknown
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
          <p className={`${shared.meta} ${styles.stacked}`} role="alert">
            로그인에 실패했어요 · 다시 시도
            {failure instanceof Error ? ` (${failure.message})` : null}
          </p>
        ) : null}
      </div>
    </div>
  )
}
