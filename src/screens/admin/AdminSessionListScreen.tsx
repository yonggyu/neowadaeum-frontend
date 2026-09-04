import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { listAdminSessions, type AdminSessionListItem } from '../../api/endpoints/admin'
import { usePagedApi } from '../../hooks/usePagedApi'
import { adminSessionDebugPath, ROUTES } from '../../routes/routes'
import { formatRelativeTime } from '../account/relativeTime'
import {
  filterChipLabel,
  hiddenTestCount,
  loadedCountLabel,
  normalizeStoryId,
  SESSION_BADGE_LABEL,
  SESSION_STATUS_LABEL,
  sessionBadges,
  sessionTitleLabel,
  turnChapterCompact,
  turnChapterVerbose,
  visibleSessions,
} from './sessionList'
import { failureMessage } from './twoFactor'
import styles from './adminSessions.module.css'

/**
 * 세션 목록 (7차 와이어프레임 `A-3`) — **Debug 콘솔에 들어가는 문**이다.
 *
 * **콘솔과 다른 층에 있다. 그것이 이 화면이 따로 있는 이유다** (정정본 §13-67).
 * `getSessionDebug` 는 원문(게임 상태 · 본문 · 프롬프트)을 열고 **읽을 때마다 감사 한 줄을
 * 남긴다** (백엔드 R12.3 · S-5). 목록이 그 층에 있으면 스무 줄을 그리는 것만으로 스무 개의
 * 열람 기록이 생기고, 그 로그는 더 이상 *"이 관리자가 이 세션을 봤다"* 를 말하지 못한다.
 * 그래서 **이 화면은 `getSessionDebug` 를 부르지 않는다** — 행을 그리려고도, 미리 채우려고도.
 * 콘솔은 사람이 행을 눌러 옮겨 갈 때 열리고, 그때 남는 한 줄이 진짜 열람이다 (#86 이 검수
 * 원고에 세운 규칙과 같다).
 *
 * **사람을 찾는 곳이 아니라 작품을 보는 곳이다.** 응답에 `playerRef` 가 없고 (백엔드 I-3),
 * 계약이 연 필터 축도 `storyId` 하나다 — 그래서 사람으로 좁히는 칸을 만들지 않는다 (F-6).
 *
 * **네 폭에서 성립한다** (F-9). 1024 이상은 표, 그 아래는 카드다 — 표를 가로로 밀지 않는다고
 * 아트보드의 390 판이 정했다. Admin 은 Desktop 이 기준 폭이지만 면제되는 화면은 없다.
 */
