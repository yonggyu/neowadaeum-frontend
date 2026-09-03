import { useRef, useState } from 'react'

import {
  clearAdminStepUp,
  confirmAdminTotp,
  enrollAdminTotp,
  hasAdminStepUp,
  verifyAdminTotp,
  type TotpEnrollment,
} from '../../api/endpoints/admin'
import { canSubmitCode, CODE_LENGTH, failureMessage, normalizeCode } from './twoFactor'
import styles from './admin.module.css'

/**
 * 관리자 2FA — 등록과 검증, 한 화면 두 단계.
 *
 * **디자인이 없다.** 와이어프레임은 관리자 화면 둘(`3h` 검수·신고 큐 · `1j` Debug 콘솔)만
 * 그렸고 그 앞의 문은 그리지 않았다. 그래서 화면을 지어내지 않고 `1j` 가 정한 톤(감성 없는
 * Dev Tool)만 따라 골격까지 만든다.
 *
 * **폭에 맞춰 벌리지 않는다.** 입력이 여섯 자리 하나뿐이라 어느 폭에서도 420px 단일 컬럼을
 * 중앙에 둔다 — CLAUDE.md 가 이 경우를 직접 다룬다. Admin 은 F-9 의 예외이지만 그것은
 * *Desktop 전용으로 만들어도 된다*는 뜻이지 *한 폭만 맞춰도 된다*는 뜻이 아니며, `1j` 자신이
 * 1024 이하를 규정했다.
 */
export function AdminAuthScreen() {
  const [promoted, setPromoted] = useState(hasAdminStepUp)

  if (promoted) {
    return (
      <Console>
        <p className={styles.body}>단계 승격을 들고 있어요. 관리자 화면을 열 수 있어요.</p>
        {/*
         * 새로고침하면 사라진다 — 승격은 메모리에만 있다. 그 사실을 화면이 숨기지 않는다.
         * 값 자체도, 남은 시간도 보여 주지 않는다: 화면에 나오는 순간 스크린샷 · 화면 공유 ·
         * 버그 리포트에 함께 실린다.
         */}
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            clearAdminStepUp()
            setPromoted(false)
          }}
        >
          승격 해제
        </button>
      </Console>
    )
  }

  return <Gate onPromoted={() => setPromoted(true)} />
}

/**
 * 아직 승격이 없을 때의 두 갈래.
 *
 * **어느 쪽인지 화면이 고르지 않는다.** 이 관리자가 이미 등록했는지 묻는 경로가 계약에 없고,
 * 만들어 주지도 않는다 — 등록 여부는 그 자체로 단서다 (S-6). 그래서 검증을 기본으로 두고
 * 등록은 사람이 직접 고른다.
 */
function Gate({ onPromoted }: { onPromoted: () => void }) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function startEnrollment() {
    setEnrolling(true)
    setFailure(null)
    try {
      setEnrollment(await enrollAdminTotp())
    } catch (error) {
      setFailure(failureMessage(error))
    } finally {
      setEnrolling(false)
    }
  }

  if (enrollment !== null) {
    return (
      <Console>
        <EnrollmentSecret secret={enrollment.secret} />
        <CodeForm
          label="인증기가 보여 주는 여섯 자리"
          submitLabel="등록 확정"
          submit={confirmAdminTotp}
          // 확정은 곧바로 승격을 준다 — 계약이 명시했다. 방금 코드를 맞힌 사람에게 다시
          // 묻는 것은 아무것도 더 확인하지 못한다. 그래서 검증 단계로 되돌리지 않는다.
          onDone={() => {
            setEnrollment(null)
            onPromoted()
          }}
        />
        <button type="button" className={styles.button} onClick={() => setEnrollment(null)}>
          그만두기
        </button>
      </Console>
    )
  }

  return (
    <Console>
      <CodeForm
        label="인증기가 보여 주는 여섯 자리"
        submitLabel="확인"
        submit={verifyAdminTotp}
        onDone={onPromoted}
      />
      <div className={styles.aside}>
        <button
          type="button"
          className={styles.button}
          disabled={enrolling}
          onClick={() => void startEnrollment()}
        >
          {enrolling ? '여는 중…' : '인증기 등록'}
        </button>
        {failure !== null ? (
          <p className={styles.failure} role="alert">
            {failure}
          </p>
        ) : null}
      </div>
    </Console>
  )
}

