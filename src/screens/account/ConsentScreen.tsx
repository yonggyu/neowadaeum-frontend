import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError } from '../../api/client'
import { getConsentTerms, loginWithOAuth, type TokenResponse } from '../../api/endpoints/auth'
import { ROUTES } from '../../routes/routes'
import shared from './account.module.css'
import {
  canSubmitConsent,
  consentOptions,
  EMPTY_BIRTH_DATE,
  NO_CONSENTS,
  setAllConsents,
  toBirthDate,
  toConsentItems,
  type BirthDateFields,
  type ConsentChecks,
  type ConsentOption,
} from './consent'
import styles from './LoginScreen.module.css'

/**
 * 최초 로그인의 추가 정보 — 생년월일 · 약관 동의 (와이어프레임 5a · 6b).
 *
 * **라우트가 아니다.** `LoginScreen` 의 오른쪽 컬럼 안에서 교체된다 — 페이지를 나누면
 * 새로고침에 `idToken` 이 사라진다 (F-3). 그래서 `idToken` 은 prop 으로만 흐르고 어떤
 * 저장소에도 닿지 않는다.
 *
 * **닉네임 칸이 없다.** `OAuthLoginRequest` 는 `idToken` · `birthDate` · `consents` 셋뿐이고,
 * 닉네임은 표시용(`authorDisplayName`)으로만 존재해 사용자가 설정하는 경로가 계약에 없다.
 *
 * **"만 15세 이상입니다" 체크박스도 없다.** 와이어프레임 3b · 5a 가 그것을 그리지만 정정본
 * §13-24 가 `age` 를 사용자가 체크하는 항목이 아니라고 정했다 — 서버가 생년월일로 판정한
 * 사실을 스스로 기록한다 (R10.2). 여기 두면 증빙이 되지 않으면서 동의 이력만 두 줄이 된다.
 * **연령 게이트의 입력면은 아래 생년월일 세 칸이다.**
 *
 * **약관 판본을 상수로 들지 않는다** (backend #261). 이 단계는 `GET /consents` 를 먼저 읽고,
 * 읽은 뒤에야 폼을 그린다 — 판본 없이 동의를 보내는 경로를 아예 만들지 않기 위해서다.
 */
export function ConsentScreen({
  idToken,
  onSignedIn,
}: {
  idToken: string
  onSignedIn: (tokens: TokenResponse) => void
}) {
  const terms = useConsentTerms()

  if (terms.status === 'loading') {
    return <LoadingTerms />
  }
  if (terms.status === 'failed') {
    return <TermsUnavailable message={terms.error.message} onRetry={terms.reload} />
  }
  return <ConsentForm idToken={idToken} options={terms.options} onSignedIn={onSignedIn} />
}

/**
 * 약관 목록의 세 상태.
 *
 * `options` 와 `error` 를 각각 nullable 로 두지 않는다 — 그러면 "다 읽었는데 둘 다 비어
 * 있는" 네 번째 상태가 생기고, 그 상태에서 폼이 그려지면 **판본 없는 동의**가 나간다.
 */
type TermsState =
  | { status: 'loading' }
  | { status: 'ready'; options: ConsentOption[]; reload: () => void }
  | { status: 'failed'; error: Error; reload: () => void }

/**
 * 이 화면 하나가 쓰는 로드다. `useResource` 같은 공용 훅을 새로 만들지 않는다 — 사용처가
 * 하나뿐인 추상화는 CLAUDE.md 가 금지한다.
 */
function useConsentTerms(): TermsState {
  const [state, setState] = useState<{ options: ConsentOption[] | null; error: Error | null }>({
    options: null,
    error: null,
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ options: null, error: null })

    getConsentTerms(controller.signal).then(
      (response) => {
        if (!controller.signal.aborted) {
          setState({ options: consentOptions(response.terms), error: null })
        }
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return
        // 계약 밖의 실패(네트워크 단절 · CORS)도 `message` 를 가진 하나의 모양으로 다룬다.
        setState({
          options: null,
          error: cause instanceof Error ? cause : new Error(String(cause)),
        })
      },
    )

    return () => {
      controller.abort()
    }
  }, [attempt])

  const reload = () => setAttempt((n) => n + 1)

  if (state.error !== null) return { status: 'failed', error: state.error, reload }
  if (state.options !== null) return { status: 'ready', options: state.options, reload }
  return { status: 'loading' }
}

