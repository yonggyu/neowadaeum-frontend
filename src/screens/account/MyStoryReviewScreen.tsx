import { useCallback, useId, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import {
  appealStorySuspension,
  changeStoryVisibility,
  deleteStory,
  getDraftReview,
  type ReviewStatusResponse,
  type Visibility,
} from '../../api/endpoints/authoring'
import { getMyStories, type MyStoryItem } from '../../api/endpoints/me'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { usePagedApi } from '../../hooks/usePagedApi'
import { myStoryPath, ROUTES, storyDetailPath } from '../../routes/routes'
import { AiNoticeFooter } from '../library/parts'
import { useResource } from '../library/useResource'
import shared from './account.module.css'
import { draftPathOf, NO_DRAFT_NOTICE } from './draftLink'
import { ErrorNotice } from './ErrorNotice'
import styles from './MyStoryReviewScreen.module.css'
import { formatRelativeTime } from './relativeTime'
import {
  APPEAL_REASON_MAX,
  canSubmitAppeal,
  STORY_APPEAL_NOTICE,
  STORY_DELETE_NOTICE,
} from './storyActions'
import {
  isVisibilityReadOnly,
  narrowsExposure,
  REVIEW_STATUS_LABEL,
  reviewPhase,
  triggersHumanReview,
  VISIBILITY_HINT,
  VISIBILITY_LABEL,
  VISIBILITY_OPTIONS,
  visibilityBlockedReason,
} from './reviewStatus'

/**
 * 내 작품 — 공개 범위 · 검수 상태 (와이어프레임 3f · 6c).
 *
 * **좌 목록 / 우 상세 2열이고, 상태는 우측 패널만 교체한다** (6c) — `3f` 의 네 화면이 그 자리에
 * 그대로 들어간다. 상태마다 라우트를 나누지 않는 이유가 이것이다.
 *
 * **목록에서 상세로 갈 때 작품을 다시 받아오지 않는다.** `MyStoryItem` 이 `visibility` ·
 * `reviewStatus` · `rejectReasons` · `playCount` · `updatedAt` 를 이미 준다 — 상세가 작품
 * 쪽에서 더 갖는 것이 없다.
 *
 * **더 묻는 자리는 원고 쪽 하나다.** 반려 패널이 `getDraftReview` 로 원고의 검수 상태를
 * 직접 읽는다 — 작성자가 다음에 할 일이 그 원고를 고치는 것이기 때문이다. 가는 길은
 * `MyStoryItem.draftId` 이고 (backend #340, §13-66), 그 값이 `null` 인 작품에는 이 경로가
 * 없다 (§13-5 · §13-37). 그때 화면은 **빈 자리를 두지 않고 없다는 사실을 적는다.**
 */
export function MyStoryReviewScreen() {
  const { storyId } = useParams<{ storyId: string }>()
  const navigate = useNavigate()
  const id = storyId ?? ''
  const page = usePagedApi<MyStoryItem>((cursor, signal) => getMyStories({ cursor, signal }), 'authored')

  // 방금 바꾼 결과. `PATCH` 의 응답이 **변경 후 상태**이므로 목록을 다시 받지 않는다 —
  // 서버가 방금 준 진실을 버리고 같은 값을 다시 물어보는 셈이 되고, 넘겨 둔 쪽도 되감긴다.
  const [review, setReview] = useState<ReviewStatusResponse | null>(null)
  const stories = page.items.map((story) => merged(story, id, review))
  const selected = stories.find((story) => story.storyId === id) ?? null

  return (
    <main className={shared.page} data-screen="MyStoryReviewScreen">
      <div className={styles.layout}>
        <section className={styles.column} aria-label="내가 만든 작품">
          <h1 className={styles.columnTitle}>내가 만든 작품</h1>
          {page.status === 'loading' ? <p className={shared.status}>불러오는 중…</p> : null}
          {page.status === 'error' && page.items.length === 0 ? (
            <ErrorNotice error={page.error} onRetry={page.reload} />
          ) : null}
          <ul className={styles.list}>
            {stories.map((story) => (
              <li key={story.storyId}>
                <Link
                  className={styles.row}
                  to={myStoryPath(story.storyId)}
                  aria-current={story.storyId === id ? 'true' : undefined}
                >
                  <span className={styles.rowTitle}>{story.title}</span>
                  <span className={shared.badge}>{REVIEW_STATUS_LABEL[story.reviewStatus]}</span>
                </Link>
              </li>
            ))}
          </ul>
          {page.hasMore ? (
            <button
              type="button"
              className={`${shared.button} ${shared.wide}`}
              onClick={page.loadMore}
              disabled={page.loadingMore}
            >
              {page.loadingMore ? '불러오는 중…' : '더 보기'}
            </button>
          ) : null}
        </section>

        <section className={styles.detail} aria-label="작품 상태">
          {/* 390 에서만 보이는 뒤로 (6c — "목록 → 전체화면 상세, 뒤로 버튼") */}
          <Link className={styles.back} to={ROUTES.myStories}>
            ← 내 이야기
          </Link>
          {page.status === 'ready' && selected === null ? (
            <p className={shared.empty}>이 작품을 찾을 수 없어요.</p>
          ) : null}
          {selected === null ? null : (
            <StoryDetail
              story={selected}
              onReviewed={setReview}
              onDeleted={() => {
                /*
                 * 지운 작품은 목록에 오지 않는다 (§13-58) — 서버가 진실이므로 다시 받는다.
                 * 화면에서 한 줄만 빼면 실패한 삭제가 성공처럼 보인다 (1i 의 세션 삭제와
                 * 같은 판단). 지운 작품의 상세에 남아 있을 이유도 없으므로 목록으로 간다.
                 */
                page.reload()
                void navigate(ROUTES.myStories, { replace: true })
              }}
            />
          )}
        </section>
      </div>

      {/* 고지문은 이 화면이 이미 받은 응답의 것이다 (백엔드 #281). `/landing` 을 따로 부르지 않는다 */}
      {page.noticeText === null ? null : (
        <div className={styles.notice}>
          <AiNoticeFooter text={page.noticeText} />
        </div>
      )}
    </main>
  )
}

/** `PATCH` 가 돌려준 변경 후 상태를 목록 항목에 얹는다. 대상이 아니면 그대로 둔다. */
function merged(story: MyStoryItem, id: string, review: ReviewStatusResponse | null): MyStoryItem {
  if (review === null || story.storyId !== id) {
    return story
  }
  return {
    ...story,
    reviewStatus: review.reviewStatus,
    visibility: review.visibility,
    rejectReasons: review.rejectReasons,
    updatedAt: review.updatedAt,
  }
}

function StoryDetail({
  story,
  onReviewed,
  onDeleted,
}: {
  story: MyStoryItem
  onReviewed: (review: ReviewStatusResponse) => void
  onDeleted: () => void
}) {
  return (
    <>
      <h2 className={styles.title}>{story.title}</h2>
      <div className={styles.badges}>
        <span className={shared.badge}>{REVIEW_STATUS_LABEL[story.reviewStatus]}</span>
        <span className={shared.badge}>{VISIBILITY_LABEL[story.visibility]}</span>
      </div>
      {/*
       * 날짜는 `updatedAt` 하나뿐이다. 3f 의 "2월 21일 신청" · "2월 18일 승인"을 그리지 않는
       * 이유다 — `submittedAt` · `reviewedAt` 이 계약에 없다.
       */}
      <p className={shared.meta}>
        {`플레이 ${story.playCount}회 · ${formatRelativeTime(story.updatedAt, Date.now())} 갱신`}
      </p>

      <ReviewPanel story={story} />
      <VisibilityForm story={story} onReviewed={onReviewed} />
      <DeleteSection story={story} onDeleted={onDeleted} />
    </>
  )
}

/**
 * 상태 패널 — `3f` 의 네 화면이 들어오는 자리.
 *
 * **`auto_rejected` 를 따로 그리지 않는다.** `reviewPhase` 가 `rejected` 와 같은 칸으로
 * 접는다 — 계약이 *"내부 기록이며 사용자에게는 `rejected` 로 표시한다"* 고 정했다.
 */
function ReviewPanel({ story }: { story: MyStoryItem }) {
  const phase = reviewPhase(story.reviewStatus)

  if (phase === 'draft') {
    return (
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>작성 중</h3>
        <p className={shared.body}>아직 제출하지 않은 작품입니다.</p>
        <EditDraftAction draftId={story.draftId} />
      </section>
    )
  }

  if (phase === 'waiting') {
    return (
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>검수 중</h3>
        <p className={shared.body}>
          {story.reviewStatus === 'in_review'
            ? '자동 검수 통과 · 운영자 검토 대기'
            : '접수되었습니다. 자동 검수를 기다리고 있어요.'}
        </p>
        <p className={shared.meta}>운영자 검토는 보통 1~3일이 걸립니다.</p>
        {/* "신청 취소" 를 두지 않는다 — 계약에 그 오퍼레이션이 없다 */}
      </section>
    )
  }

  if (phase === 'approved') {
    return (
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>공개 중</h3>
        <p className={shared.body}>검수를 통과해 공개되어 있습니다.</p>
        <div className={shared.actions}>
          <Link className={shared.button} to={storyDetailPath(story.storyId)}>
            작품 보기
          </Link>
        </div>
      </section>
    )
  }

  if (phase === 'rejected') {
    return (
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>공개가 반려되었습니다</h3>
        {/*
         * 반려 사유는 **카테고리만** 온다 (백엔드 R8.7). 어떤 표현이 걸렸는지 추측해 덧붙이지
         * 않는다 (F-5) — 그것을 알려 주는 순간 무엇을 피하면 통과하는지를 알려 주는 것이 된다.
         * 원고에게 직접 물어도 오는 것은 같은 카테고리다.
         */}
        <h4 className={styles.panelSubtitle}>반려 사유</h4>
        <RejectReasons story={story} />
        <p className={shared.meta}>어떤 부분이 문제였는지는 카테고리로만 안내합니다.</p>
        <p className={shared.body}>수정한 뒤 다시 신청할 수 있습니다. 작품과 진행 내용은 삭제되지 않습니다.</p>
        <EditDraftAction draftId={story.draftId} />
      </section>
    )
  }

  if (phase === 'suspended') {
    return (
      <section className={styles.panel}>
        <h3 className={styles.panelTitle}>공개 정지</h3>
        <p className={shared.body}>신고가 접수되어 공개가 중지되었습니다.</p>
        <h4 className={styles.panelSubtitle}>현재 상태</h4>
        {/*
         * 새 턴이 막히는 것은 계약의 `423 STORY_SUSPENDED` 다 — 세션 시작과 턴 생성 둘 다에
         * 걸려 있고, 기존 기록 열람은 허용된다 (R8.10). 상태 코드 숫자는 화면에 쓰지 않는다.
         */}
        <ul className={styles.reasons}>
          <li>Library 노출 중단</li>
          <li>진행 중이던 이용자는 읽기 전용 — 새 턴을 만들 수 없습니다</li>
          <li>새로 시작할 수 없습니다</li>
        </ul>
        <p className={shared.body}>검토 후 복구되거나 삭제될 수 있습니다.</p>
        {/*
         * 3f 가 그린 [이의 제기] 가 이제 갈 곳을 갖는다 (`appealStorySuspension`, backend
         * #290). 문의하라고 적어 놓고 문의할 곳이 없으면 안내가 아니라 방치다.
         */}
        <AppealForm storyId={story.storyId} />
      </section>
    )
  }

  /*
   * `deleted` 는 이 화면에 오지 않는다 — 지운 작품은 `getMyStories` 가 돌려주지 않는다
   * (§13-58). 열거형에 있는 값이라 자리를 비워 두지 않을 뿐이고, 여기서 정지 패널을 그리면
   * 지운 작품이 정지된 것처럼 보인다.
   */
  return (
    <section className={styles.panel}>
      <h3 className={styles.panelTitle}>삭제됨</h3>
      <p className={shared.body}>이 작품은 삭제되어 더 이상 열리지 않습니다.</p>
    </section>
  )
}

/**
 * 반려 사유를 어디서 읽을 것인가 — **원고가 있으면 원고에게 묻는다.**
 *
 * 목록의 한 줄은 이 화면이 쪽을 받은 시점의 작품 값이고, `getDraftReview` 는 작성자가
 * **지금 고칠 원고**의 검수 상태다 (§13-66). 반려 화면에서 다음 행동이 그 원고를 여는
 * 것이므로, 그 원고가 무엇을 들고 있는지를 원고에게 묻는 편이 맞다.
 *
 * 원고가 없으면 (`draftId === null`) 물을 곳이 없다 — 목록이 준 값을 그대로 낸다.
 * 어느 쪽이든 오는 것은 **카테고리뿐**이다 (R8.7, F-5).
 */
function RejectReasons({ story }: { story: MyStoryItem }) {
  if (story.draftId === null) {
    return <ReasonList reasons={story.rejectReasons} />
  }
  return <DraftReviewReasons draftId={story.draftId} />
}

/** 원고 쪽 검수 상태 (`getDraftReview`). 세 상태를 모두 그린다 — 빈 자리를 두지 않는다. */
function DraftReviewReasons({ draftId }: { draftId: string }) {
  // `useResource` 는 매 렌더 새 함수를 받으면 무한히 다시 부른다 — 원고가 바뀔 때만 고쳐 준다.
  const load = useCallback((signal: AbortSignal) => getDraftReview(draftId, signal), [draftId])
  const { resource, reload } = useResource(load)

  if (resource.status === 'loading') {
    return (
      <p className={shared.meta} role="status">
        불러오는 중…
      </p>
    )
  }

  if (resource.status === 'failed') {
    return (
      <>
        {/*
         * 서버가 준 `message` 를 그대로 낸다 (F-4). 남의 원고는 `404` 이고 그것이 방어이므로
         * (I-8) 없는 원고와 구분해 말하지 않는다 — 구분하면 원고 id 를 훑어 남이 무엇을 쓰고
         * 있는지 알 수 있다.
         */}
        <p className={shared.meta} role="alert">
          {resource.error.message}
        </p>
        <div className={shared.actions}>
          <button type="button" className={shared.button} onClick={reload}>
            다시 시도
          </button>
        </div>
      </>
    )
  }

  const review = resource.data
  return (
    <>
      <ReasonList reasons={review.rejectReasons} />
      {/*
       * 원고가 작품보다 앞서 있을 수 있다 — 재제출은 작품을 늘리지 않고 같은 작품에 새 버전을
       * 얹는다 (R8.8). 그때 사유가 비는 것이 정상이며, 이 한 줄이 없으면 화면은 사유가 오지
       * 않았다고만 말하고 왜 비었는지는 말하지 않는다.
       */}
      {reviewPhase(review.reviewStatus) === 'rejected' ? null : (
        <p className={shared.meta}>
          {`원고 쪽 검수 상태는 지금 “${REVIEW_STATUS_LABEL[review.reviewStatus]}” 입니다.`}
        </p>
      )}
    </>
  )
}

/** 카테고리 목록. **비어 있는 것도 상태다** — 서버가 주지 않았다는 사실을 적는다. */
function ReasonList({ reasons }: { reasons: readonly string[] }) {
  if (reasons.length === 0) {
    return <p className={shared.meta}>사유 카테고리가 함께 오지 않았습니다.</p>
  }
  return (
    <ul className={styles.reasons}>
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  )
}

/**
 * 원고를 여는 버튼 — 없으면 **없다는 사실을 적는다.**
 *
 * 목록 화면은 이 자리에서 아무것도 그리지 않지만 (`MyStoriesScreen`), 반려 화면은 다르다:
 * 여기서 작성자가 다음에 무엇을 할지 정하고, 버튼만 조용히 빠지면 자기 작품만 다르게 보이는
 * 이유를 알 방법이 없다.
 */
function EditDraftAction({ draftId }: { draftId: string | null }) {
  const path = draftPathOf(draftId)
  if (path === null) {
    return <p className={shared.meta}>{NO_DRAFT_NOTICE}</p>
  }
  return (
    <div className={shared.actions}>
      <Link className={`${shared.button} ${shared.primary}`} to={path}>
        수정하러 가기
      </Link>
    </div>
  )
}

/**
 * 재검토 요청 (3f 의 [이의 제기], 계약 `appealStorySuspension`).
 *
 * **보내고 나서도 상태 패널은 "공개 정지" 그대로다.** 이 요청이 바꾸는 것은 기록과 검수
 * 큐의 신호뿐이고 (정정본 §13-59), 화면이 "재검토 중" 으로 바꿔 그리면 작성자가 검수 결과를
 * 되돌리는 것처럼 보인다 (I-8). 그래서 여기서 갈리는 것은 **이 폼의 자리뿐**이다 —
 * `reviewStatus` 를 건드리는 콜백이 이 컴포넌트에 아예 없다.
 *
 * **보낸 사유를 다시 그리지 않는다.** 유일한 독자가 검수자이며 (S-11) 응답도 그것을 돌려주지
 * 않는다. 관리자 전용 메모(`note`)도 이 화면이 읽지 않는다 (R8.7).
 */
function AppealForm({ storyId }: { storyId: string }) {
  const fieldId = useId()
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)

  async function submit(): Promise<void> {
    setSending(true)
    setFailure(null)
    try {
      await appealStorySuspension(storyId, reason)
      setSent(true)
    } catch (error) {
      // `409 ALREADY_EXISTS` · `409 STORY_NOT_SUSPENDED` · `404` 어느 쪽이든 서버의
      // `message` 를 그대로 낸다 (F-4). 남의 작품과 없는 작품을 구분해 말하지 않는다 (I-8).
      setFailure(error)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.appeal}>
      <h4 className={styles.panelSubtitle}>재검토 요청</h4>
      <ul className={styles.reasons}>
        {STORY_APPEAL_NOTICE.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {sent ? (
        <p className={shared.body} role="status">
          요청이 접수되었습니다.
        </p>
      ) : (
        <form
          className={styles.appealForm}
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label className={styles.appealLabel} htmlFor={fieldId}>
            어떤 점이 잘못되었는지 알려 주세요
          </label>
          {/*
           * 상한은 계약의 값이다 (`AppealRequest.maxLength`). 눌러 보기 전에 알려 주는
           * 안내이며, 방어는 서버가 한다.
           */}
          <textarea
            id={fieldId}
            className={styles.appealInput}
            rows={4}
            maxLength={APPEAL_REASON_MAX}
            value={reason}
            disabled={sending}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className={shared.meta}>{`${reason.length} / ${APPEAL_REASON_MAX}`}</p>
          {failure === null ? null : (
            <p className={shared.meta} role="alert">
              {failure instanceof Error ? failure.message : String(failure)}
            </p>
          )}
          <div className={shared.actions}>
            <button
              type="submit"
              className={shared.button}
              disabled={!canSubmitAppeal(reason) || sending}
            >
              {sending ? '보내는 중…' : '재검토 요청'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/**
 * 작품 삭제 (3f 의 [작품 삭제], 계약 `deleteStory`).
 *
 * **어느 상태에서도 있다.** 3f 는 이 버튼을 정지 화면에만 그렸지만 계약은 상태를 가리지
 * 않는다 (§13-58 — *"삭제는 어떤 판정도 되돌리지 않는다"*). 상태마다 있고 없는 버튼을 두면
 * 작성자는 지울 수 없는 작품이 있다고 읽고, 그 오해를 푸는 길이 화면에 없다.
 *
 * **판은 `ConfirmDialog` 다** (#63) — 6d 가 되돌릴 수 없는 동작을 Mobile 전체화면으로 정했고
 * 그 근거가 *"되돌릴 수 없는 동작이라 시트로 띄우지 않는다"* 이다.
 */
function DeleteSection({ story, onDeleted }: { story: MyStoryItem; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <section className={styles.panel}>
      <h3 className={styles.panelTitle}>작품 삭제</h3>
      <p className={shared.meta}>지운 작품은 되돌릴 수 없습니다.</p>
      <div className={shared.actions}>
        <button
          type="button"
          className={`${shared.button} ${styles.danger}`}
          onClick={() => setConfirming(true)}
        >
          작품 삭제
        </button>
      </div>

      {confirming ? (
        <ConfirmDialog
          title={`“${story.title}” 을 삭제할까요?`}
          confirmLabel="삭제합니다"
          pendingLabel="지우는 중…"
          cancelLabel="돌아가기"
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            await deleteStory(story.storyId)
            onDeleted()
          }}
        >
          {/*
           * **문구가 결과를 단정하지 않는다.** 무엇이 남고 무엇이 내려가는지는 계약이 정했고
           * (§13-58) 그 문장은 `storyActions.ts` 에 있다 — 금지어 테스트가 그것을 지킨다.
           */}
          <ul className={styles.deleteNotice}>
            {STORY_DELETE_NOTICE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </ConfirmDialog>
      ) : null}
    </section>
  )
}

/**
 * 공개 범위 (3f — "누구에게 보여줄까요?").
 *
 * **정지 상태에서는 읽기 전용이다** (6c). 그리고 `private → public` 은 이 오퍼레이션의 경로가
 * 아니다 (정정본 §13-48) — 이유를 말하고 막는다.
 */
function VisibilityForm({
  story,
  onReviewed,
}: {
  story: MyStoryItem
  onReviewed: (review: ReviewStatusResponse) => void
}) {
  const readOnly = isVisibilityReadOnly(story.reviewStatus)
  const [target, setTarget] = useState<Visibility>(story.visibility)
  /**
   * 노출을 좁힐 때만 한 번 더 묻는다.
   *
   * **`ConfirmDialog` 로 옮기지 않았다** (#63). 확인이 셋으로 모인 것은 *되돌릴 수 없는*
   * 동작이라는 한 가지 이유였는데(6d), 공개 중지는 되돌릴 수 있다 — 다시 넓히려면 검수를
   * 처음부터 받을 뿐이고, 그 사실을 아래 문장이 그대로 말한다. 3f 도 이 자리에 모달을
   * 그리지 않았고, 여기서는 라디오로 고른 값을 같은 버튼으로 한 번 더 누르는 것이 확인이다 —
   * 판을 띄우면 고른 값을 그 판에 다시 옮겨 적어야 한다. 모양이 비슷하다는 이유로 합치지 않는다.
   */
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)

  // 다른 작품으로 넘어가거나 서버가 새 상태를 주면 고르던 값을 버린다. 렌더 중에 맞추는
  // 편이 effect 보다 낫다 — effect 로 하면 한 프레임 동안 남의 작품 값이 선택돼 보인다.
  const [seen, setSeen] = useState({ id: story.storyId, visibility: story.visibility })
  if (seen.id !== story.storyId || seen.visibility !== story.visibility) {
    setSeen({ id: story.storyId, visibility: story.visibility })
    setTarget(story.visibility)
    setConfirming(false)
    setFailure(null)
  }

  const changed = target !== story.visibility
  const blocked = visibilityBlockedReason(story.visibility, target)
  const promotes = triggersHumanReview(story.visibility, target)

  async function submit(): Promise<void> {
    if (narrowsExposure(story.visibility, target) && !confirming) {
      setConfirming(true)
      return
    }
    setSaving(true)
    setFailure(null)
    try {
      onReviewed(await changeStoryVisibility(story.storyId, target))
      setConfirming(false)
    } catch (error) {
      setFailure(error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.panel}>
      <fieldset className={styles.fieldset} disabled={readOnly || saving}>
        <legend className={styles.panelTitle}>누구에게 보여줄까요?</legend>
        {VISIBILITY_OPTIONS.map((option) => {
          const reason = visibilityBlockedReason(story.visibility, option)
          return (
            <label key={option} className={styles.option}>
              <input
                type="radio"
                name={`visibility-${story.storyId}`}
                value={option}
                checked={target === option}
                disabled={reason !== null}
                onChange={() => {
                  setTarget(option)
                  setConfirming(false)
                }}
              />
              <span className={styles.optionText}>
                <span className={styles.optionLabel}>{VISIBILITY_LABEL[option]}</span>
                <span className={shared.meta}>{reason ?? VISIBILITY_HINT[option]}</span>
              </span>
            </label>
          )
        })}
      </fieldset>

      {readOnly ? (
        <p className={shared.meta}>정지된 작품은 공개 범위를 바꿀 수 없습니다.</p>
      ) : (
        <>
          {/*
           * 계약이 이 화면에 요구한 문장 — *"`unlisted → public` 승격은 재검수를 강제
           * 트리거한다."* 누르고 나서 목록에서 사라진 것을 발견하게 두지 않는다.
           */}
          {promotes ? (
            <p className={styles.warning} role="status">
              전체 공개는 사람이 직접 확인합니다. 신청하면 검수가 끝날 때까지 목록에서 내려가고,
              그동안 나만 플레이할 수 있어요. 보통 1~3일이 걸립니다.
            </p>
          ) : null}
          {confirming ? (
            <p className={styles.warning} role="alert">
              {`“${VISIBILITY_LABEL[target]}” 로 내리면 지금 보이던 곳에서 내려갑니다. 다시 넓히려면 검수를 처음부터 받습니다.`}
            </p>
          ) : null}
          {/* 서버가 준 `message` 를 그대로 낸다 (F-4). 문구를 화면이 짓지 않는다 */}
          {failure !== null ? (
            <p className={shared.meta} role="alert">
              {failure instanceof Error ? failure.message : String(failure)}
            </p>
          ) : null}
          <div className={shared.actions}>
            <button
              type="button"
              className={`${shared.button} ${shared.primary}`}
              disabled={!changed || blocked !== null || saving}
              onClick={() => void submit()}
            >
              {saving ? '보내는 중…' : confirming ? '확인' : promotes ? '공개 신청' : '공개 범위 변경'}
            </button>
            {confirming ? (
              <button type="button" className={shared.button} onClick={() => setConfirming(false)}>
                취소
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