/**
 * 여섯 자리를 받아 한 번 보낸다. 등록 확정과 검증이 같은 모양이다.
 *
 * **자동 재시도가 없다.** 실패하면 입력을 비우고, 방금 보낸 코드는 다시 보낼 수 없게 막는다
 * (`canSubmitCode`). 코드는 한 스텝 동안 같으므로 재시도 버튼이 같은 값을 다시 보내면
 * 화면이 재사용을 대신 해 주는 꼴이 된다.
 *
 * **실패 문구를 짓지 않는다.** 서버가 준 문장을 그대로 낸다 (F-4) — 계약이 실패를 `403`
 * 하나로 합친 이유를 화면이 되돌리지 않기 위해서다 (S-6).
 */
function CodeForm({
  label,
  submitLabel,
  submit,
  onDone,
}: {
  label: string
  submitLabel: string
  submit: (code: string) => Promise<void>
  onDone: () => void
}) {
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const lastSubmitted = useRef<string | null>(null)

  const submittable = canSubmitCode(code, { lastSubmitted: lastSubmitted.current, pending })

  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (!submittable) {
      return
    }
    lastSubmitted.current = code
    setPending(true)
    setFailure(null)
    try {
      await submit(code)
      setCode('')
      onDone()
    } catch (error) {
      setFailure(failureMessage(error))
      // 입력을 비운다. 남겨 두면 사람이 같은 값을 한 번 더 누르려 하고, 그 시도는 어차피
      // 통하지 않는다 — 새 코드를 인증기에서 다시 읽어야 한다.
      setCode('')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void send(event)}>
      <label className={styles.label} htmlFor="admin-totp-code">
        {label}
      </label>
      <input
        id="admin-totp-code"
        className={styles.code}
        value={code}
        onChange={(event) => setCode(normalizeCode(event.target.value))}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        // 브라우저와 확장이 값을 들고 있지 않게 한다. 여섯 자리 자체는 한 스텝짜리지만,
        // 저장된 값이 자동으로 다시 채워지면 재사용 시도가 기본 동작이 된다.
        spellCheck={false}
        autoCorrect="off"
        aria-describedby={failure !== null ? 'admin-totp-failure' : undefined}
      />
      <button
        type="submit"
        className={`${styles.button} ${styles.primary}`}
        disabled={!submittable}
      >
        {pending ? '확인 중…' : submitLabel}
      </button>
      {failure !== null ? (
        <p id="admin-totp-failure" className={styles.failure} role="alert">
          {failure}
        </p>
      ) : null}
    </form>
  )
}

/**
 * 한 번만 나오는 비밀.
 *
 * **이 값은 이 컴포넌트가 살아 있는 동안만 존재한다.** 부모의 상태로만 들고 있으므로 화면을
 * 떠나면 함께 사라진다 — 로그 · 스토리지 · URL · 오류 리포트 어느 쪽으로도 나가지 않는 것이
 * 이 이슈의 본체다. `otpauthUri` 는 그리지 않는다: 쓸모가 QR 하나인데 그릴 수단이 없고,
 * 문자열로 내면 같은 비밀이 화면에 한 번 더 실릴 뿐이다.
 */
function EnrollmentSecret({ secret }: { secret: string }) {
  return (
    <div className={styles.secret}>
      <p className={styles.label}>인증기에 입력할 값</p>
      {/* 자동 선택 · 복사 버튼을 두지 않는다 — 클립보드는 이 값이 가는 또 하나의 자리다 */}
      <code className={styles.secretValue}>{secret}</code>
      <p className={styles.body}>지금 화면을 벗어나면 다시 볼 수 없어요.</p>
    </div>
  )
}

/**
 * 관리자 크롬. `1j` 가 정한 톤을 따른다 — 감성 없는 Dev Tool.
 *
 * 공통 셸(`AppShell`)을 붙이지 않는다: 상단 내비와 하단 탭바가 가리키는 곳이 전부 라이브러리
 * 쪽이고, 그것이 관리자 문 안에 있을 이유가 없다.
 */
function Console({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.page} data-screen="AdminAuthScreen">
      <div className={styles.column}>
        <h1 className={styles.title}>ADMIN / 2FA</h1>
        {children}
      </div>
    </main>
  )
}
