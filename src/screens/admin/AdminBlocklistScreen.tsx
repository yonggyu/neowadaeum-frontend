import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

import {
  hasAdminStepUp,
  listBlocklist,
  registerBlocklistEntry,
  removeBlocklistEntry,
  type BlocklistEntry,
} from '../../api/endpoints/admin'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ROUTES } from '../../routes/routes'
import { useResource } from '../library/useResource'
import { AdminTabBar } from './AdminTabBar'
import {
  BLOCKLIST_KINDS,
  BLOCKLIST_SEVERITIES,
  buildRegisterRequest,
  canRegister,
  displayedValue,
  EMPTY_DRAFT,
  kindLabel,
  KIND_LABEL,
  rowState,
  SEVERITY_CHOICE_LABEL,
  severityLabel,
  SOURCE_MAX_LENGTH,
  sourceLabel,
  toggleExpanded,
  valueCounter,
  VALUE_MAX_LENGTH,
  WARN_NOTICE,
  type RegisterDraft,
} from './blocklist'
import { failureMessage } from './twoFactor'
import styles from './adminBlocklist.module.css'

/**
 * 블록리스트 (8차 아트보드 `Blocklist` · `BlocklistMobile`).
 *
 * **이 목록이 곧 우회 사전이다.** 그래서 S-11 제약이 곧 이 화면의 설계다.
 *
 * 1. **값을 가리는 것이 기본이고 한 줄씩만 펼친다.** *'모두 펼치기'* 를 두지 않는다 —
 *    있으면 가린 적이 없는 것과 같다. 펼침은 로컬 상태이고 서버를 다시 부르지 않는다.
 * 2. **[지우기]는 펼친 줄에만 있다.** 가려진 값을 잘못 눌러 지우는 일이 구조적으로 없어지고,
 *    확인 판이 값을 새로 드러내지도 않는다 — 판이 적는 값은 이미 펼쳐 둔 그 값이다.
 * 3. **정규화 값 칸을 그리지 않는다.** 계약이 응답에서 뺀 값이며, 빈 칸을 그려 두면 다음
 *    사람이 그것을 채우려 든다. 그 자리에 *"여기에 두지 않습니다"* 를 적는다.
 * 4. **검색 · 필터 · 통계 · `id` 가 없다.** 계약에 질의가 없고, 응답이 주는 것은 다섯뿐이며,
 *    `id` 는 사람이 읽을 것이 없는 지우는 열쇠다.
 *
 * **네 폭에서 성립한다** (F-9). 1024 이상은 목록과 폼이 나란히 서고, 그 아래는 행이 카드가
 * 되며 폼은 접힌다 — 세로로 쌓으면 목록이 화면 밖으로 밀려 *"무엇이 이미 있는지"* 를 못 보고
 * 넣게 된다고 `BlocklistMobile` 이 적었다.
 */
