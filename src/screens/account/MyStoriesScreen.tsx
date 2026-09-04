import { useState } from 'react'
import { Link } from 'react-router-dom'

import {
  deleteMySession,
  getMySessions,
  getMyStories,
  type MySessionItem,
  type MyStoryItem,
} from '../../api/endpoints/me'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { usePagedApi, type PagedApi } from '../../hooks/usePagedApi'
import { myStoryPath, resumePath, ROUTES, storyDetailPath } from '../../routes/routes'
import { AiNoticeFooter } from '../library/parts'
import shared from './account.module.css'
import { draftPathOf } from './draftLink'
import { ErrorNotice } from './ErrorNotice'
import styles from './MyStoriesScreen.module.css'
import { formatRelativeTime } from './relativeTime'
import { REVIEW_STATUS_LABEL, VISIBILITY_LABEL } from './reviewStatus'

/**
 * 내 이야기 — 3탭 (와이어프레임 1i · 3g).
 *
 * 탭 셋이 오퍼레이션 둘을 쓴다. 진행 중 · 완료는 같은 `GET /me/sessions` 의 `status` 차이이고
 * (`active` · `completed` **둘뿐**이다 — `in_progress` 는 존재하지 않는 값이었다),
 * 내가 만든 작품은 `GET /me/stories` 다.
 *
 * 상단에 사용자 정보를 두지 않는다. `/api/v1/me` 에는 `DELETE` 하나뿐이고 `GET` 이 없어서
 * 내 정보를 읽을 경로가 없다 (3g 의 "삭제한 항목"). `player_ref` 도 오지 않는다 (F-6).
 */
const TABS = [
  { key: 'active', label: '진행 중' },
  { key: 'completed', label: '완료' },
  { key: 'authored', label: '내가 만든 작품' },
] as const

type TabKey = (typeof TABS)[number]['key']

