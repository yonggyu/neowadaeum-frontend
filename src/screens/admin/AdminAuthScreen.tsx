import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  clearAdminStepUp,
  confirmAdminTotp,
  enrollAdminTotp,
  hasAdminStepUp,
  verifyAdminTotp,
  type TotpEnrollment,
} from '../../api/endpoints/admin'
import { ROUTES } from '../../routes/routes'
import { encodeQrSymbol, qrPathData } from './qrCode'
import { canSubmitCode, CODE_LENGTH, failureMessage, groupSecret, normalizeCode } from './twoFactor'
import styles from './admin.module.css'

/**
 * 관리자 2FA — 등록과 검증, 한 화면 세 상태.
 *
 * 8차 와이어프레임 `AdminGate`(1440, 등록) · `AdminGateMobile`(390, 검증)이 그렸다. 톤은
 * `1j` 가 정한 감성 없는 Dev Tool 그대로다 — 일러스트도 브랜드도 환영 문구도 두지 않는다.
 *
 * **세 상태를 라우트로 나누지 않는다.** 검증(기본) · 등록 · 승격 보유가 한 화면 안에서
 * 바뀐다. 나누면 등록 화면의 주소가 생기고, 그 주소는 *이 관리자가 등록했는가*를 URL 로
 * 답하는 자리가 된다 — 계약이 그 물음에 답하지 않기로 한 이유가 그대로 무너진다.
 *
 * **폭에 맞춰 벌리지 않는다.** 입력이 여섯 자리 하나뿐이라 **네 폭 전부** 420px 단일 컬럼을
 * 중앙에 둔다 (F-9) — 8차의 1440 아트보드가 좌우를 대놓고 비워 그 사실을 그림으로 말한다.
 * Admin 이 Desktop 기준 폭이라는 것은 한 폭만 맞춘다는 뜻이 아니다.
 */
export function AdminAuthScreen() {
  const [promoted, setPromoted] = useState(hasAdminStepUp)

  if (promoted) {
    return (
      <Console>
        <div className={styles.stack}>
          <p className={styles.body}>단계 승격을 들고 있어요.</p>
          {/* 목적지가 생겼다 (#62). 문 안에서 나가는 길이 보이지 않으면 URL 을 손으로 쳐야 한다 */}
          <Link className={`${styles.button} ${styles.primary}`} to={ROUTES.adminReviews}>
            검수 큐 열기
          </Link>
          {/*
           * 새로고침하면 사라진다 — 승격은 메모리에만 있다. 그 사실을 화면이 숨기지 않는다.
           * 값 자체도, 남은 시간도 보여 주지 않는다: 화면에 나오는 순간 스크린샷 ·
           * 화면 공유 · 버그 리포트에 함께 실린다.
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
        </div>
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
        <EnrollmentSecret secret={enrollment.secret} otpauthUri={enrollment.otpauthUri} />
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
        {/* 8차 `AdminGateMobile` — 화면이 대신 골라 주지 않는다는 것을 말로도 적는다 */}
        <p className={styles.hint}>아직 등록하지 않았다면 여기서 시작해요.</p>
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
 * 한 번만 나오는 비밀 — QR 과, 손으로 옮겨 적을 값.
 *
 * **이 값은 이 컴포넌트가 살아 있는 동안만 존재한다.** 부모의 상태로만 들고 있으므로 화면을
 * 떠나면 함께 사라진다 — 로그 · 스토리지 · URL · 오류 리포트 어느 쪽으로도 나가지 않는 것이
 * 이 이슈의 본체다 (F-3, 보안 hard-stop).
 *
 * **`otpauthUri` 를 문자열로 내지 않는다.** 그것은 같은 비밀을 화면에 한 번 더 싣는 일이고,
 * 사람이 읽을 것도 아니다. 쓸모는 QR 하나이므로 QR 로만 나간다.
 */
function EnrollmentSecret({ secret, otpauthUri }: { secret: string; otpauthUri: string }) {
  return (
    <>
      <QrPanel otpauthUri={otpauthUri} />
      <div className={styles.secret}>
        <p className={styles.label}>인증기에 입력할 값</p>
        {/*
         * 자동 선택 · 복사 버튼을 두지 않는다 — 클립보드는 이 값이 가는 또 하나의 자리이고,
         * 그 자리는 화면을 떠난 뒤에도 남는다. 대신 네 자씩 끊어 옮겨 적을 수 있게 한다.
         */}
        <code className={styles.secretValue}>
          {groupSecret(secret).map((group, index) => (
            <span key={`${String(index)}:${group}`}>{group}</span>
          ))}
        </code>
        <p className={styles.body}>지금 화면을 벗어나면 다시 볼 수 없어요.</p>
      </div>
    </>
  )
}

/**
 * QR — **이 화면이 직접 그린다.**
 *
 * 외부 QR 이미지 서비스에 `otpauthUri` 를 넘기는 순간 **공유 시크릿이 제3자에게 간다.**
 * 인코딩은 `qrCode.ts` 가 브라우저 안에서 하고, 여기서는 그 격자를 `<path>` 하나로 그린다 —
 * 값이 이 오리진을 벗어나는 길이 없다.
 *
 * **흑백을 테마에 맡기지 않는다.** 토큰 색을 쓰면 다크 테마에서 명암이 뒤집히고, 반전된
 * 심볼을 읽지 못하는 리더가 있다. 이 사각형만 언제나 검정 위 흰색이다.
 *
 * 그릴 수 없으면 **칸을 통째로 비운다** (8차가 그 경우를 정했다). 자리만 남겨 두면 QR 이
 * 나오다 만 것처럼 보이고, 아래의 값으로 등록할 수 있다는 사실이 가려진다.
 */
function QrPanel({ otpauthUri }: { otpauthUri: string }) {
  const symbol = useMemo(() => encodeQrSymbol(otpauthUri), [otpauthUri])

  if (symbol === null) {
    return null
  }

  return (
    <div className={styles.qr}>
      {/*
       * `aria-label` 에 URI 를 넣지 않는다 — 보조 기술이 읽어 주는 것이 곧 시크릿을 소리로
       * 내보내는 일이고, 그 문자열은 접근성 트리에도 남는다.
       */}
      <svg
        className={styles.qrSymbol}
        viewBox={`0 0 ${String(symbol.size)} ${String(symbol.size)}`}
        role="img"
        aria-label="인증기로 읽을 QR"
        shapeRendering="crispEdges"
      >
        <rect width={symbol.size} height={symbol.size} fill="#ffffff" />
        <path d={qrPathData(symbol)} fill="#000000" />
      </svg>
      <p className={styles.hint}>인증기로 이 QR 을 읽거나, 아래 값을 직접 입력해요.</p>
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
