import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { setAccessToken } from '../../api/client'
import { getConsentTerms } from '../../api/endpoints/auth'
import { withdraw } from '../../api/endpoints/me'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ROUTES } from '../../routes/routes'
import {
  policyLinks,
  WITHDRAW_NOTICE,
  type PolicyLink,
  type WithdrawNoticeLine,
} from './accountSettings'
import shared from './account.module.css'
import styles from './AccountSettingsScreen.module.css'

/**
 * 계정 설정 — 네 줄 (와이어프레임 5b · 6d).
 *
 * **지운 것이 이 화면의 절반이다.** 닉네임 변경 · 알림 설정 · 내 데이터 내려받기 · 진행 기록
 * 전체 삭제, 그리고 상단 사용자 정보 블록(`@handle · 이메일 · Google`)이 5차에서 철거됐다.
 * 마지막 것은 취향이 아니라 **읽을 경로가 없어서**다 — `GET /me` 는 `playerRef` · 이메일 ·
 * 소셜 식별자 · 생년월일을 돌려주지 않는다 (F-6, §13-7). 진행 기록 삭제는 사라진 것이
 * 아니라 **개별 세션 삭제**로 옮겨 갔다 (3g → 1i My Stories 카드).
 *
 * 항목이 넷뿐이라 **Desktop 에서도 2열로 벌리지 않는다** — 420px 단일 컬럼을 중앙에 둔다
 * (6d). 사이드 내비를 만들 만한 분량이 아니고, 폭에 맞춰 늘리면 빈 화면이 된다 (F-9).
 */
export function AccountSettingsScreen() {
  const policies = usePolicies()
  const [confirming, setConfirming] = useState(false)

  return (
    <main className={shared.page} data-screen="AccountSettingsScreen">
      <div className={styles.column}>
        <h1 className={shared.pageTitle}>계정 설정</h1>

        <h2 className={styles.sectionTitle}>약관 · 정책</h2>
        <PolicySection state={policies} />

        <h2 className={styles.sectionTitle}>계정</h2>
        <ul className={styles.rows}>
          <li>
            <button
              type="button"
              className={`${styles.row} ${styles.danger}`}
              onClick={() => setConfirming(true)}
            >
              회원 탈퇴
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        </ul>
      </div>

      {confirming ? <WithdrawDialog onClose={() => setConfirming(false)} /> : null}
    </main>
  )
}

/**
 * 약관 셋의 세 상태.
 *
 * 실패해도 **회원 탈퇴 줄은 그대로 있어야 한다** — 약관 본문을 못 읽는 것과 탈퇴할 수 없는
 * 것은 다른 사실이다. 그래서 이 로드가 화면 전체를 대신하지 않고 이 구역만 대신한다.
 */
type PolicyState =
  | { status: 'loading' }
  | { status: 'ready'; links: PolicyLink[] }
  | { status: 'failed'; message: string; reload: () => void }

/**
 * 이 화면 하나가 쓰는 로드다. 공용 훅을 새로 만들지 않는다 — 사용처가 하나뿐인 추상화는
 * CLAUDE.md 가 금지한다.
 */
function usePolicies(): PolicyState {
  const [state, setState] = useState<{ links: PolicyLink[] | null; error: Error | null }>({
    links: null,
    error: null,
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState({ links: null, error: null })

    getConsentTerms(controller.signal).then(
      (response) => {
        if (!controller.signal.aborted) {
          setState({ links: policyLinks(response.terms), error: null })
        }
      },
      (cause: unknown) => {
        if (!controller.signal.aborted) {
          setState({ links: null, error: cause instanceof Error ? cause : new Error(String(cause)) })
        }
      },
    )

    return () => controller.abort()
  }, [attempt])

  const reload = () => setAttempt((value) => value + 1)
  if (state.error !== null) {
    // 서버가 준 `message` 를 그대로 낸다 — 문구를 프론트가 짓지 않는다 (F-4).
    return { status: 'failed', message: state.error.message, reload }
  }
  if (state.links === null) {
    return { status: 'loading' }
  }
  return { status: 'ready', links: state.links }
}

function PolicySection({ state }: { state: PolicyState }) {
  if (state.status === 'loading') {
    return (
      <p className={shared.meta} role="status" aria-live="polite">
        불러오는 중…
      </p>
    )
  }
  if (state.status === 'failed') {
    return (
      <div role="alert">
        <p className={shared.meta}>{state.message}</p>
        <button type="button" className={shared.button} onClick={state.reload}>
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <ul className={styles.rows}>
      {state.links.map((link) => (
        <li key={link.type}>
          <PolicyRow link={link} />
        </li>
      ))}
    </ul>
  )
}

/**
 * 약관 한 줄.
 *
 * **`documentUrl` 이 `null` 이면 링크를 그리지 않는다.** 주소를 지어내지 않고(S-11), 열리지
 * 않을 링크를 그려 두지도 않는다 — 눌러도 아무 일이 없는 줄은 고장으로 읽힌다. 판본(`v1.2`)
 * 도 적지 않는다: 5b 가 지웠고, 내가 *동의한* 판본을 읽을 경로가 없다.
 */
function PolicyRow({ link }: { link: PolicyLink }) {
  if (link.documentUrl === null) {
    return <span className={`${styles.row} ${styles.rowInert}`}>{link.label}</span>
  }
  return (
    <a className={styles.row} href={link.documentUrl} target="_blank" rel="noreferrer">
      {link.label}
      <span className={styles.chevron} aria-hidden="true">
        ›
      </span>
    </a>
  )
}

/**
 * 탈퇴 확인 (5b · 6d).
 *
 * 판은 `ConfirmDialog` 다 — 되돌릴 수 없는 동작 앞의 확인이 셋이 되면서 하나로 모았다(#63).
 * 이 화면이 들고 있는 것은 **문구와 그 요청** 뿐이다.
 *
 * 성공하면 **토큰을 버리고 랜딩으로 보낸다.** 로그인 화면으로 보내지 않는 이유는 그 계정이
 * 다시 로그인할 수 없기 때문이다 — 열리지 않는 문 앞에 세우지 않는다.
 */
function WithdrawDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()

  return (
    <ConfirmDialog
      title="정말 탈퇴하시겠어요?"
      confirmLabel="탈퇴합니다"
      pendingLabel="처리 중…"
      cancelLabel="돌아가기"
      onCancel={onClose}
      onConfirm={async () => {
        await withdraw()
        // 이 계정의 토큰은 더 쓰지 않는다 (F-3 — 메모리에만 있으므로 지우는 것도 여기 한 줄이다).
        setAccessToken(null)
        void navigate(ROUTES.landing, { replace: true })
      }}
    >
      <ul className={styles.notice}>
        {WITHDRAW_NOTICE.map((line) => (
          <li key={line.before}>
            <NoticeLine line={line} />
          </li>
        ))}
      </ul>
    </ConfirmDialog>
  )
}

/** 굵게 읽히는 자리는 문구가 정한다 — 화면이 어디를 강조할지 새로 정하지 않는다. */
function NoticeLine({ line }: { line: WithdrawNoticeLine }) {
  return (
    <>
      {line.before}
      {line.emphasis === undefined ? null : <strong>{line.emphasis}</strong>}
      {line.after}
    </>
  )
}
