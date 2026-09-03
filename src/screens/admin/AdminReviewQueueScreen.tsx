import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  clearAdminStepUp,
  decideReview,
  listReviewQueue,
  type ReviewQueueItem,
} from '../../api/endpoints/admin'
import { ROUTES } from '../../routes/routes'
import { formatRelativeTime } from '../account/relativeTime'
import { useResource } from '../library/useResource'
import { failureMessage } from './twoFactor'
import {
  buildVerdict,
  canDecide,
  itemsInTab,
  moveSelection,
  needsConfirmation,
  NOTE_MAX_LENGTH,
  QUEUE_TAB_HINT,
  QUEUE_TAB_LABEL,
  QUEUE_TABS,
  REJECT_REASON_LABEL,
  REJECT_REASONS,
  shortcutFor,
  verdictLabel,
  type QueueStatus,
  type RejectReason,
  type Verdict,
} from './reviewQueue'
import styles from './adminQueue.module.css'

/**
 * 인간 검수 큐 (`3h`) — 좌 목록 / 우 상세.
 *
 * **신고 큐가 별도 화면이 아니다.** `3h` 는 신고 큐를 "동일 레이아웃"이라고 적었고, 계약은
 * 그보다 한 발 더 갔다 — 신고로 정지된 작품은 **같은 큐**에 `suspended` 로 올라온다
 * (정정본 §13-41, R8.9). 그래서 목록도 판정도 하나이고, 탭이 그 셋을 가른다.
 *
 * **`3h` 의 우측 절반이 여기 없다.** 기본 정보 · 세계관 · 캐릭터 · 챕터/엔딩 · 미리보기 3턴 ·
 * 자동 검수 요약을 주는 경로가 계약에 없다 (아래 `MissingManuscript` 참고). 없는 경로를
 * 상상해 화면을 채우지 않고, 없다는 사실을 검수자에게 보이는 자리에 적는다 — 원고를 보지
 * 못한 채 판정하고 있다는 것을 검수자가 알아야 한다.
 *
 * **작성자를 그리지 않는다.** `3h` 는 "@yeonwoo · 작품 2 · 반려 1" 을 그렸지만 계약의
 * `ReviewQueueItem` 은 작성자를 담지 않는다 — *"누가 썼는지가 함께 오면 그것이 판정에
 * 섞인다"* 가 그 이유이고, `player_ref` 는 응답에 나가지 않는다 (F-6).
 */
export function AdminReviewQueueScreen() {
  const navigate = useNavigate()
  // `listReviewQueue` 는 모듈 최상위 함수라 이미 고정돼 있다 — `useCallback` 으로 한 번 더
  // 감싸지 않는다. 훅이 요구하는 것은 매 렌더 새 함수가 아닐 것 하나다.
  const { resource, reload } = useResource(listReviewQueue)

  const [tab, setTab] = useState<QueueStatus>('in_review')
  const [selected, setSelected] = useState(0)
  const [shortcut, setShortcut] = useState<Verdict | null>(null)
  // 상세 패널의 effect 가 이것을 의존성으로 본다. 매 렌더 새 함수를 주면 그 effect 가 매
  // 렌더 다시 돌고, 그 안에는 서버로 나가는 호출이 있다.
  const clearShortcut = useCallback(() => setShortcut(null), [])

  const queue = resource.status === 'ready' ? resource.data : []
  const items = itemsInTab(queue, tab)
  const current = items[Math.min(selected, items.length - 1)] ?? null

  /*
   * 단축키. **판단은 `shortcutFor` 가 하고 여기서는 그 결과만 쓴다** — 입력 중인지 · 수식
   * 키가 눌렸는지를 컴포넌트가 다시 판단하면 그 판단이 렌더링 없이는 확인되지 않는다.
   *
   * 판정 셋은 여기서 서버로 나가지 않는다. 우측 패널로 넘겨 확인을 거치게 한다 — 키 하나로
   * 남의 작품이 공개되거나 내려가는 것을 막는 자리가 그곳이다.
   */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const action = shortcutFor({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        target: event.target as HTMLElement | null,
      })
      if (action === null) {
        return
      }
      event.preventDefault()
      if (action === 'next' || action === 'previous') {
        setSelected((index) => moveSelection(items.length, index, action))
        return
      }
      setShortcut(action)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [items.length])

  return (
    <main className={styles.page} data-screen="AdminReviewQueueScreen">
      <header className={styles.bar}>
        <h1 className={styles.title}>ADMIN / REVIEW QUEUE</h1>
        {/*
         * 밀린 건수를 적지 않는다. 계약이 큐의 전체 길이를 담지 않았고, 화면이 받은 배열의
         * 길이로 그것을 대신하면 서버가 하지 않은 말을 하게 된다.
         */}
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            clearAdminStepUp()
            navigate(ROUTES.adminAuth, { replace: true })
          }}
        >
          승격 해제
        </button>
      </header>

      <nav className={styles.tabs} aria-label="검수 큐">
        {QUEUE_TABS.map((key) => (
          <button
            key={key}
            type="button"
            className={styles.tab}
            aria-current={key === tab ? 'page' : undefined}
            onClick={() => {
              setTab(key)
              setSelected(0)
              setShortcut(null)
            }}
          >
            {QUEUE_TAB_LABEL[key]}
          </button>
        ))}
      </nav>
      <p className={styles.hint}>{QUEUE_TAB_HINT[tab]}</p>

      {resource.status === 'failed' ? (
        // 문구를 짓지 않는다 (F-4). `403` 이 역할·IP·2FA 중 무엇인지도 나누지 않는다 (S-6).
        <p className={styles.failure} role="alert">
          {failureMessage(resource.error)}
        </p>
      ) : null}

      <div className={styles.split}>
        <QueueList
          items={items}
          loading={resource.status === 'loading'}
          selectedId={current?.storyId ?? null}
          onSelect={(index) => {
            setSelected(index)
            setShortcut(null)
          }}
        />
        {current === null ? (
          <p className={styles.hint}>
            {resource.status === 'loading' ? '큐를 여는 중…' : '이 탭에서 기다리는 작품이 없어요.'}
          </p>
        ) : (
          <ReviewDetail
            // 다른 작품으로 옮기면 골라 둔 사유와 메모가 함께 사라져야 한다. 남겨 두면 앞
            // 작품의 사유가 다음 작품의 반려에 실린다 — 그 값은 작성자에게 그대로 간다.
            key={current.storyId}
            item={current}
            tab={tab}
            shortcut={shortcut}
            onShortcutHandled={clearShortcut}
            onDecided={reload}
          />
        )}
      </div>
    </main>
  )
}

