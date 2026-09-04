import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  clearAdminStepUp,
  decideReview,
  getReviewHistory,
  listReviewQueue,
  listStoryReports,
  readReviewManuscript,
  type ReviewHistoryEntry,
  type ReviewManuscript,
  type ReviewQueueItem,
  type StoryReports,
} from '../../api/endpoints/admin'
import { ROUTES } from '../../routes/routes'
import { formatRelativeTime } from '../account/relativeTime'
// 가시성 문구는 작성자가 고를 때 본 이름 그대로다 (`3f` · `6c`) — 같은 값의 이름이 화면에
// 따라 달라지면 검수자와 작성자가 다른 것을 말하게 된다.
import { VISIBILITY_LABEL } from '../account/reviewStatus'
import { useResource, type Resource } from '../library/useResource'
import {
  AUTO_CHECK_VERDICT_LABEL,
  authorLabel,
  DEFAULT_DETAIL_PANEL,
  DETAIL_PANEL_LABEL,
  endingBadges,
  hasNote,
  HISTORY_REASON_LABEL,
  HISTORY_STAGE_LABEL,
  HISTORY_VERDICT_LABEL,
  panelInStatus,
  panelsFor,
  reasonCountsForDisplay,
  REPORT_REASON_LABEL,
  REPORT_STATUS_LABEL,
  reportTargetLabel,
  type DetailPanel,
} from './reviewDetail'
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
 * **우측 패널은 고른 작품에 대해서만 채운다** (#86). 원고 · 신고 · 지난 판정 셋 다 계약이
 * 열렸고 (`readReviewManuscript` · `listStoryReports` · `getReviewHistory`), 앞의 둘은
 * **부르는 것만으로 감사 기록이 남는다** (backend R12.3 · R14.5). 그래서 목록을 그리려고
 * 미리 부르지 않는다 — 열어 본 적 없는 작품이 열람 기록에 남으면 그 기록은 "누가 무엇을
 * 봤는가" 를 더는 답하지 못한다.
 *
 * **미리보기 3턴 자리를 만들지 않는다.** `3h` 가 그렸지만 검수 대상 작품에서 그 턴으로 가는
 * 길이 계약에 없다 (정정본 §13-5 · §13-61). 있는 척하는 빈 상자를 두지 않는다.
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
 * `3h` 의 "auto: 2 flags" 배지를 그리지 않는다. 자동 검수 요약은 원고(`readReviewManuscript`)
 * 안에 있고, 그것을 행마다 그리려면 **큐 전체의 원고를 미리 열어야 한다** — 열어 본 적 없는
 * 작품들이 전부 열람 기록에 남는다 (R12.3). 배지 하나를 위해 치를 값이 아니다.
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

      <DetailPanels item={item} />

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
 * 상세의 세 면 — 원고 · 신고 · 지난 판정.
 *
 * **한 번 연 면은 열어 둔다.** 탭을 오갈 때마다 다시 부르면 같은 작품의 열람 기록이 오간
 * 횟수만큼 쌓이고 (backend R12.3 · R14.5), 그 기록은 *몇 번 봤는가*를 답하려던 것이 아니다.
 * 그래서 연 적 있는 면만 그대로 두고 `hidden` 으로 감춘다 — 아직 열지 않은 면은 마운트
 * 자체가 없으므로 **호출도 없다.**
 */
function DetailPanels({ item }: { item: ReviewQueueItem }) {
  const [panel, setPanel] = useState<DetailPanel>(DEFAULT_DETAIL_PANEL)
  // 이 작품에서 실제로 연 면. `panel` 하나만으로는 감춘 면을 살려 둘 수 없다.
  const [opened, setOpened] = useState<readonly DetailPanel[]>([DEFAULT_DETAIL_PANEL])
  // 큐를 다시 읽어 상태가 바뀌면(신고 정지가 풀리면) 없는 면이 열려 있을 수 있다.
  const current = panelInStatus(panel, item.reviewStatus)

  return (
    <div className={styles.panels}>
      <nav className={styles.panelTabs} aria-label="검수 상세">
        {panelsFor(item.reviewStatus).map((key) => (
          <button
            key={key}
            type="button"
            className={styles.panelTab}
            aria-current={key === current ? 'page' : undefined}
            onClick={() => {
              setPanel(key)
              setOpened((seen) => (seen.includes(key) ? seen : [...seen, key]))
            }}
          >
            {DETAIL_PANEL_LABEL[key]}
          </button>
        ))}
      </nav>

      {opened.map((key) => (
        <div key={key} hidden={key !== current}>
          {key === 'manuscript' ? <ManuscriptPanel storyId={item.storyId} /> : null}
          {key === 'reports' ? <ReportsPanel storyId={item.storyId} /> : null}
          {key === 'history' ? <HistoryPanel storyId={item.storyId} /> : null}
        </div>
      ))}
    </div>
  )
}

/**
 * 아직 그릴 것이 없는 동안 무엇을 적는가.
 *
 * 실패는 **서버가 준 문장 그대로**다 (F-4). `403` 이 역할 · IP · 2FA 중 무엇인지 나누지
 * 않고, `404` 를 "지워진 작품" 으로 옮겨 적지도 않는다 — 서버가 하지 않은 말이 된다.
 */
function panelStatus<T>(resource: Resource<T>, opening: string): ReactNode | null {
  if (resource.status === 'loading') {
    return <p className={styles.hint}>{opening}</p>
  }
  if (resource.status === 'failed') {
    return (
      <p className={styles.failure} role="alert">
        {failureMessage(resource.error)}
      </p>
    )
  }
  return null
}

/**
 * 원고 (계약 `readReviewManuscript`) — 검수자가 보고 판정하는 것.
 *
 * **여는 순간 열람 기록이 남는다** (R12.3, 정정본 §13-61). 그래서 고른 작품 하나에 대해서만
 * 부른다.
 *
 * **`worldPrompt` 와 `persona` 를 감추지 않는다.** Debug 콘솔이 프롬프트 원문을 접어 두는
 * 것과 반대 방향인데, 이유가 반대이기 때문이다 — 거기서 접히는 것은 **세이프티 지시**이고
 * 여기서 펼치는 것은 **판정 대상인 UGC 원고**다. 매 턴 모델에게 들어가는 문장을 보지 않은
 * 승인은 작품의 절반만 본 승인이다 (§13-61).
 */
function ManuscriptPanel({ storyId }: { storyId: string }) {
  const load = useCallback(
    (signal: AbortSignal) => readReviewManuscript(storyId, signal),
    [storyId],
  )
  const { resource } = useResource(load)
  const status = panelStatus(resource, '원고를 여는 중…')
  if (resource.status !== 'ready') {
    return status
  }
  return <Manuscript manuscript={resource.data} />
}

function Manuscript({ manuscript }: { manuscript: ReviewManuscript }) {
  const now = Date.now()

  return (
    <div className={styles.panel}>
      {/*
       * 작성자 자리에 표시명 하나만 둔다 (F-6, backend I-3). 계약에 `playerRef` 가 없고,
       * 화면이 그것을 대신할 식별자를 찾아 넣지도 않는다.
       */}
      <dl className={styles.facts}>
        <div className={styles.factRow}>
          <dt>작성자</dt>
          <dd>{authorLabel(manuscript.authorDisplayName)}</dd>
        </div>
        <div className={styles.factRow}>
          <dt>가시성</dt>
          <dd>{VISIBILITY_LABEL[manuscript.visibility]}</dd>
        </div>
        <div className={styles.factRow}>
          <dt>만들어진 때</dt>
          <dd>{formatRelativeTime(manuscript.submittedAt, now)}</dd>
        </div>
      </dl>

      {/*
       * 자동 검수 요약 — **서버가 준 카테고리까지만** 적는다 (F-5, R8.7). 어디에 몇 번
       * 걸렸는지를 화면이 덧붙이면 그것이 곧 우회 사전이 된다 (S-11).
       */}
      <section className={styles.block} aria-label="자동 검수">
        {manuscript.autoCheck === null ? (
          <p className={styles.hint}>자동 검수 기록이 없어요.</p>
        ) : (
          <>
            <p className={styles.blockHead}>
              {AUTO_CHECK_VERDICT_LABEL[manuscript.autoCheck.verdict]} ·{' '}
              {formatRelativeTime(manuscript.autoCheck.checkedAt, now)}
            </p>
            {manuscript.autoCheck.reasons.length === 0 ? null : (
              <ul className={styles.chips}>
                {manuscript.autoCheck.reasons.map((reason) => (
                  <li key={reason} className={styles.chip}>
                    {REJECT_REASON_LABEL[reason]}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {/* `null` 은 작성자가 적지 않았다는 뜻이다 — 화면이 문장을 지어 채우지 않는다 */}
      <Prose head="짧은 소개" text={manuscript.shortDesc} />
      <Prose head="세계관 소개" text={manuscript.worldIntro} />
      <Prose head="세계관 프롬프트 — 매 턴 모델에게 들어가요" text={manuscript.worldPrompt} />

      <section className={styles.block} aria-label="캐릭터">
        <p className={styles.blockHead}>캐릭터 {manuscript.characters.length}</p>
        {manuscript.characters.map((character) => (
          <div key={character.name} className={styles.entry}>
            <p className={styles.entryHead}>{character.name}</p>
            <p className={styles.prose}>{character.persona}</p>
          </div>
        ))}
      </section>

      {/* 진입 조건식은 계약에 없다 — 판정 로직이지 사람이 읽는 문장이 아니다 (§13-61) */}
      <section className={styles.block} aria-label="챕터">
        <p className={styles.blockHead}>챕터 {manuscript.chapters.length}</p>
        {manuscript.chapters.map((chapter) => (
          <div key={chapter.chapterNo} className={styles.entry}>
            <p className={styles.entryHead}>
              {chapter.chapterNo}. {chapter.title}
            </p>
            <p className={styles.hint}>
              {chapter.minTurns}~{chapter.maxTurns}턴
            </p>
          </div>
        ))}
      </section>

      <section className={styles.block} aria-label="엔딩">
        <p className={styles.blockHead}>엔딩 {manuscript.endings.length}</p>
        {manuscript.endings.map((ending) => (
          <div key={ending.endingNo} className={styles.entry}>
            <p className={styles.entryHead}>
              {ending.endingNo}. {ending.label}
            </p>
            {endingBadges(ending).length === 0 ? null : (
              <ul className={styles.chips}>
                {endingBadges(ending).map((badge) => (
                  <li key={badge} className={styles.chip}>
                    {badge}
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.prose}>{ending.epilogueText}</p>
          </div>
        ))}
      </section>
    </div>
  )
}

/** 작성자가 쓴 문단 하나. 계약이 `null` 을 주는 자리는 비었다고만 적는다. */
function Prose({ head, text }: { head: string; text: string | null }) {
  return (
    <section className={styles.block} aria-label={head}>
      <p className={styles.blockHead}>{head}</p>
      {text === null || text.trim().length === 0 ? (
        <p className={styles.hint}>비어 있어요.</p>
      ) : (
        <p className={styles.prose}>{text}</p>
      )}
    </section>
  )
}

/**
 * 신고 (계약 `listStoryReports`) — **임계에 닿아 내려온 작품에서만 연다** (정정본 §13-41).
 *
 * **신고자와 신고자가 쓴 문장은 오지 않는다** (backend I-3, §13-62). 그 자리를 만들지
 * 않는 것이 화면이 지킬 몫이다 — 채우려 들면 판정에 쓰지 않기로 한 값을 판정에 들인다.
 */
function ReportsPanel({ storyId }: { storyId: string }) {
  const load = useCallback((signal: AbortSignal) => listStoryReports(storyId, signal), [storyId])
  const { resource } = useResource(load)
  const status = panelStatus(resource, '신고를 여는 중…')
  if (resource.status !== 'ready') {
    return status
  }
  return <Reports reports={resource.data} />
}

function Reports({ reports }: { reports: StoryReports }) {
  const now = Date.now()
  const counts = reasonCountsForDisplay(reports.reasonCounts)

  return (
    <div className={styles.panel}>
      <section className={styles.block} aria-label="사유별 집계">
        <p className={styles.blockHead}>사유별 집계 — 전건이에요</p>
        {counts.length === 0 ? (
          <p className={styles.hint}>집계된 신고가 없어요.</p>
        ) : (
          <dl className={styles.facts}>
            {counts.map((count) => (
              <div key={count.reason} className={styles.factRow}>
                <dt>{REPORT_REASON_LABEL[count.reason]}</dt>
                {/* 합계를 만들지 않는다 — 사유별 사람 수를 더한 값은 신고한 사람 수가 아니다 */}
                <dd>{count.count}명</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className={styles.block} aria-label="개별 신고">
        <p className={styles.blockHead}>최근 신고 — 전건은 위 집계가 답해요</p>
        {reports.reports.length === 0 ? (
          <p className={styles.hint}>목록에 올라온 신고가 없어요.</p>
        ) : (
          reports.reports.map((report) => (
            <p key={report.reportId} className={styles.entryHead}>
              {REPORT_REASON_LABEL[report.reason]} · {reportTargetLabel(report.turnNo)} ·{' '}
              {REPORT_STATUS_LABEL[report.status]} · {formatRelativeTime(report.createdAt, now)}
            </p>
          ))
        )}
      </section>
    </div>
  )
}

/**
 * 지난 판정 (계약 `getReviewHistory`) — append-only 이고 최근 것부터다.
 *
 * **`note` 가 여기에만 있다** (backend R8.7 · S-11, §13-63). 작성자가 보는 검수 상태 화면은
 * 카테고리만 받으므로, 두 화면이 같은 데이터를 쓰지 않는다.
 *
 * **검수자가 누구인지는 오지 않는다** (I-3) — `reviewer_ref` 는 `player_ref` 이고, 그 물음에
 * 답하는 자리는 관리자 감사 기록이다.
 */
function HistoryPanel({ storyId }: { storyId: string }) {
  const load = useCallback((signal: AbortSignal) => getReviewHistory(storyId, signal), [storyId])
  const { resource } = useResource(load)
  const status = panelStatus(resource, '지난 판정을 여는 중…')
  if (resource.status !== 'ready') {
    return status
  }
  return <History entries={resource.data} />
}

function History({ entries }: { entries: readonly ReviewHistoryEntry[] }) {
  const now = Date.now()

  // 빈 목록은 **판정이 없다**는 뜻이다 — 없는 작품은 `404` 로 온다. 둘을 같은 말로 적지 않는다.
  if (entries.length === 0) {
    return (
      <div className={styles.panel}>
        <p className={styles.hint}>지난 판정이 없어요. 아직 아무도 이 작품을 판정하지 않았어요.</p>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {entries.map((entry) => (
        <div key={`${entry.reviewedAt}-${entry.stage}`} className={styles.entry}>
          <p className={styles.entryHead}>
            {HISTORY_STAGE_LABEL[entry.stage]} · {HISTORY_VERDICT_LABEL[entry.verdict]} ·{' '}
            {formatRelativeTime(entry.reviewedAt, now)}
          </p>
          {entry.reasons.length === 0 ? null : (
            <ul className={styles.chips}>
              {entry.reasons.map((reason) => (
                <li key={reason} className={styles.chip}>
                  {HISTORY_REASON_LABEL[reason]}
                </li>
              ))}
            </ul>
          )}
          {hasNote(entry) ? <p className={styles.prose}>내부 기록 — {entry.note}</p> : null}
        </div>
      ))}
    </div>
  )
}