export function AdminBlocklistScreen() {
  // `listBlocklist` 는 모듈 최상위 함수라 이미 고정돼 있다 — `useCallback` 으로 감싸지 않는다.
  const { resource, reload } = useResource(listBlocklist)

  // 펼친 줄 하나. 목록을 다시 받으면 접는다 — 다시 받은 목록의 같은 자리가 다른 항목일 수
  // 있고(관리자가 여럿이다), 그때 펼친 채로 두면 누르지 않은 값이 펼쳐진다.
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [removing, setRemoving] = useState<BlocklistEntry | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  /*
   * 승격이 끊겼으면 **문구를 그리지 않고 2FA 문으로 돌려보낸다** — 검수 큐가 쓰는 방식
   * 그대로다. 판단은 `403` 이 아니라 승격의 만료 시각으로만 한다: 관리자 경로의 `403` 은
   * 역할 · IP · 2FA 중 무엇이 어긋났는지 구분하지 않으므로 (S-4 · S-6), 그것을 만료로 읽으면
   * 화면이 서버가 하지 않은 판단을 하게 된다.
   */
  if (!hasAdminStepUp()) {
    return <Navigate to={ROUTES.adminAuth} replace />
  }

  function refresh(): void {
    setExpandedId(null)
    reload()
  }

  return (
    <main className={styles.page} data-screen="AdminBlocklistScreen">
      <header className={styles.bar}>
        <h1 className={styles.title}>ADMIN / BLOCKLIST</h1>
        <AdminTabBar current="blocklist" />
      </header>

      {/* 왜 가려져 있는지를 목록 위에서 말한다. 아래에서 말하면 이미 훑은 뒤다 */}
      <p className={styles.notice}>
        이 목록이 곧 <b>우회 사전</b>입니다. 값은 기본으로 가려 두고 필요한 줄만 펼칩니다 — 이
        화면은 화면 공유 · 스크린샷 · 버그 리포트에 함께 실립니다. 펼치기는 이미 받아 둔 응답을
        보여 주는 것이며 서버를 다시 부르지 않습니다.
      </p>

      {/* 390 에서만 보인다. 1024 이상에서는 폼이 늘 서 있으므로 여는 버튼이 필요 없다 */}
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={formOpen}
        onClick={() => setFormOpen((open) => !open)}
      >
        항목 추가
      </button>

      <div className={styles.split}>
        <section className={styles.list} aria-label="등록된 항목">
          <h2 className={styles.heading}>등록된 항목 · 최근 것부터</h2>
          {/* 서버가 준 순서를 다시 정렬하지 않는다 — 방금 넣은 것이 맨 위다 */}

          {resource.status === 'loading' ? (
            <p className={styles.state}>목록을 여는 중…</p>
          ) : resource.status === 'failed' ? (
            // 문구를 짓지 않는다 (F-4). `403` 이 셋 중 무엇인지도 나누지 않는다 (S-6).
            <p className={styles.state} role="alert">
              {failureMessage(resource.error)}
            </p>
          ) : resource.data.length === 0 ? (
            // 비어 있는 것은 실패가 아니다 — 요청이 성공한 사실이므로 화면이 쓴다.
            <p className={styles.state}>등록된 항목이 없습니다.</p>
          ) : (
            <ul className={styles.rows}>
              <li className={styles.head} aria-hidden="true">
                <span>종류</span>
                <span>값</span>
                <span>심각도</span>
                <span>출처</span>
              </li>
              {resource.data.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  expandedId={expandedId}
                  onToggle={() => setExpandedId((current) => toggleExpanded(current, entry.id))}
                  onRemove={() => setRemoving(entry)}
                />
              ))}
            </ul>
          )}

          {/*
           * 빈 칸을 그리지 않고 **없다는 사실을 적는다.** 계약이 정규화 값을 응답에서 뺀
           * 이유가 "내보내면 정규화가 무엇을 어떻게 모으는지가 드러난다" 이며, 열 자리만
           * 비워 두면 다음 사람이 그것을 채우려 든다.
           */}
          <p className={styles.absent}>
            여기에 <b>‘정규화 값’ 열을 두지 않습니다</b> — 응답에 아예 오지 않는 값입니다. 검색 ·
            미리보기 · “정규화하면 이렇게 됩니다” 안내도 같은 이유로 없습니다.
          </p>
        </section>

        <AddForm open={formOpen} onRegistered={refresh} />
      </div>

      {removing === null ? null : (
        <ConfirmDialog
          title="이 항목을 지울까요?"
          confirmLabel="지우기"
          pendingLabel="지우는 중…"
          cancelLabel="그만두기"
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            await removeBlocklistEntry(removing.id)
            setRemoving(null)
            // **다시 받는다.** 관리자가 여럿이므로 지운 줄만 빼면 그동안 바뀐 것을 놓친다.
            refresh()
          }}
        >
          <p className={styles.confirmMeta}>
            {kindLabel(removing.kind)} · {severityLabel(removing.severity)}
          </p>
          {/* 판이 값을 새로 드러내지 않는다 — 이미 펼쳐 둔 줄의 값이다 */}
          <p className={styles.confirmValue}>{removing.value}</p>
          <p>
            지우면 다음 판정부터 걸리지 않습니다. 되돌리는 문은 없습니다 — 다시 넣으려면 값을
            처음부터 다시 적어야 합니다.
          </p>
        </ConfirmDialog>
      )}
    </main>
  )
}

/**
 * 한 줄. **값이 곧 펼치는 자리다** (`BlocklistMobile`) — 가려져 있어도 그 자리가 값의 자리라는
 * 것이 보여야 어디를 눌러야 할지 안다. 390 에서는 이 줄이 카드가 되고 값이 카드의 제목이다.
 *
 * 삭제 아이콘 버튼을 줄에 두지 않는다. 44px 아이콘 둘이 나란히 있으면 가려진 값을 잘못 눌러
 * 지우게 된다.
 */
function EntryRow({
  entry,
  expandedId,
  onToggle,
  onRemove,
}: {
  entry: BlocklistEntry
  expandedId: string | null
  onToggle: () => void
  onRemove: () => void
}) {
  const { revealed, canRemove } = rowState(entry, expandedId)

  return (
    <li className={styles.row} data-open={revealed}>
      <button type="button" className={styles.value} aria-expanded={revealed} onClick={onToggle}>
        {/* 가림 문자는 낭독기가 읽을 것이 아니다 — 무엇을 하는 버튼인지만 읽힌다 */}
        <span aria-hidden={!revealed}>{displayedValue(entry, expandedId)}</span>
        <span className={styles.srOnly}>{revealed ? '값 감추기' : '값 펼치기'}</span>
      </button>
      {/*
       * 1024 이상에서는 `display: contents` 로 이 겹이 사라져 표의 칸 셋이 되고 (`order` 가
       * 아트보드의 칸 순서를 지킨다), 그 아래에서는 카드의 메타 한 줄이 된다 — 마크업을
       * 폭마다 나누지 않는다 (F-9).
       */}
      <span className={styles.meta}>
        <span className={styles.kind}>{kindLabel(entry.kind)}</span>
        <span className={styles.severity}>{severityLabel(entry.severity)}</span>
        <span className={styles.source}>{sourceLabel(entry.source)}</span>
      </span>
      {canRemove ? (
        <button type="button" className={styles.remove} onClick={onRemove}>
          지우기
        </button>
      ) : null}
    </li>
  )
}

