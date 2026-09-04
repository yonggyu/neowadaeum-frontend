import { useCallback, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  getSessionDebug,
  regenerateTurn,
  rollbackSession,
  submitAdminFreeInput,
  type AdminSessionDebug,
} from '../../api/endpoints/admin'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ROUTES } from '../../routes/routes'
import { useResource } from '../library/useResource'
import {
  buildFreeInput,
  callLabel,
  canSubmitFreeAction,
  CONFIRM_COPY,
  COST_NOTE,
  currentTurn,
  DEBUG_PANEL_LABEL,
  DEBUG_PANELS,
  DEFAULT_PANEL,
  formatLatency,
  formatTokens,
  FREE_ACTION_MAX_LENGTH,
  PROMPT_STARTS_OPEN,
  rollbackTarget,
  turnsNewestFirst,
  type AiCall,
  type DebugPanel,
  type DebugTurn,
} from './debugConsole'
import { failureMessage } from './twoFactor'
import styles from './adminDebug.module.css'

/**
 * Admin Debug 콘솔 (`1j`) — 좌 미리보기·조작 / 우 사실 다섯.
 *
 * **이 화면은 남의 플레이 기록과 AI 프롬프트 원문을 그린다.** 그래서 지키는 것이 셋이다.
 *
 * 1. **`player_ref` 가 어디에도 없다** (F-6). 계약도 응답에 담지 않는다 (백엔드 I-3).
 *    세션 id 는 계약이 경로에 두었으므로 URL 과 화면에 있다.
 * 2. **프롬프트 원문은 접힌 채로 열린다** (`PROMPT_STARTS_OPEN`). 콘솔을 여는 것만으로
 *    세이프티 지시가 화면에 뜨면 어깨너머로 읽히고, 읽힌 지시가 곧 우회 경로가 된다.
 *    **복사 버튼도 콘솔 로그도 두지 않는다** — 원문이 이 화면 밖으로 나가는 길을 만들지 않는다.
 * 3. **되돌릴 수 없는 둘 앞에 확인이 있다** — ROLLBACK · REGENERATE. 판은 `ConfirmDialog`
 *    하나를 쓴다 (#43·#63). 두 번째 확인 판을 만들지 않는다.
 * 4. **계약에 없는 값으로 패널을 채우지 않는다** — 아래 `MissingFromContract` 가 `1j` 가
 *    그렸지만 `debug` 응답에 없는 것을 그 자리에서 말한다. 빈 상자는 돌아가는 것처럼 보인다.
 */
export function AdminDebugScreen() {
  const { sessionId } = useParams<{ sessionId: string }>()

  return (
    <main className={styles.page} data-screen="AdminDebugScreen">
      <header className={styles.bar}>
        <h1 className={styles.title}>ADMIN / DEBUG CONSOLE</h1>
      </header>
      {sessionId === undefined ? (
        /*
         * 라우트가 세션 id 를 항상 주므로 여기 오지 않는다. 그래도 빈 화면으로 넘기지 않는다.
         *
         * **낡은 안내를 걷어 냈다** (#115). 여기 있던 문장은 *"계약에 관리자용 세션 목록 경로가
         * 없다"* 였는데 `#108` 이 그 목록을 세웠고, 남겨 두면 다음 사람이 백엔드에 이미 닫힌
         * 이슈를 다시 연다 — 실제로 그렇게 열린 적이 있다.
         *
         * **여기서 목록을 그리지 않는다.** 고를 목록을 채우려면 세션마다 `getSessionDebug` 를
         * 불러야 하고, 그 호출 하나하나가 열람 감사 한 줄이다 (#86, backend R12.3 · S-5).
         * 이 자리가 주는 것은 **길 하나**다.
         */
        <p className={styles.missing}>
          세션 id 가 경로에 없어요.{' '}
          <Link className={styles.link} to={ROUTES.adminSessions}>
            세션 목록
          </Link>
          에서 열 세션을 고르세요.
        </p>
      ) : (
        // 세션이 바뀌면 고른 호출과 펼친 원문이 새로 시작해야 한다. 남겨 두면 앞 세션에서
        // 펼쳐 둔 프롬프트가 다음 세션에서 펼쳐진 채로 열린다.
        <DebugConsole key={sessionId} sessionId={sessionId} />
      )}
    </main>
  )
}