export function MyStoriesScreen() {
  const [tab, setTab] = useState<TabKey>('active')

  return (
    <main className={shared.page} data-screen="MyStoriesScreen">
      <div className={styles.wide}>
        <h1 className={shared.pageTitle}>내 이야기</h1>

        <div className={styles.tabs} role="tablist">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={tab === entry.key}
              className={`${styles.tab} ${tab === entry.key ? styles.tabSelected : ''}`}
              onClick={() => setTab(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {tab === 'authored' ? <AuthoredTab /> : <SessionsTab status={tab} />}
        </div>
      </div>
    </main>
  )
}

/** 진행 중 · 완료. 같은 오퍼레이션의 `status` 차이라 컴포넌트도 하나다. */
function SessionsTab({ status }: { status: 'active' | 'completed' }) {
  const page = usePagedApi<MySessionItem>(
    (cursor, signal) => getMySessions(status, { cursor, signal }),
    status,
  )
  const [pendingDelete, setPendingDelete] = useState<MySessionItem | null>(null)
  const now = Date.now()

  return (
    <PagedList
      page={page}
      empty="아직 시작한 이야기가 없어요."
      emptyAction={
        <Link className={`${shared.button} ${shared.primary}`} to={ROUTES.library}>
          작품 둘러보기
        </Link>
      }
    >
      {page.items.map((session) => (
        <article key={session.sessionId} className={shared.card}>
          <Cover src={session.coverImage} />
          <div className={styles.cardBody}>
            <h2 className={styles.cardTitle}>{session.title}</h2>
            <p className={shared.meta}>
              {`Ch.${session.chapterNo} / ${session.totalChapters}장 · ${formatRelativeTime(session.updatedAt, now)}`}
            </p>
            <div className={styles.cardActions}>
              <Link className={`${shared.button} ${shared.primary}`} to={resumePath(session.sessionId)}>
                이어하기
              </Link>
              <Link className={shared.button} to={storyDetailPath(session.storyId)}>
                처음부터
              </Link>
              <button
                type="button"
                className={shared.button}
                onClick={() => setPendingDelete(session)}
              >
                삭제
              </button>
            </div>
          </div>
        </article>
      ))}
      {pendingDelete !== null ? (
        <DeleteDialog
          session={pendingDelete}
          onClose={() => setPendingDelete(null)}
          onDeleted={() => {
            setPendingDelete(null)
            // 서버가 진실이다. 지운 뒤 목록을 다시 받는다 — 화면에서 한 줄만 빼면
            // 실패한 삭제가 성공처럼 보인다.
            page.reload()
          }}
        />
      ) : null}
    </PagedList>
  )
}

/**
 * 내가 만든 작품.
 *
 * "상태 보기" 의 목적지는 `3f` · `6c` 의 공개 범위 · 검수 상태 화면이고, 그것이
 * `MyStoryReviewScreen` 이다.
 *
 * **"이어서 작성" 은 줄마다 있지 않다.** 마법사는 `/authoring/drafts/:draftId` 에 서 있고
 * 그 줄에서 원고를 가리키는 것은 `draftId` 하나인데 (backend #340, §13-66), 그 값이
 * **`null` 인 작품이 실제로 있다** — 미리보기가 만든 임시 작품은 원고와 연결되지 않는다
 * (§13-5 · §13-37). 그 줄에 버튼을 그리면 눌러 보기 전까지 있는 것처럼 보인다. 판정은
 * `draftPathOf` 하나가 하고 이 화면은 그 결과만 본다.
 */
function AuthoredTab() {
  const page = usePagedApi<MyStoryItem>((cursor, signal) => getMyStories({ cursor, signal }), 'authored')
  const now = Date.now()

  return (
    <PagedList page={page} empty="아직 만든 작품이 없어요.">
      {page.items.map((story) => (
        <article key={story.storyId} className={shared.card}>
          <Cover src={story.coverImage} />
          <div className={styles.cardBody}>
            <h2 className={styles.cardTitle}>{story.title}</h2>
            <div className={styles.badges}>
              <span className={shared.badge}>{REVIEW_STATUS_LABEL[story.reviewStatus]}</span>
              <span className={shared.badge}>{VISIBILITY_LABEL[story.visibility]}</span>
            </div>
            <p className={shared.meta}>
              {`플레이 ${story.playCount} · ${formatRelativeTime(story.updatedAt, now)}`}
            </p>
            {/*
             * 반려 사유는 **카테고리만** 온다. 서버가 준 것 이상을 추측해 보여 주지 않는다
             * (F-5, 백엔드 R8.7) — 어떤 표현이 걸렸는지 알려 주면 그것이 우회 실마리가 된다.
             */}
            {story.rejectReasons.length > 0 ? (
              <p className={shared.meta}>{story.rejectReasons.join(' · ')}</p>
            ) : null}
            <div className={styles.cardActions}>
              <Link className={shared.button} to={myStoryPath(story.storyId)}>
                상태 보기
              </Link>
              <ContinueWriting draftId={story.draftId} />
            </div>
          </div>
        </article>
      ))}
    </PagedList>
  )
}

/**
 * 원고로 가는 버튼. **없으면 아무것도 그리지 않는다.**
 *
 * 줄마다 *"원고가 없습니다"* 를 적지 않는다 — 목록에서 그것은 안내가 아니라 소음이고,
 * 그 사실이 필요한 자리는 작성자가 다음에 무엇을 할지 정하는 상세 화면이다
 * (`MyStoryReviewScreen` 이 `NO_DRAFT_NOTICE` 로 적는다).
 */
function ContinueWriting({ draftId }: { draftId: string | null }) {
  const path = draftPathOf(draftId)
  if (path === null) {
    return null
  }
  return (
    <Link className={`${shared.button} ${shared.primary}`} to={path}>
      이어서 작성
    </Link>
  )
}

/**
 * 목록 하나의 상태 — Loading / Empty / 목록 / Error (1k 상태 매트릭스).
 *
 * 탭 셋이 같은 네 상태를 갖는다. 모양이 비슷해서가 아니라 **계약의 목록 응답이 같은
 * 규약**이기 때문에 하나로 둔다.
 */
function PagedList({
  page,
  empty,
  emptyAction,
  children,
}: {
  page: PagedApi<unknown>
  empty: string
  emptyAction?: React.ReactNode
  children: React.ReactNode
}) {
  if (page.status === 'loading') {
    return withNotice(page, <p className={shared.status}>불러오는 중…</p>)
  }
  if (page.status === 'error' && page.items.length === 0) {
    return withNotice(page, <ErrorNotice error={page.error} onRetry={page.reload} />)
  }
  if (page.items.length === 0) {
    return withNotice(
      page,
      <div className={shared.empty}>
        <p className={shared.body}>{empty}</p>
        {emptyAction === undefined ? null : <div className={shared.actions}>{emptyAction}</div>}
      </div>,
    )
  }

  return withNotice(
    page,
    <>
      <div className={styles.list}>{children}</div>
      {page.hasMore ? (
        <div className={styles.more}>
          <button
            type="button"
            className={shared.button}
            onClick={page.loadMore}
            disabled={page.loadingMore}
          >
            {page.loadingMore ? '불러오는 중…' : '더 보기'}
          </button>
        </div>
      ) : null}
      {/* 다음 쪽만 실패한 경우. 이미 읽은 목록은 그대로 두고 실패 사실만 알린다 */}
      {page.error !== null && page.items.length > 0 ? (
        <p className={shared.meta} role="alert">
          {page.error instanceof Error ? page.error.message : String(page.error)}
        </p>
      ) : null}
    </>,
  )
}

/**
 * 고지문을 목록 아래에 붙인다.
 *
 * **두 번째 Footer 를 만들지 않는다** — Library 가 쓰는 `AiNoticeFooter` 그대로다. 문구는
 * 이 탭이 이미 받은 응답의 `noticeText` 이고 (백엔드 #281), 탭마다 자기 응답의 것을 낸다.
 * `/landing` 을 따로 부르면 같은 화면에서 다른 시점의 문구가 보인다 (#257).
 */
function withNotice(page: PagedApi<unknown>, body: React.ReactNode): React.ReactNode {
  return (
    <>
      {body}
      {page.noticeText === null ? null : <AiNoticeFooter text={page.noticeText} />}
    </>
  )
}

function Cover({ src }: { src: string | null }) {
  if (src === null) {
    return <div className={shared.cover} aria-hidden="true" />
  }
  return <img className={shared.cover} src={src} alt="" />
}

/**
 * 삭제 확인 (1i — "삭제(확인 Modal)").
 *
 * 판은 `ConfirmDialog` 다 — 되돌릴 수 없는 동작 앞의 확인이 셋이 되면서 하나로 모았다(#63).
 * 진행 기록을 지우는 자리가 여기 하나이고 (3g), 두 번 지워도 서버가 `204` 로 답하므로
 * (백엔드 §13-26) 재시도가 화면을 어긋나게 하지 않는다.
 */
function DeleteDialog({
  session,
  onClose,
  onDeleted,
}: {
  session: MySessionItem
  onClose: () => void
  onDeleted: () => void
}) {
  return (
    <ConfirmDialog
      title={`“${session.title}” 의 진행 기록을 지울까요?`}
      confirmLabel="삭제"
      pendingLabel="지우는 중…"
      cancelLabel="취소"
      onCancel={onClose}
      onConfirm={async () => {
        await deleteMySession(session.sessionId)
        onDeleted()
      }}
    >
      지운 기록은 되돌릴 수 없습니다.
    </ConfirmDialog>
  )
}
