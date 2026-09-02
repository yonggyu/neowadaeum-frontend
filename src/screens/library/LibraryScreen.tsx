import type { ContinueSession, Genre } from '../../api/endpoints/library'
import css from './discovery.module.css'
import { AiNoticeFooter, ContinueTile, ErrorBlock, StoryTile, TileSkeleton } from './parts'
import { canLoadMore } from './sections'
import { useLibrary, type SectionState } from './useLibrary'

/** 스켈레톤 개수. 가장 좁은 폭(2열)에서도 그리드가 차 보이는 최소 수다. */
const SKELETON_COUNT = 4

/**
 * Story Library — 와이어프레임 1f · 1g · 3g · 4d.
 *
 * 스크롤 순서는 **이어하기 → 공식 → 커뮤니티** 로 고정한다. 그 순서와 "공식과 UGC 를 같은
 * 그리드에 섞지 않는다"(R13.1)는 화면의 취향이 아니라 규칙이며, 섹션을 만드는 쪽이 지킨다.
 */
export function LibraryScreen() {
  const library = useLibrary()
  const { resource, reload, visible, genreId, selectGenre, loadMore, retrySection } = library

  return (
    <main className={css.page} data-screen="LibraryScreen">
      <h1 className={css.headline}>당신의 다음 이야기를 선택하세요.</h1>

      {resource.status === 'failed' ? (
        <ErrorBlock error={resource.error} onRetry={reload} />
      ) : (
        <>
          <GenreChips
            genres={resource.status === 'ready' ? resource.data.genres : []}
            selected={genreId}
            onSelect={selectGenre}
          />

          {/* Empty(이어하기 없음) — 섹션 자체를 숨긴다 (1f) */}
          {resource.status === 'ready' && resource.data.continueSessions.length > 0 && (
            <ContinueSection sessions={resource.data.continueSessions} />
          )}

          {resource.status === 'loading' ? (
            <Grid>
              {Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <TileSkeleton key={i} />
              ))}
            </Grid>
          ) : (
            visible.map(({ key, state }) => (
              <StorySection
                key={key}
                state={state}
                onLoadMore={() => {
                  loadMore(key)
                }}
                onRetry={() => {
                  retrySection(key)
                }}
              />
            ))
          )}
        </>
      )}

      <AiNoticeFooter />
    </main>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className={css.grid}>{children}</div>
}

/** 장르 칩. 첫 칩 "추천"은 서버 섹션 구성을 그대로 보는 기본 상태다 — 장르가 아니다. */
function GenreChips({
  genres,
  selected,
  onSelect,
}: {
  genres: Genre[]
  selected: string | null
  onSelect: (genreId: string | null) => void
}) {
  const chip = (id: string | null, label: string) => (
    <button
      key={id ?? 'default'}
      type="button"
      className={`${css.chip} ${selected === id ? css.chipOn : ''}`}
      aria-pressed={selected === id}
      onClick={() => {
        onSelect(id)
      }}
    >
      {label}
    </button>
  )

  return (
    <div className={css.chips}>
      {chip(null, '추천')}
      {genres.map((genre) => chip(genre.genreId, genre.label))}
    </div>
  )
}

function ContinueSection({ sessions }: { sessions: ContinueSession[] }) {
  return (
    <section className={css.section} aria-labelledby="continue-heading">
      <div className={css.sectionHead}>
        <h2 className={css.sectionTitle} id="continue-heading">
          이어하기
        </h2>
      </div>
      <div className={css.continueList}>
        {sessions.map((session) => (
          <ContinueTile key={session.sessionId} session={session} />
        ))}
      </div>
    </section>
  )
}

/**
 * 섹션 하나. 실패해도 **그 섹션만** 오류로 바뀐다 (1f "Error — 섹션 단위 재시도").
 * 한 섹션의 실패로 화면 전체를 덮으면 멀쩡한 나머지까지 못 읽는다.
 */
function StorySection({
  state,
  onLoadMore,
  onRetry,
}: {
  state: SectionState
  onLoadMore: () => void
  onRetry: () => void
}) {
  const { section, error, pending } = state

  if (error !== null && section === null) {
    return (
      <section className={css.section}>
        <ErrorBlock error={error} onRetry={onRetry} />
      </section>
    )
  }

  if (section === null) {
    return (
      <section className={css.section}>
        <Grid>
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <TileSkeleton key={i} />
          ))}
        </Grid>
      </section>
    )
  }

  return (
    <section className={css.section}>
      <div className={css.sectionHead}>
        <h2 className={css.sectionTitle}>{section.sectionTitle}</h2>
      </div>

      {/* Empty(장르 결과 없음) — 1f 가 정한 문구다 */}
      {section.stories.length === 0 ? (
        <p className={css.notice}>준비 중인 장르예요.</p>
      ) : (
        <Grid>
          {section.stories.map((story) => (
            <StoryTile key={story.storyId} story={story} />
          ))}
        </Grid>
      )}

      {error !== null && <ErrorBlock error={error} onRetry={onRetry} />}

      {canLoadMore(section) && (
        <button
          type="button"
          className={`${css.button} ${css.buttonSmall} ${css.more}`}
          disabled={pending}
          onClick={onLoadMore}
        >
          {pending ? '불러오는 중…' : '더 보기'}
        </button>
      )}
    </section>
  )
}
