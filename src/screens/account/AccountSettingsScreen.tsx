import { useCallback, useEffect, useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { setAccessToken, toApiError, type ApiError } from '../../api/client'
import { getConsentTerms } from '../../api/endpoints/auth'
import { getMe, updateMe, withdraw, type MeResponse } from '../../api/endpoints/me'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ROUTES } from '../../routes/routes'
import { useResource } from '../library/useResource'
import {
  canSubmitDisplayName,
  displayNameHandle,
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
 * **지운 것이 이 화면의 절반이다.** 알림 설정 · 내 데이터 내려받기 · 진행 기록 전체 삭제,
 * 그리고 상단 사용자 정보 블록(`@handle · 이메일 · Google`)이 5차에서 철거됐다. 마지막 것은
 * 취향이 아니라 **읽을 경로가 없어서**다 — `GET /me` 는 `playerRef` · 이메일 · 소셜 식별자 ·
 * 생년월일을 돌려주지 않는다 (F-6, §13-7). 진행 기록 삭제는 사라진 것이 아니라 **개별 세션
 * 삭제**로 옮겨 갔다 (3g → 1i My Stories 카드).
 *
 * **표시명만 되돌아왔다.** 5차가 닉네임 변경을 지운 근거는 *"읽을 경로가 없어서"* 였고,
 * `PATCH /api/v1/me` 가 열리면서 그 근거가 사라졌다 (backend #271, 정정본 §13-55) — 지금은
 * 표시명을 **만드는 유일한 경로**가 여기다. 되돌린 판단의 ADR 은 이슈 #87 에 있다. 이 화면에
 * 둔 것은 계정의 값이기 때문이다: 작품 상세와 커뮤니티 카드는 그 값을 *읽기만* 한다.
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

        <h2 className={styles.sectionTitle}>프로필</h2>
        <DisplayNameSection />

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
 * 표시명 (`updateMe`, backend #271).
 *
 * **읽고 나서 쓴다.** 지금 값을 모르면 화면은 "설정하기" 와 "바꾸기" 를 구분할 수 없고,
 * 작성자는 자기가 이미 정한 이름을 다시 정하는 것처럼 본다. 읽는 경로는 `GET /me` 다.
 *
 * 이 구역이 실패해도 **약관과 탈퇴 줄은 그대로 있다** — 이름을 못 읽는 것과 탈퇴할 수 없는
 * 것은 다른 사실이다 (`PolicySection` 과 같은 판단).
 */
function DisplayNameSection() {
  const { resource, reload } = useResource(useCallback((signal: AbortSignal) => getMe(signal), []))

  if (resource.status === 'loading') {
    return (
      <p className={shared.meta} role="status" aria-live="polite">
        불러오는 중…
      </p>
    )
  }
  if (resource.status === 'failed') {
    // 서버가 준 `message` 를 그대로 낸다 (F-4). 약관 구역과 같은 모양이다 — 이 화면에서
    // 실패는 구역 하나의 일이지 화면 전체의 일이 아니다.
    return (
      <div role="alert">
        <p className={shared.meta}>{resource.error.message}</p>
        <button type="button" className={shared.button} onClick={reload}>
          다시 시도
        </button>
      </div>
    )
  }
  // `key` 로 다시 만든다 — 다시 읽어 온 계정은 다른 상태의 시작이지 같은 폼의 이어짐이 아니다.
  return <DisplayNameRow key={resource.data.displayName ?? ''} account={resource.data} />
}

/**
 * 표시명 한 줄과, 눌렀을 때 열리는 입력.
 *
 * **설정과 변경이 한 요청이다** (upsert) — 화면이 "처음인가" 를 먼저 묻지 않는다. 달라지는
 * 것은 줄에 보이는 문구뿐이다.
 *
 * **저장된 값은 서버가 돌려준 것이다.** 서버가 정규화하므로(NFC · 양끝 공백 · 연속 공백)
 * 보낸 값을 그대로 그리면 화면과 서버가 갈라진다 — 응답의 `displayName` 으로 덮는다.
 */
function DisplayNameRow({ account }: { account: MeResponse }) {
  const inputId = useId()
  const [saved, setSaved] = useState<string | null>(account.displayName)
  const [input, setInput] = useState(account.displayName ?? '')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<ApiError | null>(null)

  async function submit(): Promise<void> {
    setSaving(true)
    setFailure(null)
    try {
      const updated = await updateMe(input)
      setSaved(updated.displayName)
      setInput(updated.displayName ?? '')
      setEditing(false)
    } catch (error) {
      // 서버의 `message` 를 그대로 낸다 (F-4). 400 이 무엇을 거절했는지 화면이 다시 쓰지
      // 않는다 — 규칙의 정본이 서버에 있기 때문이다. **중복도 오류가 아니다**: 같은 이름을
      // 가진 회원이 둘 이상 있을 수 있고, 그래서 계약에 `409` 가 없다 (§13-55).
      setFailure(toApiError(error))
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    const handle = displayNameHandle(saved)
    return (
      <ul className={styles.rows}>
        <li>
          <button
            type="button"
            className={styles.row}
            onClick={() => {
              setInput(saved ?? '')
              setFailure(null)
              setEditing(true)
            }}
          >
            표시명
            <span className={styles.rowValue}>
              {/* 정하지 않은 것과 원래 비는 값을 구분한다 — 그래서 계약이 `null` 을 준다 */}
              {handle ?? '설정하기'}
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            </span>
          </button>
        </li>
      </ul>
    )
  }

  return (
    <form
      className={styles.nameForm}
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <label className={styles.nameLabel} htmlFor={inputId}>
        표시명
      </label>
      {/*
       * `@` 는 **화면이 붙이는 표기**이고 값에 넣지 않는다 (backend #287) — 계약이 `@` 로
       * 시작하는 값을 거절한다. 장식이므로 낭독기에서 빼고, 입력 자체는 그 옆에 있다.
       */}
      <div className={styles.nameRow}>
        <span className={styles.namePrefix} aria-hidden="true">
          @
        </span>
        <input
          id={inputId}
          className={styles.nameInput}
          value={input}
          disabled={saving}
          autoComplete="off"
          onChange={(event) => setInput(event.target.value)}
        />
      </div>
      <p className={shared.meta}>작품 상세와 커뮤니티 카드에 이 이름이 보입니다.</p>
      {failure === null ? null : (
        <p className={shared.meta} role="alert">
          {failure.message}
        </p>
      )}
      <div className={shared.actions}>
        <button
          type="submit"
          className={`${shared.button} ${shared.primary}`}
          disabled={!canSubmitDisplayName(input) || saving}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          className={shared.button}
          disabled={saving}
          onClick={() => {
            setInput(saved ?? '')
            setFailure(null)
            setEditing(false)
          }}
        >
          취소
        </button>
      </div>
    </form>
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