/** 한 세션의 디버그 — 한 번 읽고, 그 안에서 고른다. */
function DebugConsole({ sessionId }: { sessionId: string }) {
  const load = useCallback(
    (signal: AbortSignal) => getSessionDebug(sessionId, signal),
    [sessionId],
  )
  const { resource, reload } = useResource(load)

  if (resource.status === 'loading') {
    return <p className={styles.failure}>세션을 여는 중…</p>
  }
  if (resource.status === 'failed') {
    // 문구를 짓지 않는다 (F-4). `403` 이 역할·IP·2FA 중 무엇인지도 나누지 않는다 (백엔드 S-6).
    return (
      <p className={styles.failure} role="alert">
        {failureMessage(resource.error)}
      </p>
    )
  }
  return <ConsoleBody sessionId={sessionId} debug={resource.data} reload={reload} />
}

function ConsoleBody({
  sessionId,
  debug,
  reload,
}: {
  sessionId: string
  debug: AdminSessionDebug
  reload: () => void
}) {
  const { session, aiCalls } = debug
  const [panel, setPanel] = useState<DebugPanel>(DEFAULT_PANEL)
  const [callId, setCallId] = useState<string | null>(null)
  // 계약이 *"최신이 앞이다"* 라고 적은 배열이다 — 고른 것이 없으면 맨 앞이 곧 최신 호출이다.
  const call = aiCalls.find((each) => each.id === callId) ?? aiCalls[0] ?? null

  return (
    <div className={styles.split}>
      <div className={styles.column}>
        <p className={styles.meta}>
          <span>session: {sessionId}</span>
          <span>story: {session.storyId}</span>
          <span>version: {session.storyVersionId}</span>
          <span>status: {session.status}</span>
          <span>
            provider: {session.providerId} · {session.modelId}
          </span>
          <span>test session: {session.testSession ? 'yes' : 'no'}</span>
        </p>
        <StoryPreview turn={currentTurn(session)} turnNo={session.turnNo} />
        <SessionActions sessionId={sessionId} debug={debug} reload={reload} />
        <MissingFromContract />
      </div>

      <div className={styles.column}>
        <nav className={styles.tabs} aria-label="디버그 패널">
          {DEBUG_PANELS.map((key) => (
            <button
              key={key}
              type="button"
              className={styles.tab}
              aria-current={key === panel ? 'page' : undefined}
              onClick={() => setPanel(key)}
            >
              {DEBUG_PANEL_LABEL[key]}
            </button>
          ))}
        </nav>

        <Panel name="state" current={panel} label="GAME STATE">
          <p className={styles.box}>
            chapter: {session.chapterNo} · turn: {session.turnNo}
          </p>
          <Raw value={session.gameState} />
        </Panel>

        <Panel name="summary" current={panel} label="STORY SUMMARY">
          <p className={styles.box}>summary upto turn: {session.summaryUptoTurnNo ?? '없음'}</p>
          <Raw value={session.storySummary} />
        </Panel>

        <Panel name="turns" current={panel} label={`RECENT TURNS (${session.recentTurns.length})`}>
          <div className={styles.box}>
            {turnsNewestFirst(session).map((turn) => (
              <TurnRow key={turn.turnNo} turn={turn} />
            ))}
          </div>
        </Panel>

        {/*
         * 원문 셋(프롬프트 · 응답 · 사용량)은 **한 호출**을 가리킨다. `1j` 는 하나를 그렸고
         * 계약은 배열을 준다 — 고르지 않으면 재시도한 호출도 요약 호출도 볼 수 없다.
         */}
        <CallPicker calls={aiCalls} selected={call} onSelect={setCallId} />

        <Panel name="prompt" current={panel} label="AI PROMPT (raw)">
          {/* 호출을 옮기면 원문이 다시 접혀야 한다 — `key` 가 그 초기화를 맡는다 */}
          <PromptBox key={call?.id ?? 'none'} call={call} />
        </Panel>

        <Panel name="response" current={panel} label="AI RESPONSE (raw JSON)">
          <Raw value={call?.responseRaw} />
        </Panel>

        <p className={styles.label}>
          USAGE — in {formatTokens(call?.inputTokens)} / out {formatTokens(call?.outputTokens)} /
          latency {formatLatency(call?.latencyMs)}
        </p>
        <p className={styles.label}>{COST_NOTE}</p>
      </div>
    </div>
  )
}

