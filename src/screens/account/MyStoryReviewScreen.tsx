import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { changeStoryVisibility, type ReviewStatusResponse, type Visibility } from '../../api/endpoints/authoring'
import { getMyStories, type MyStoryItem } from '../../api/endpoints/me'
import { usePagedApi } from '../../hooks/usePagedApi'
import { myStoryPath, ROUTES, storyDetailPath } from '../../routes/routes'
import { AiNoticeFooter } from '../library/parts'
import shared from './account.module.css'
import { ErrorNotice } from './ErrorNotice'
import styles from './MyStoryReviewScreen.module.css'
import { formatRelativeTime } from './relativeTime'
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
 * **목록에서 상세로 갈 때 다시 받아오지 않는다.** `MyStoryItem` 이 `visibility` ·
 * `reviewStatus` · `rejectReasons` · `playCount` · `updatedAt` 를 이미 준다 — 상세가 더 갖는
 * 것이 없다. `getDraftReview` 로 갈 수도 없다: `MyStoryItem` 에 `draftId` 가 없다.
 */
export function MyStoryReviewScreen() {
  const { storyId } = useParams<{ storyId: string }>()
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
            <StoryDetail story={selected} onReviewed={setReview} />
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
}: {
  story: MyStoryItem
  onReviewed: (review: ReviewStatusResponse) => void
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
         */}
        {story.rejectReasons.length > 0 ? (
          <>
            <h4 className={styles.panelSubtitle}>반려 사유</h4>
            <ul className={styles.reasons}>
              {story.rejectReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        ) : null}
        <p className={shared.meta}>어떤 부분이 문제였는지는 카테고리로만 안내합니다.</p>
        <p className={shared.body}>수정한 뒤 다시 신청할 수 있습니다. 작품과 진행 내용은 삭제되지 않습니다.</p>
        {/* "수정하러 가기" 를 두지 않는다 — 작품 만들기 화면이 아직 없다 */}
      </section>
    )
  }

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
       * "이의 제기" 와 "작품 삭제" 를 두지 않는다 — 둘 다 계약에 경로가 없다. `DELETE` 는
       * 세션 · 계정 · 원고 · 관리자 블록리스트뿐이고, 이의 제기는 아예 없다.
       */}
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