/**
 * 항목 추가.
 *
 * **등록 뒤에 목록을 다시 받는다** — 응답이 만들어진 항목 하나를 주지만 그것만 앞에 끼워
 * 넣으면 다른 관리자가 그동안 넣은 것이 보이지 않는다.
 */
function AddForm({ open, onRegistered }: { open: boolean; onRegistered: () => void }) {
  const [draft, setDraft] = useState<RegisterDraft>(EMPTY_DRAFT)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!canRegister(draft, pending)) {
      return
    }
    setPending(true)
    setFailure(null)
    try {
      await registerBlocklistEntry(buildRegisterRequest(draft))
      // 종류와 심각도는 남긴다 — 같은 종류를 여러 개 넣는 자리다. 값과 출처만 비운다.
      setDraft((current) => ({ ...current, value: '', source: '' }))
      onRegistered()
    } catch (error) {
      setFailure(error)
    } finally {
      setPending(false)
    }
  }

  return (
    <form className={styles.form} data-open={open} onSubmit={(event) => void submit(event)}>
      <h2 className={styles.heading}>항목 추가</h2>

      <fieldset className={styles.field}>
        {/* 넷뿐이다. 계약의 값이고 화면이 늘리지 않는다 */}
        <legend className={styles.label}>종류</legend>
        <div className={styles.choices}>
          {BLOCKLIST_KINDS.map((kind) => (
            <label key={kind} className={styles.choice}>
              <input
                type="radio"
                name="kind"
                value={kind}
                checked={draft.kind === kind}
                onChange={() => setDraft((current) => ({ ...current, kind }))}
              />
              {KIND_LABEL[kind]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className={styles.field}>
        <span className={styles.label}>값</span>
        <input
          className={styles.input}
          value={draft.value}
          maxLength={VALUE_MAX_LENGTH}
          onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
        />
        <span className={styles.counter}>{valueCounter(draft.value)}</span>
        {/* 다듬지 않고 보낸다 — 공백도 대소문자도 그대로다. 정규화는 서버가 한다 */}
        <span className={styles.help}>
          사람이 읽는 값 그대로 보냅니다 — 공백도 대소문자도 다듬지 않습니다.
        </span>
      </label>

      <fieldset className={styles.field}>
        <legend className={styles.label}>심각도</legend>
        <div className={styles.choices}>
          {BLOCKLIST_SEVERITIES.map((severity) => (
            <label key={severity} className={styles.choice}>
              <input
                type="radio"
                name="severity"
                value={severity}
                checked={draft.severity === severity}
                onChange={() => setDraft((current) => ({ ...current, severity }))}
              />
              {SEVERITY_CHOICE_LABEL[severity]}
            </label>
          ))}
        </div>
        {/*
         * **고르는 자리에 선다** (§13-31). 고른 뒤에 알리면 늦다 — 이 문장이 없으면 운영자는
         * 등록했다고 믿는데 서비스는 통과시킨다.
         */}
        <span className={styles.warn}>{WARN_NOTICE}</span>
      </fieldset>

      <label className={styles.field}>
        <span className={styles.label}>출처 · 선택</span>
        <input
          className={styles.input}
          value={draft.source}
          maxLength={SOURCE_MAX_LENGTH}
          placeholder="어디서 왔는지"
          onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))}
        />
        <span className={styles.help}>사후에 근거를 되짚는 칸입니다. 비워도 됩니다.</span>
      </label>

      <button type="submit" className={styles.submit} disabled={!canRegister(draft, pending)}>
        {pending ? '등록하는 중…' : '등록'}
      </button>

      {/*
       * `409` 를 포함해 **서버 문장 그대로**다 (F-4). 어느 항목과 겹쳤는지 가리키지 않는다 —
       * 겹침은 정규화 값끼리의 일이고, 가리키면 정규화가 무엇을 같게 보는지를 알려 주는 셈이다.
       */}
      {failure === null ? null : (
        <p className={styles.failure} role="alert">
          {failureMessage(failure)}
        </p>
      )}

      <p className={styles.help}>
        등록하면 다음 판정부터 걸립니다. 이미 만들어진 턴을 되돌리지는 않습니다.
      </p>
    </form>
  )
}