/** 우측 한 칸. 1024 이하에서는 고른 하나만 남는다 — 접는 것은 CSS 가 한다 (`1j`). */
function Panel({
  name,
  current,
  label,
  children,
}: {
  name: DebugPanel
  current: DebugPanel
  label: string
  children: ReactNode
}) {
  return (
    <section className={styles.panel} data-current={name === current} aria-label={label}>
      <p className={styles.label}>{label}</p>
      {children}
    </section>
  )
}

/**
 * 저장된 원문 그대로. 없으면 없다고 적는다 — 빈 상자로 두면 채워질 자리가 비어 있는 것인지
 * 서버가 `null` 을 준 것인지 구분되지 않는다.
 */
function Raw({ value }: { value: string | null | undefined }) {
  if (value == null || value.length === 0) {
    return <p className={`${styles.box} ${styles.muted}`}>없음 — 서버가 값을 주지 않았어요</p>
  }
  return <pre className={styles.raw}>{value}</pre>
}

/**
 * 좌측 위 — 지금 화면에 떠 있는 턴과 그 선택지.
 *
 * **본문도 선택지도 저장된 JSON 원문이다** (계약 `AdminDebugTurn`). `1j` 는 이것을 문장과
 * `id=c_01` 목록으로 그렸지만, 계약은 그 JSON 의 모양을 이 응답에서 규정하지 않는다 —
 * 모양을 가정해 파싱하면 서버가 저장 형식을 바꾸는 날 콘솔이 조용히 아무것도 그리지 않는다.
 * 원문 그대로 두면 `choiceId` 도 그 안에 그대로 보인다.
 */
function StoryPreview({ turn, turnNo }: { turn: DebugTurn | null; turnNo: number }) {
  if (turn === null) {
    return (
      <p className={styles.missing}>
        현재 턴(t{turnNo})이 `recentTurns` 에 없어요. 서버가 준 만큼만 그려요.
      </p>
    )
  }
  return (
    <>
      <p className={styles.label}>STORY PREVIEW — t{turn.turnNo}</p>
      <p className={styles.box}>speaker: {turn.speakerName ?? '없음'}</p>
      <Raw value={turn.paragraphs} />
      <p className={styles.label}>CHOICES (raw)</p>
      <Raw value={turn.choices} />
    </>
  )
}

/**
 * 최근 턴 한 줄.
 *
 * **`safetyVerdict` 를 여기서는 그린다.** F-5 는 *사용자에게* 차단 사유를 구체적으로 말하지
 * 않는 규칙이고 (백엔드 R9.6), 계약은 이 필드를 관리자 응답에 담으며 *"왜 막혔는지를 보는
 * 자리"* 라고 적었다. 그 자리가 여기다.
 */
function TurnRow({ turn }: { turn: DebugTurn }) {
  return (
    <div className={styles.turnRow}>
      <span>t{turn.turnNo}</span>
      <span className={styles.flag}>ch{turn.chapterNo}</span>
      <span>→ {turn.adminFreeInput ? 'free' : (turn.chosenChoiceId ?? '없음')}</span>
      {turn.ending ? <span className={styles.flag}>ending</span> : null}
      {turn.safetyVerdict == null ? null : (
        <span className={styles.flag}>safety: {turn.safetyVerdict}</span>
      )}
    </div>
  )
}

