import { useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError } from '../../api/client'
import { loginWithOAuth, type TokenResponse } from '../../api/endpoints/auth'
import { ROUTES } from '../../routes/routes'
import shared from './account.module.css'
import {
  canSubmitConsent,
  CONSENT_ITEMS,
  EMPTY_BIRTH_DATE,
  NO_CONSENTS,
  setAllConsents,
  toBirthDate,
  toConsentItems,
  type BirthDateFields,
  type ConsentChecks,
} from './consent'
import styles from './LoginScreen.module.css'

/**
 * 최초 로그인의 추가 정보 — 생년월일 · 약관 동의 4종 (와이어프레임 5a · 6b).
 *
 * **라우트가 아니다.** `LoginScreen` 의 오른쪽 컬럼 안에서 교체된다 — 페이지를 나누면
 * 새로고침에 `idToken` 이 사라진다 (F-3). 그래서 `idToken` 은 prop 으로만 흐르고 어떤
 * 저장소에도 닿지 않는다.
 *
 * **닉네임 칸이 없다.** `OAuthLoginRequest` 는 `idToken` · `birthDate` · `consents` 셋뿐이고,
 * 닉네임은 표시용(`authorDisplayName`)으로만 존재해 사용자가 설정하는 경로가 계약에 없다.
 */
export function ConsentScreen({
  idToken,
  onSignedIn,
}: {
  idToken: string
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
          consents: toConsentItems(checks),
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
              checked={CONSENT_ITEMS.every((item) => checks[item.type])}
              disabled={submitting}
              onChange={(event) => setChecks(setAllConsents(event.target.checked))}
            />
            약관 전체 동의
          </label>
          {CONSENT_ITEMS.map((item) => (
            <label key={item.type} className={styles.consent}>
              <input
                type="checkbox"
                checked={checks[item.type]}
                disabled={submitting}
                onChange={(event) => setChecks({ ...checks, [item.type]: event.target.checked })}
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <button
          type="submit"
          className={`${shared.button} ${shared.primary} ${shared.tall} ${shared.wide}`}
          disabled={submitting || !canSubmitConsent(fields, checks)}
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
