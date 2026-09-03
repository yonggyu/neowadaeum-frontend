import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { createDraft, deleteDraft, listDrafts } from '../../api/endpoints/authoring'
import { authoringDraftPath } from '../../routes/routes'
import { ErrorNotice } from '../account/ErrorNotice'
import { formatRelativeTime } from '../account/relativeTime'
import { useResource } from '../library/useResource'
import css from './drafts.module.css'
import { isDraftLimitReached, STEP_COUNT, STEP_LABELS, toSummary, type DraftSummary } from './draft'

/**
 * 내 원고 목록 — 작품 만들기의 진입 (3g 의 "＋ 작품 만들기" 가 도착하는 곳).
 *
 * **My Stories 로는 원고에 들어갈 수 없다.** `MyStoryItem` 에 `draftId` 가 없어서(3f · #46)
 * "이어서 작성" 이 가리킬 대상이 없다 — `listDrafts` 가 `draftId` 를 주는 유일한 경로이고,
 * 그래서 이 화면이 따로 선다.
 *
 * **AI 고지 Footer 를 그리지 않는다.** 작품 만들기는 창작 도구 화면이며 감상 화면이 아니다
 * (백엔드 #291 의 §13-52). `listDrafts` 응답에 `noticeText` 가 아예 없다는 것이 같은 사실의
 * 다른 면이다 — 다른 화면의 `AiNoticeFooter` 를 여기 옮겨 오면 없는 값을 지어내야 한다.
 */
export function DraftsScreen() {
  const navigate = useNavigate()
  const { resource, reload } = useResource(useCallback((signal: AbortSignal) => listDrafts(signal), []))
  const [creating, setCreating] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)

  async function create(): Promise<void> {
    setCreating(true)
    setFailure(null)
    try {
      const draft = await createDraft()
      void navigate(authoringDraftPath(draft.draftId))
    } catch (error) {
      setFailure(error)
      setCreating(false)
    }
  }

  const drafts = resource.status === 'ready' ? resource.data.map(toSummary) : []

  return (
    <main className={css.page} data-screen="DraftsScreen">
      <header className={css.listHead}>
        <h1 className={css.pageTitle}>내 원고</h1>
        <button
          type="button"
          className={`${css.button} ${css.primary}`}
          onClick={() => void create()}
          disabled={creating}
        >
          {creating ? '만드는 중…' : '＋ 새 작품 만들기'}
        </button>
      </header>

      {failure === null ? null : <CreateFailure error={failure} />}

      {resource.status === 'loading' ? <p className={css.status}>불러오는 중…</p> : null}
      {resource.status === 'failed' ? <ErrorNotice error={resource.error} onRetry={reload} /> : null}
      {resource.status === 'ready' && drafts.length === 0 ? (
        <p className={css.status}>아직 쓰던 원고가 없어요. 새로 만들면 다섯 단계로 안내합니다.</p>
      ) : null}

      <ul className={css.list}>
        {drafts.map((draft) => (
          <DraftRow key={draft.draftId} draft={draft} onDeleted={reload} />
        ))}
      </ul>
    </main>
  )
}

/**
 * 새 원고를 만들지 못했을 때.
 *
 * **문구는 서버의 것을 그대로 낸다 (F-4).** 다만 `409` 하나에만 *무엇을 할 수 있는지*를
 * 덧붙인다 — 계약이 그 자리에 답을 적어 두었기 때문이다: *"닿으면 `409` 이며, 지우면 자리가
 * 난다."* 그 문장이 없으면 작성자는 막힌 이유는 알아도 나갈 길을 모른다.
 *
 * **상한 숫자를 적지 않는다.** 계약이 값을 주지 않고, 3e 도 확정 숫자를 삭제했다.
 */
function CreateFailure({ error }: { error: unknown }) {
  return (
    <div className={css.notice} role="alert">
      <p className={css.body}>{error instanceof Error ? error.message : String(error)}</p>
      {isDraftLimitReached(error) ? (
        <p className={css.meta}>쓰던 원고를 지우면 자리가 납니다.</p>
      ) : null}
    </div>
  )
}

/**
 * 원고 한 줄. 3g 의 "제목 없는 작품 · 작성 중 · Step 3까지 작성 · 이어서 작성 →" 그대로다.
 *
 * 삭제를 한 번 더 묻는다 — 되돌릴 수 없고, 여기가 개수 상한을 푸는 유일한 자리다.
 */
function DraftRow({ draft, onDeleted }: { draft: DraftSummary; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)

  async function remove(): Promise<void> {
    setDeleting(true)
    setFailure(null)
    try {
      await deleteDraft(draft.draftId)
      // 지운 뒤 목록을 다시 받는다 — 없어도 `204` 라 재시도해도 화면이 어긋나지 않는다.
      onDeleted()
    } catch (error) {
      setFailure(error)
      setDeleting(false)
    }
  }

  return (
    <li className={css.row}>
      <div className={css.rowMain}>
        <span className={css.rowTitle}>{draft.title}</span>
        <span className={css.meta}>
          {`STEP ${draft.step} / ${STEP_COUNT} · ${STEP_LABELS[draft.step - 1]}까지 작성 · ${formatRelativeTime(draft.updatedAt, Date.now())}`}
        </span>
        {/*
         * 무엇이 걸렸는지는 말하지 않는다 (F-5). 지금 상태가 진행할 수 없는 상태라는 것까지가
         * 이 화면이 아는 전부이며, 자리와 사유는 그 단계의 필드 옆에서 서버가 말한다.
         */}
        {draft.blocked ? <span className={css.badge}>수정이 필요한 곳이 있어요</span> : null}
      </div>
      <div className={css.rowActions}>
        <Link className={css.button} to={authoringDraftPath(draft.draftId)}>
          이어서 작성
        </Link>
        {confirming ? (
          <>
            <button type="button" className={css.button} onClick={() => void remove()} disabled={deleting}>
              {deleting ? '지우는 중…' : '정말 삭제'}
            </button>
            <button type="button" className={css.button} onClick={() => setConfirming(false)}>
              취소
            </button>
          </>
        ) : (
          <button type="button" className={css.button} onClick={() => setConfirming(true)}>
            삭제
          </button>
        )}
      </div>
      {confirming ? (
        <p className={css.meta}>지운 원고는 되돌릴 수 없습니다.</p>
      ) : null}
      {failure === null ? null : (
        <p className={css.meta} role="alert">
          {failure instanceof Error ? failure.message : String(failure)}
        </p>
      )}
    </li>
  )
}