/** AI 호출 하나 고르기. 최신이 앞이다 (계약). */
function CallPicker({
  calls,
  selected,
  onSelect,
}: {
  calls: readonly AiCall[]
  selected: AiCall | null
  onSelect: (id: string) => void
}) {
  if (calls.length === 0) {
    return <p className={`${styles.box} ${styles.muted}`}>AI 호출 기록이 없어요.</p>
  }
  return (
    <div className={styles.calls} role="group" aria-label="AI 호출">
      {calls.map((call) => (
        <button
          key={call.id}
          type="button"
          className={styles.callRow}
          aria-current={call.id === selected?.id ? 'true' : undefined}
          onClick={() => onSelect(call.id)}
        >
          {callLabel(call)}
        </button>
      ))}
    </div>
  )
}

/**
 * 프롬프트 원문 — **접힌 채로 열린다** (`PROMPT_STARTS_OPEN`).
 *
 * 펼치는 것은 언제나 사람이 누른 결과다. 복사 버튼을 두지 않는 이유도 같다 — 한 번 눌리면
 * 원문이 이 화면 밖 어디로 가는지 아무도 모른다.
 */
function PromptBox({ call }: { call: AiCall | null }) {
  const [open, setOpen] = useState(PROMPT_STARTS_OPEN)

  if (call === null) {
    return <p className={`${styles.box} ${styles.muted}`}>고른 호출이 없어요.</p>
  }
  return (
    <>
      <button type="button" className={styles.reveal} onClick={() => setOpen(!open)}>
        {open ? '원문 접기' : '원문 펼치기 — 세이프티 지시가 들어 있어요'}
      </button>
      {open ? <pre className={styles.raw}>{call.requestRaw}</pre> : null}
    </>
  )
}

/**
 * 좌측 아래 — 세 조작.
 *
 * **SUBMIT TURN 에는 확인이 없고 나머지 둘에는 있다** (`needsConfirmation` 이 그 판단이다).
 * 자유입력은 턴을 덧붙일 뿐이라 되돌리기로 되돌아가지만, 되돌리기와 재생성은 이 화면에서
 * 되돌릴 방법이 없다 — 계약에 취소 경로가 없다.
 */