/**
 * 약관을 받아오는 동안 (6b 의 추가 정보 단계 안).
 *
 * 폭에 따라 배치를 바꾸지 않는다 — 같은 420px 단일 컬럼 카드 안에서 본문만 바뀐다. 스켈레톤
 * 대신 한 줄인 것은 **뒤이어 올 폼의 높이를 지금 알 수 없기 때문**이고, 가짜 높이를 그리면
 * 도착한 순간 화면이 튄다.
 */
function LoadingTerms() {
  return (
    <div className={styles.card}>
      <div>
        <h1 className={styles.headline}>거의 다 됐어요</h1>
        <p className={styles.sub} role="status">
          약관을 불러오는 중…
        </p>
      </div>
    </div>
  )
}

/**
 * 약관을 읽지 못했을 때 (backend #279 — `service_config` 에 판본이 들어가기 전까지 이것이
 * `GET /consents` 의 **정상 경로**다).
 *
 * **가입을 완료할 수 없다는 사실을 그대로 말한다.** 옛 상수 · 빈 문자열 · 기본 판본으로
 * 넘어가지 않는다 — 그렇게 하면 아무도 검증하지 않은 판본이 동의 이력에 남고, 화면은
 * *돌아가는 것처럼 보인다.* 이슈 #261 이 고치려던 상태가 그대로 돌아오는 것이다.
 *
 * 제목은 디자인의 것이고 **사유는 서버의 `message` 를 그대로 낸다** (F-4). 프론트가 "설정이
 * 없어서" 같은 원인을 지어 붙이지 않는다 — 500 인지 네트워크 단절인지 여기서는 알 수 없다.
 *
 * 재시도 버튼을 두는 이유: 이 실패는 **클라이언트 배포 없이 해소된다** (서버 설정 투입).
 * 또 `idToken` 은 메모리에만 있으므로(F-3) 새로고침으로 되돌리면 Google 로그인부터 다시
 * 해야 한다 — 같은 화면에서 다시 부르는 것이 사용자가 잃는 것이 가장 적은 길이다.
 */
function TermsUnavailable({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.card} role="alert">
      <div>
        <h1 className={styles.headline}>지금은 가입을 마칠 수 없어요.</h1>
        <p className={styles.sub}>{message}</p>
      </div>
      <div className={styles.footer}>
        <button
          type="button"
          className={`${shared.button} ${shared.primary} ${shared.tall} ${shared.wide}`}
          onClick={onRetry}
        >
          다시 시도
        </button>
        <Link className={`${shared.button} ${shared.wide} ${styles.stacked}`} to={ROUTES.landing}>
          서비스 소개 보기
        </Link>
      </div>
    </div>
  )
}