export function AdminSessionListScreen() {
  /*
   * 좁힌 작품은 URL 에 있다 — 검수 상세에서 `?storyId=` 로 건너오는 길이 그것이고, 상태를
   * 컴포넌트 안에만 두면 그 링크가 목적지에서 아무 일도 하지 않는다. **`player_ref` 가
   * 아니다** — 작품 식별자이고 계약이 쿼리로 연 값이다 (F-6).
   */
  const [params, setParams] = useSearchParams()
  const storyId = normalizeStoryId(params.get('storyId') ?? '')

  // 아직 서버로 나가지 않은 입력. URL 의 값과 나누는 이유는 글자 하나마다 목록을 다시 받지
  // 않기 위해서다 — 좁히기는 사람이 다 적고 나서 한 번 일어난다.
  const [draft, setDraft] = useState(storyId)
  const [includeTest, setIncludeTest] = useState(false)

  const page = usePagedApi<AdminSessionListItem>(
    (cursor, signal) => listAdminSessions({ storyId: storyId || undefined, cursor }, signal),
    // 좁힌 작품이 바뀌면 앞 목록을 버리고 처음부터 받는다. 커서는 그 조건에 딸린 값이라
    // 이어 쓰면 다른 조건의 다음 쪽을 받게 된다.
    storyId,
  )

  const shown = visibleSessions(page.items, includeTest)
  const folded = hiddenTestCount(page.items, includeTest)
  const firstPageFailed = page.status === 'error' && page.items.length === 0
  // 목록의 모든 행이 같은 기준 시각을 봐야 한다 — 행마다 부르면 경계에서 두 행이 다른 날을
  // 가리킨다 (`relativeTime` 이 `now` 를 인자로 받는 이유).
  const now = Date.now()

  return (
    <main className={styles.page} data-screen="AdminSessionListScreen">
      <header className={styles.bar}>
        <h1 className={styles.title}>ADMIN / SESSIONS</h1>
        <nav className={styles.tabs} aria-label="관리자 구역">
          <span className={styles.tab} aria-current="page">
            세션
          </span>
          <Link className={styles.tab} to={ROUTES.adminReviews}>
            검수 큐
          </Link>
        </nav>
      </header>

      <form
        className={styles.filters}
        onSubmit={(event) => {
          event.preventDefault()
          const next = normalizeStoryId(draft)
          setParams(next === '' ? {} : { storyId: next })
        }}
      >
        <input
          className={styles.search}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="작품 ID 로 좁히기"
          aria-label="작품 ID 로 좁히기"
        />

        {storyId === '' ? null : (
          <button
            type="button"
            className={`${styles.chip} ${styles.chipOn}`}
            onClick={() => {
              setDraft('')
              setParams({})
            }}
          >
            {/* 이름은 받아 온 세션이 말해 준 것만 쓴다 — 없으면 좁혔다는 사실만 적는다 */}
            {filterChipLabel(page.items)}
            <span aria-hidden="true">✕</span>
            <span className={styles.srOnly}>좁히기 해제</span>
          </button>
        )}

        <button
          type="button"
          className={includeTest ? `${styles.chip} ${styles.chipOn}` : styles.chip}
          aria-pressed={includeTest}
          onClick={() => setIncludeTest((on) => !on)}
        >
          테스트 세션 포함
        </button>

        <span className={styles.count}>{loadedCountLabel(shown.length, page.hasMore)}</span>
      </form>

      {/*
       * 이 구분을 화면이 사용자에게 말한다. 관리자가 "여기서 본 것도 기록되겠지" 라고 믿으면
       * 콘솔을 여는 것과 목록을 훑는 것이 같은 무게가 되고, 그러면 감사 로그의 뜻이 흐려진다.
       */}
      <p className={styles.notice}>
        이 목록은 <b>열람 기록을 남기지 않습니다</b> — 식별자와 메타데이터만 보여 주기
        때문입니다. 본문·게임 상태·프롬프트는 Debug 콘솔에서만 열리고, 그것은 기록이 남습니다.
      </p>

      {firstPageFailed ? (
        // 문구를 짓지 않는다 (F-4). `403` 이 역할·IP·2FA 중 무엇인지도 나누지 않는다 (S-6).
        <p className={styles.failure} role="alert">
          {failureMessage(page.error)}
        </p>
      ) : page.status === 'loading' ? (
        <p className={styles.failure}>세션을 찾는 중…</p>
      ) : shown.length === 0 ? (
        // Empty 는 실패가 아니다 — role="alert" 도 재시도 버튼도 두지 않는다.
        <p className={styles.failure}>
          {page.items.length === 0
            ? '이 조건으로 찾은 세션이 없어요.'
            : '실제 플레이 세션이 없어요. 테스트 세션만 있어요.'}
        </p>
      ) : (
        <SessionTable items={shown} now={now} />
      )}

      {/* 접은 건수를 말한다. 말없이 줄이면 목록이 짧아진 이유를 알 수 없다 */}
      {folded > 0 ? (
        <p className={styles.folded}>테스트 세션 {folded}건을 접어 뒀어요.</p>
      ) : null}

      {/* 다음 쪽만 실패한 경우. 이미 읽은 목록을 지우지 않고 오류만 알린다 */}
      {page.error !== null && page.items.length > 0 ? (
        <p className={styles.failure} role="alert">
          {failureMessage(page.error)}
        </p>
      ) : null}

      {page.hasMore ? (
        <button
          type="button"
          className={styles.more}
          disabled={page.loadingMore}
          onClick={page.loadMore}
        >
          {page.loadingMore ? '불러오는 중…' : '더 보기'}
        </button>
      ) : null}
    </main>
  )
}

/**
 * 목록. **1024 이상은 표, 그 아래는 카드다** — 마크업은 하나이고 CSS 가 접는다.
 *
 * 행 전체가 콘솔로 가는 링크다. 아트보드가 행 끝에 `›` 를 그렸고, 그 화살표만 링크로 두면
 * 390 에서 누를 자리가 20px 이 된다.
 */
function SessionTable({ items, now }: { items: readonly AdminSessionListItem[]; now: number }) {
  return (
    <div className={styles.table}>
      <div className={styles.head} aria-hidden="true">
        <span>작품</span>
        <span>상태</span>
        <span>턴 / 챕터</span>
        <span>표시</span>
        <span>마지막 갱신</span>
        <span />
      </div>

      {items.map((item) => (
        <Link key={item.sessionId} className={styles.row} to={adminSessionDebugPath(item.sessionId)}>
          <span
            className={item.storyTitle === null ? `${styles.story} ${styles.muted}` : styles.story}
          >
            {sessionTitleLabel(item.storyTitle)}
          </span>
          {/*
           * 셋을 한 겹으로 묶는다. 1024 이상에서는 `display: contents` 로 겹이 사라져 표의 칸
           * 셋이 되고, 그 아래에서는 카드의 메타 한 줄이다 — 마크업을 폭마다 나누지 않는다 (F-9).
           */}
          <span className={styles.meta}>
            <span className={styles.status}>{SESSION_STATUS_LABEL[item.status]}</span>
            <span className={styles.turns}>
              <span className={styles.wide}>{turnChapterCompact(item)}</span>
              <span className={styles.narrow}>{turnChapterVerbose(item)}</span>
            </span>
            <span className={styles.updated}>{formatRelativeTime(item.updatedAt, now)}</span>
          </span>
          {/* 붙을 것이 없으면 줄을 차지하지 않는다 — 빈 칸을 남기면 카드 높이가 들쭉해진다 */}
          <span className={styles.badges}>
            {sessionBadges(item).map((badge) => (
              <span key={badge} className={styles.badge}>
                {SESSION_BADGE_LABEL[badge]}
              </span>
            ))}
          </span>
          <span className={styles.chevron} aria-hidden="true">
            ›
          </span>
        </Link>
      ))}
    </div>
  )
}