/**
 * 좌측 목록. 서버가 준 순서 그대로 — 오래 기다린 것부터다.
 *
 * `3h` 의 "auto: 2 flags" 배지를 그리지 않는다. 자동 검수 결과를 주는 경로가 계약에 없고,
 * 있더라도 어디에 몇 개가 걸렸는지는 그 자체가 판정기의 모양을 드러낸다 (F-5, S-11).
 */
function QueueList({
  items,
  loading,
  selectedId,
  onSelect,
}: {
  items: readonly ReviewQueueItem[]
  loading: boolean
  selectedId: string | null
  onSelect: (index: number) => void
}) {
  // 목록의 모든 행이 같은 기준 시각을 봐야 한다 — 행마다 `Date.now()` 를 부르면 경계에서
  // 두 행이 다른 시간을 가리킨다.
  const now = Date.now()

  return (
    <section className={styles.list} aria-label="기다리는 작품" aria-busy={loading}>
      <p className={styles.listHead}>QUEUE · 오래 기다린 것부터</p>
      {items.map((item, index) => (
        <button
          key={item.storyId}
          type="button"
          className={styles.row}
          aria-current={item.storyId === selectedId ? 'true' : undefined}
          onClick={() => onSelect(index)}
        >
          <span className={styles.rowTitle}>{item.title}</span>
          <span className={styles.rowMeta}>{formatRelativeTime(item.queuedAt, now)}부터</span>
        </button>
      ))}
    </section>
  )
}

/**
 * 우측 상세 — 계약이 주는 것과 판정.
 *
 * 상태를 이 컴포넌트 안에 둔다. 부모가 들고 있으면 작품을 옮길 때 지우는 책임이 부모로 가고,
 * 그 지움을 한 번 빠뜨리면 앞 작품의 사유가 다음 작품에 실린다.
 */
