import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { getLibrarySection, type StoryCard } from '../../api/endpoints/library'
import { usePagedApi } from '../../hooks/usePagedApi'
import { ROUTES } from '../../routes/routes'
import css from './discovery.module.css'
import { ErrorBlock, StoryTile, TileSkeleton } from './parts'
import { isMissingSection, toCursorPage } from './sectionPage'
import { toApiError } from './useResource'

/** 스켈레톤 개수. 가장 좁은 폭(2열)에서도 그리드가 차 보이는 최소 수다. */
const SKELETON_COUNT = 4

/**
 * 섹션 전체 보기 — 3g 의 커뮤니티 헤더 “전체 보기 ›” 가 오는 곳.
 *
 * Library 에서 커뮤니티는 **맛보기**다. 3g 가 스크롤 순서를 이어하기 → 공식 → 커뮤니티로
 * 고정하면서 이유를 함께 적었다 — *"공식과 UGC 를 같은 그리드에 섞지 않는다"* (R13.1).
 * 그래서 전체 목록은 Library 를 늘리는 대신 이 화면이 맡는다. 여기 그리드에는 **한 섹션의
 * 작품만** 들어오므로 섞일 자리가 없다.
 *
 * `sectionKey` 를 경로에 담는다. 이것은 `recommended` · `genre:<key>` · `community` 셋 중
 * 하나이고 **작품·섹션의 식별자다** — `player_ref` 가 아니므로 URL 에 와도 된다 (F-6).
 * 화면에 나오는 작성자도 `authorDisplayName` 하나뿐이며 그 표기는 `author.ts` 가 정한다.
 *
 * **정렬·필터 컨트롤을 두지 않는다.** 계약에 정렬 파라미터가 없다 — 누를 수 있는데 아무 일도
 * 일어나지 않는 UI 가 된다.
 *
 * **AI 고지 Footer 가 없다.** `LibrarySection` 이 `noticeText` 를 싣지 않기 때문이다. 문구의
 * 기본값을 프론트에 두지 않고(R11.1), 이 화면만을 위해 `/landing` 을 따로 부르지도 않는다 —
 * 그 우회는 PR #36 이 이미 걷어냈고, 고지가 자기 응답과 다른 시점의 값이 되는 것이 요청 하나를
 * 아끼는 것보다 나빴다. 계약이 이 응답에 문구를 실어 주면 그때 붙인다.
 */
export function LibrarySectionScreen() {
  const { sectionKey } = useParams<{ sectionKey: string }>()
  const key = sectionKey ?? ''

  // 제목은 서버가 준다 — 화면이 섹션 이름을 지어내지 않는다. 섹션이 바뀌면 앞 섹션의 제목이
  // 남지 않도록 키와 함께 들고 있는다. 별도의 effect 로 지우는 것보다 어긋날 자리가 없다.
  const [titled, setTitled] = useState<{ key: string; title: string } | null>(null)
  const title = titled?.key === key ? titled.title : null

  const page = usePagedApi<StoryCard>(async (cursor, signal) => {
    const section = await getLibrarySection(key, cursor, signal)
    setTitled({ key, title: section.sectionTitle })
    return toCursorPage(section)
  }, key)

  // 첫 쪽이 실패했을 때만 화면 전체가 실패다. 다음 쪽 실패는 이미 읽은 목록을 지우지 않는다.
  const firstPageFailed = page.status === 'error' && page.items.length === 0

  if (firstPageFailed && isMissingSection(page.error)) {
    // 404 — 다시 시도해도 결과가 같다. 재시도 버튼 대신 나가는 길을 준다 (F-4).
    const error = toApiError(page.error)
    return (
      <main className={css.page} data-screen="LibrarySectionScreen">
        <div className={css.errorBlock} role="alert">
          <p className={css.errorMessage}>{error.message}</p>
          <Link className={`${css.button} ${css.buttonSmall}`} to={ROUTES.library}>
            Library
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className={css.page} data-screen="LibrarySectionScreen">
      {/*
       * 제목은 서버의 `sectionTitle` 이다. 아직 받지 못했으면 로딩이라고만 말하고, 실패한
       * 뒤에는 아무 말도 하지 않는다 — 실패한 화면이 "불러오는 중"이라고 적혀 있으면 그
       * 화면은 자기가 무슨 상태인지 두 가지로 말하는 것이 된다.
       */}
      {title !== null ? (
        <h1 className={css.headline}>{title}</h1>
      ) : page.status === 'loading' ? (
        <h1 className={css.headline} aria-busy="true">
          불러오는 중…
        </h1>
      ) : null}

      {firstPageFailed ? (
        <ErrorBlock error={toApiError(page.error)} onRetry={page.reload} />
      ) : page.status === 'loading' ? (
        <div className={css.grid}>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <TileSkeleton key={i} />
          ))}
        </div>
      ) : page.items.length === 0 ? (
        // Empty — “아직 없다”. 실패와 같아 보이면 안 되므로 role="alert" 도 재시도도 없다.
        <p className={css.notice}>아직 공개된 작품이 없어요.</p>
      ) : (
        <div className={css.grid}>
          {page.items.map((story) => (
            <StoryTile key={story.storyId} story={story} />
          ))}
        </div>
      )}

      {/* 다음 쪽만 실패한 경우. 이미 읽은 목록을 지우지 않고 오류만 알린다 */}
      {page.error !== null && page.items.length > 0 && (
        <ErrorBlock error={toApiError(page.error)} onRetry={page.loadMore} />
      )}

      {page.hasMore && (
        <button
          type="button"
          className={`${css.button} ${css.buttonSmall} ${css.more}`}
          disabled={page.loadingMore}
          onClick={page.loadMore}
        >
          {page.loadingMore ? '불러오는 중…' : '더 보기'}
        </button>
      )}
    </main>
  )
}