function SessionActions({
  sessionId,
  debug,
  reload,
}: {
  sessionId: string
  debug: AdminSessionDebug
  reload: () => void
}) {
  const { session } = debug
  const [action, setAction] = useState('')
  const [target, setTarget] = useState(String(Math.max(session.turnNo - 1, 0)))
  const [confirming, setConfirming] = useState<'regenerate' | 'rollback' | null>(null)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const toTurnNo = rollbackTarget(target, session.turnNo)
  const canSubmit = canSubmitFreeAction({ action, testSession: session.testSession, pending })

  async function submit(): Promise<void> {
    setPending(true)
    setFailure(null)
    try {
      await submitAdminFreeInput(sessionId, buildFreeInput(action))
      setAction('')
      // 계약이 만들어진 본문을 응답에 담지 않는다 — *"디버그로 본다"*. 그래서 다시 읽는다.
      reload()
    } catch (error) {
      // 세이프티에 걸리면 `422` 다. **어디에 걸렸는지는 오지 않고, 화면도 짐작하지 않는다** (F-5).
      setFailure(failureMessage(error))
    } finally {
      setPending(false)
    }
  }

  /**
   * 확인 판이 부르는 그 요청.
   *
   * **판 안에서 실패를 잡지 않는다** — `ConfirmDialog` 가 자기 자리에서 서버 문장을 그대로
   * 낸다 (F-4). 성공 뒤의 일(닫기 · 다시 읽기)만 여기서 한다.
   */
  async function runConfirmed(): Promise<void> {
    if (confirming === 'rollback') {
      if (toTurnNo === null) {
        return
      }
      await rollbackSession(sessionId, { toTurnNo })
    } else {
      await regenerateTurn(sessionId, session.turnNo)
    }
    setConfirming(null)
    reload()
  }

  return (
    <>
      <p className={styles.label}>FREE ACTION INPUT — 관리자 전용</p>
      {/*
       * **일반 Play 에는 자유입력이 없다.** 계약이 사용자 입력면을 `choiceId` 하나로 정했고
       * (F-1), 이 입력은 그 규칙의 예외가 아니라 **다른 경로**다 — `/turns/free` 는 관리자
       * 경로이며 테스트 세션에서만 열린다 (백엔드 I-18). 그래서 이 컴포넌트도, 이 입력을
       * 판단하는 `canSubmitFreeAction` 도 관리자 화면 밖으로 나가지 않는다.
       */}
      <textarea
        className={styles.textarea}
        value={action}
        maxLength={FREE_ACTION_MAX_LENGTH}
        disabled={!session.testSession}
        onChange={(event) => setAction(event.target.value)}
        rows={2}
        aria-label="자유 행동"
        placeholder={session.testSession ? '자유 행동을 입력하고 턴 생성…' : ''}
      />
      {session.testSession ? null : (
        <p className={styles.missing}>
          테스트 세션이 아니에요. 자유입력은 테스트 세션에서만 열려요 — 사용자 소유 세션에
          대해서는 <b>읽기 전용 디버그까지</b>예요 (백엔드 R14.3).
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          disabled={!canSubmit}
          onClick={() => void submit()}
        >
          {pending ? '보내는 중…' : 'SUBMIT TURN'}
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.destructive}`}
          disabled={pending}
          onClick={() => {
            setFailure(null)
            setConfirming('regenerate')
          }}
        >
          REGENERATE t{session.turnNo}
        </button>
        <button
          type="button"
          className={`${styles.button} ${styles.destructive}`}
          disabled={pending || toTurnNo === null}
          onClick={() => {
            setFailure(null)
            setConfirming('rollback')
          }}
        >
          ROLLBACK
        </button>
        {/* 되돌린 뒤 **남아 있을** 턴이다 (계약). 빈 칸을 0 으로 읽지 않는다 */}
        <label className={styles.label} htmlFor="admin-debug-rollback-to">
          to turn
        </label>
        <input
          id="admin-debug-rollback-to"
          className={styles.turnInput}
          value={target}
          inputMode="numeric"
          onChange={(event) => setTarget(event.target.value)}
        />
      </div>

      {failure === null ? null : (
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      )}

      {confirming === null ? null : (
        <ConfirmDialog
          title={CONFIRM_COPY[confirming].title}
          confirmLabel={CONFIRM_COPY[confirming].confirmLabel}
          pendingLabel={CONFIRM_COPY[confirming].pendingLabel}
          cancelLabel="그만두기"
          onConfirm={runConfirmed}
          onCancel={() => setConfirming(null)}
        >
          {confirming === 'rollback' ? (
            <>t{toTurnNo} 까지 접어요. 턴 · 스냅샷 · 요약이 함께 접히고, 되돌릴 수 없어요.</>
          ) : (
            <>
              t{session.turnNo} 을(를) 접고 같은 선택으로 다시 만들어요. 지금 본문은 사라지고,
              되돌릴 수 없어요.
            </>
          )}
        </ConfirmDialog>
      )}
    </>
  )
}

/**
 * `1j` 가 그렸지만 `debug` 응답에 없는 것.
 *
 * **없는 값을 상상해 채우지 않는다.** 비어 있는 화면은 돌아가는 것처럼 보이고, 관리자는
 * 콘솔이 다 보여 주고 있다고 믿은 채 판단하게 된다.
 */
function MissingFromContract() {
  return (
    <div className={styles.missing}>
      <p>
        <b>`1j` 가 그렸지만 계약이 주지 않는 것</b>
      </p>
      <p>
        작품 이름(응답은 `storyId` 만 준다) · 게임 상태의 해석된 항목(원문 JSON 하나로 온다) ·
        최근 턴의 선택지 문구(그 턴의 `chosenChoiceId` 까지다) · 비용(통화가 정해지지 않았다).
      </p>
    </div>
  )
}