function ReviewDetail({
  item,
  tab,
  shortcut,
  onShortcutHandled,
  onDecided,
}: {
  item: ReviewQueueItem
  tab: QueueStatus
  shortcut: Verdict | null
  onShortcutHandled: () => void
  onDecided: () => void
}) {
  const [reasons, setReasons] = useState<readonly RejectReason[]>([])
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState<Verdict | null>(null)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const sending = useRef(false)

  const send = useCallback(
    async (verdict: Verdict) => {
      // 두 번 눌린 것을 두 번 보내지 않는다. 판정은 `Idempotency-Key` 를 쓰지 않는 경로이고
      // (F-7 은 중복 과금이 되는 턴 생성의 규칙이다), 두 번째 요청은 `409` 로 돌아온다.
      if (sending.current) {
        return
      }
      sending.current = true
      setPending(true)
      setFailure(null)
      try {
        await decideReview(item.storyId, buildVerdict({ verdict, reasons, note }))
        setConfirming(null)
        onDecided()
      } catch (error) {
        // 이미 다른 검수자가 판정했을 수 있다 (`409 REVIEW_NOT_PENDING`). 서버 문장을 그대로
        // 내고(F-4) 큐를 다시 읽는다 — 사라진 항목을 계속 붙들고 있으면 다음 판정도 실패한다.
        setFailure(failureMessage(error))
        onDecided()
      } finally {
        sending.current = false
        setPending(false)
      }
    },
    [item.storyId, note, onDecided, reasons],
  )

  /*
   * 단축키가 들어왔다. **여기서 보내지 않는다** — 되돌릴 수 없는 판정(통과 · 반려)은 확인을
   * 한 번 거치고, 보류만 곧바로 나간다. 계약이 *"`hold` 는 아무것도 바꾸지 않는다"* 고 적었다.
   */
  useEffect(() => {
    if (shortcut === null) {
      return
    }
    onShortcutHandled()
    if (needsConfirmation(shortcut)) {
      setConfirming(shortcut)
      return
    }
    void send(shortcut)
  }, [onShortcutHandled, send, shortcut])

  const decidable = canDecide({ verdict: confirming ?? 'HOLD', reasons, pending })

  return (
    <section className={styles.detail} aria-label="검수 상세">
      <div className={styles.detailHead}>
        <h2 className={styles.detailTitle}>{item.title}</h2>
        <code className={styles.storyId}>{item.storyId}</code>
      </div>

      <MissingManuscript />

      <fieldset className={styles.reasons}>
        <legend className={styles.legend}>반려 사유 — 작성자에게 카테고리로만 전달돼요</legend>
        {REJECT_REASONS.map((reason) => (
          <label key={reason} className={styles.reason}>
            <input
              type="checkbox"
              checked={reasons.includes(reason)}
              onChange={(event) => {
                setReasons((chosen) =>
                  event.target.checked
                    ? [...chosen, reason]
                    : chosen.filter((each) => each !== reason),
                )
              }}
            />
            {REJECT_REASON_LABEL[reason]}
          </label>
        ))}
      </fieldset>

      <label className={styles.legend} htmlFor="admin-review-note">
        내부 메모 — 작성자에게 가지 않아요
      </label>
      <textarea
        id="admin-review-note"
        className={styles.note}
        value={note}
        maxLength={NOTE_MAX_LENGTH}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
      />

      <div className={styles.verdicts}>
        {(['PASS', 'REJECT', 'HOLD'] as const).map((verdict) => (
          <button
            key={verdict}
            type="button"
            className={verdict === 'REJECT' ? `${styles.button} ${styles.reject}` : styles.button}
            disabled={pending || !canDecide({ verdict, reasons, pending })}
            onClick={() => {
              setFailure(null)
              if (needsConfirmation(verdict)) {
                setConfirming(verdict)
                return
              }
              void send(verdict)
            }}
          >
            {verdictLabel(tab, verdict)}
          </button>
        ))}
      </div>

      {confirming !== null ? (
        <div className={styles.confirm} role="alertdialog" aria-label="판정 확인">
          {/*
           * 확인 한 번. 통과는 남의 원고를 공개하고 반려는 작성자에게 통보가 간다 — 둘 다
           * 이 화면에서 되돌릴 방법이 없다 (계약에 판정 취소 경로가 없다).
           */}
          <p className={styles.confirmText}>
            “{item.title}” 을(를) {verdictLabel(tab, confirming)} 처리할까요? 되돌릴 수 없어요.
          </p>
          {/*
           * 단축키 `R` 은 사유를 고르지 않은 채로도 올 수 있다. 그때 확인 버튼만 비활성으로
           * 두면 왜 눌리지 않는지 보이지 않는다 — 서버가 한 말이 아니라 화면이 건 조건이므로
           * 여기서 말하는 것이 맞다 (F-4 는 서버 오류 문구의 규칙이다).
           */}
          {!decidable && !pending ? (
            <p className={styles.confirmText}>사유를 하나 이상 골라 주세요.</p>
          ) : null}
          <div className={styles.verdicts}>
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              disabled={!decidable}
              onClick={() => void send(confirming)}
            >
              {pending ? '보내는 중…' : '확인'}
            </button>
            <button type="button" className={styles.button} onClick={() => setConfirming(null)}>
              그만두기
            </button>
          </div>
        </div>
      ) : null}

      {failure !== null ? (
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      ) : null}

      <p className={styles.hint}>단축키: A 통과 / R 반려 / H 보류 / J·K 이동</p>
    </section>
  )
}

/**
 * 없는 것을 없다고 적는 자리.
 *
 * **빈 상자로 넘기지 않는다.** 비어 있는 화면은 돌아가는 것처럼 보이고, 검수자는 원고가
 * 깨끗해서 아무것도 안 나온 줄 안다 — 실제로는 아무것도 불러오지 못한 것이다.
 *
 * 계약이 이유를 적었다: `ReviewQueueItem` 은 *"원고 본문도 담지 않는다 — 큐는 무엇을 볼
 * 차례인지를 답하는 자리이며, 원문 열람은 감사가 걸린 다른 문이다"*. 그 문이 아직 계약에
 * 없다. 프론트에서 우회하지 않고 백엔드 이슈로 연다.
 */
function MissingManuscript() {
  return (
    <div className={styles.missing}>
      <p className={styles.missingHead}>원고를 여는 경로가 계약에 없어요</p>
      <p className={styles.missingBody}>
        기본 정보 · 세계관 · 캐릭터 · 챕터/엔딩 · 미리보기 · 자동 검수 요약을 돌려주는
        오퍼레이션이 아직 없어요. <b>지금 판정하면 제목만 보고 판정하는 것</b>이에요.
      </p>
    </div>
  )
}
