import { useState } from 'react'
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

  /** 토큰이 도착하는 유일한 자리. 메모리에만 둔다 — 저장소에 쓰지 않는다 (F-3). */
  function enter(tokens: TokenResponse): void {
    setAccessToken(tokens.accessToken)
    navigate(ROUTES.library, { replace: true })
  }

  async function signIn(): Promise<void> {
    setSubmitting(true)
    setFailure(null)
    let idToken: string
    try {
      idToken = await requestGoogleIdToken(new AbortController().signal)
    } catch (error) {
      setFailure(error)
      setSubmitting(false)
      return
    }

    try {
      // 기존 회원은 `idToken` 만 보낸다. 매번 동의를 다시 받으면 동의 이력이 로그인 이력이 된다.
      enter(await loginWithOAuth({ idToken }))
    } catch (error) {
      // 최초 로그인이면 서버가 "가입 정보가 더 필요하다"고 답한다 — 실패가 아니라 다음 단계다.
      // **`idToken` 은 서버가 되돌려 주지 않는다.** 방금 받은 값을 그대로 들고 간다 (F-3 —
      // 어디에도 저장하지 않으므로 이 컴포넌트가 살아 있는 동안만 존재한다).
      if (error instanceof ApiError && error.errorCode === 'CONSENT_REQUIRED') {
        setStep({ kind: 'consent', idToken })
        return
      }
      setFailure(error)
    } finally {
      setSubmitting(false)
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