/** 판본을 손에 쥔 뒤의 폼. `options` 없이는 이 컴포넌트가 그려지지 않는다. */
function ConsentForm({
  idToken,
  options,
  onSignedIn,
}: {
  idToken: string
  options: ConsentOption[]
  onSignedIn: (tokens: TokenResponse) => void
}) {
  const [fields, setFields] = useState<BirthDateFields>(EMPTY_BIRTH_DATE)
  const [checks, setChecks] = useState<ConsentChecks>(NO_CONSENTS)
  const [submitting, setSubmitting] = useState(false)
  const [failure, setFailure] = useState<ApiError | Error | null>(null)

  // 15세 미만은 계정이 만들어지지 않는다 (백엔드 R10.2) — 되돌아갈 곳은 생년월일 입력뿐이다.
  const ageRestricted = failure instanceof ApiError && failure.errorCode === 'AGE_RESTRICTED'

  async function submit(): Promise<void> {
    setSubmitting(true)
    setFailure(null)
    try {
      onSignedIn(
        await loginWithOAuth({
          idToken,
          birthDate: toBirthDate(fields),
          // 판본은 서버가 준 것을 그대로 되돌려 보낸다 (backend #261).
          consents: toConsentItems(options, checks),
        }),
      )
    } catch (error) {
      setFailure(error instanceof Error ? error : new Error(String(error)))
    } finally {
      setSubmitting(false)
    }
  }

  if (ageRestricted) {
    return (
      <AgeRestricted
        message={failure.message}
        onRetry={() => {
          // 입력값을 남기지 않는다 (3b). 되돌아갈 때 이전 값이 남아 있으면 재시도가 아니라
          // 같은 값의 재제출이 되기 쉽다.
          setFields(EMPTY_BIRTH_DATE)
          setFailure(null)
        }}
      />
    )
  }

  return (
    <form
      className={styles.card}
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div>
        <h1 className={styles.headline}>거의 다 됐어요</h1>
        <p className={styles.sub}>이용을 위해 아래 정보가 필요합니다.</p>
      </div>

      <div className={styles.form}>
        <fieldset className={`${styles.field} ${styles.fieldset}`}>
          <legend className={styles.label}>생년월일</legend>
          <div className={styles.birthDate}>
            <BirthDatePart
              label="연도 (YYYY)"
              placeholder="YYYY"
              maxLength={4}
              value={fields.year}
              disabled={submitting}
              onChange={(year) => setFields({ ...fields, year })}
            />
            <BirthDatePart
              label="월 (MM)"
              placeholder="MM"
              maxLength={2}
              value={fields.month}
              disabled={submitting}
              onChange={(month) => setFields({ ...fields, month })}
            />
            <BirthDatePart
              label="일 (DD)"
              placeholder="DD"
              maxLength={2}
              value={fields.day}
              disabled={submitting}
              onChange={(day) => setFields({ ...fields, day })}
            />
          </div>
        </fieldset>

        <div className={styles.consents}>
          <label className={styles.consentAll}>
            <input
              type="checkbox"
              checked={options.every((option) => checks[option.type] === true)}
              disabled={submitting}
              onChange={(event) => setChecks(setAllConsents(options, event.target.checked))}
            />
            약관 전체 동의
          </label>
          {options.map((option) => (
            <div key={option.type} className={styles.consent}>
              <label className={styles.consentLabel}>
                <input
                  type="checkbox"
                  checked={checks[option.type] === true}
                  disabled={submitting}
                  onChange={(event) => setChecks({ ...checks, [option.type]: event.target.checked })}
                />
                {option.label}
              </label>
              {/*
                본문 주소도 서버가 준 것만 쓴다 — 주소를 지어내지 않는다 (S-11). `null` 인
                종류가 있다: AI 고지는 문구를 랜딩이 이미 내보낸다 (§13.10).
                링크를 `<label>` 밖에 두는 이유는 안에 있으면 클릭이 체크박스를 토글하기 때문이다.
              */}
              {option.documentUrl !== null ? (
                <a
                  className={styles.consentLink}
                  href={option.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  보기
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <button
          type="submit"
          className={`${shared.button} ${shared.primary} ${shared.tall} ${shared.wide}`}
          disabled={submitting || !canSubmitConsent(fields, options, checks)}
        >
          {submitting ? '확인 중…' : '시작하기'}
        </button>
        {/* 서버가 준 message 를 그대로 낸다 — 문구를 프론트가 짓지 않는다 (F-4) */}
        {failure !== null ? (
          <p className={`${shared.meta} ${styles.stacked}`} role="alert">
            {failure.message}
          </p>
        ) : null}
      </div>
    </form>
  )
}

function BirthDatePart({
  label,
  placeholder,
  maxLength,
  value,
  disabled,
  onChange,
}: {
  label: string
  placeholder: string
  maxLength: number
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <input
      className={styles.input}
      type="text"
      inputMode="numeric"
      aria-label={label}
      placeholder={placeholder}
      maxLength={maxLength}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
    />
  )
}

/**
 * 15세 미만 거부 (3b — Desktop · Mobile 양쪽 동일).
 *
 * 제목은 디자인의 것이고 **사유는 서버의 `message` 를 그대로 낸다** (F-4). 판정은 서버가
 * KST 기준으로 했으므로 프론트가 나이를 다시 계산해 설명하지 않는다.
 */
function AgeRestricted({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className={styles.card} role="alert">
      <div>
        <h1 className={styles.headline}>만 15세 이상만 이용할 수 있어요.</h1>
        <p className={styles.sub}>{message}</p>
      </div>
      <div className={styles.footer}>
        <button
          type="button"
          className={`${shared.button} ${shared.primary} ${shared.tall} ${shared.wide}`}
          onClick={onRetry}
        >
          생년월일 다시 입력
        </button>
        <Link className={`${shared.button} ${shared.wide} ${styles.stacked}`} to={ROUTES.landing}>
          서비스 소개 보기
        </Link>
      </div>
    </div>
  )
}
