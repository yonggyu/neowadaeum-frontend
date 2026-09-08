import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { toApiError, type ApiError } from '../../api/client'
import { getStoryDetail, type CharacterCard, type MySessionBrief } from '../../api/endpoints/library'
// 세션 생성은 플레이 슬라이스의 것이다 (#22) — 탐색은 시작만 시킬 뿐 세션을 소유하지 않는다.
import { startSession } from '../../api/endpoints/play'
import { playPath, resumePath } from '../../routes/routes'
import { ReportDialog } from '../report/ReportDialog'
import { storyTarget } from '../report/report'
import { storyByline } from './author'
import css from './discovery.module.css'
import own from './story.module.css'
import { AiNoticeFooter, ErrorBlock } from './parts'
import { useResource } from './useResource'

/**
 * Story Detail — 와이어프레임 1h · 4d.
 *
 * `player_ref` 를 어디에도 쓰지 않는다 (F-6) — URL 에도, 화면에도, 로그에도. 작성자를 밝히는
 * 값은 `authorDisplayName` 하나뿐이고 계약도 그것만 준다.
 */
export function StoryDetailScreen() {
  const { storyId } = useParams<{ storyId: string }>()
  const load = useCallback(
    (signal: AbortSignal) => getStoryDetail(storyId ?? '', signal),
    [storyId],
  )
  const { resource, reload } = useResource(load)

  if (resource.status === 'loading') return <DetailSkeleton />
  // Error — Detail 은 전체 화면 재시도다 (1h). 부분만 실패할 수 있는 구조가 아니다.
  if (resource.status === 'failed') {
    return (
      <main className={css.page} data-screen="StoryDetailScreen">
        <ErrorBlock error={resource.error} onRetry={reload} />
      </main>
    )
  }

  const { story, characters, mySession, noticeText } = resource.data
  // `@yeonwoo · 사용자 작품` (4d). 닉네임이 없으면 종류만 남는다 — 이름을 지어내지 않는다.
  const byline = storyByline(story)

  return (
    <main className={css.page} data-screen="StoryDetailScreen">
      <div className={own.hero}>
        {story.heroImage !== null && (
          <img className={css.coverImage} src={story.heroImage} alt="" />
        )}
      </div>

      {/* ageRating 은 서버가 준 상수 문구를 그대로 쓴다 — 작품별 값이 아니다 (R10.1, I-19) */}
      <p className={own.tags}>{[...story.genres, story.ageRating].join(' · ')}</p>
      <h1 className={own.title}>{story.title}</h1>
      {byline !== '' && <p className={own.byline}>{byline}</p>}
      <p className={own.body}>{story.description}</p>

      <p className={own.counts}>
        <span>챕터 전체 {story.totalChapters}장</span>
        <span>엔딩 {story.totalEndings}개</span>
      </p>

      <StoryCta storyId={story.storyId} mySession={mySession} />

      {story.worldIntro !== '' && (
        <section className={own.detailSection}>
          <h2 className={css.sectionTitle}>WORLD</h2>
          <p className={own.body}>{story.worldIntro}</p>
        </section>
      )}

      {/* Empty — Character 가 없으면 섹션 자체를 숨긴다 (1h) */}
      {characters.length > 0 && (
        <section className={own.detailSection}>
          <h2 className={css.sectionTitle}>CHARACTERS</h2>
          <div className={own.characterRow}>
            {characters.map((character) => (
              <Character key={character.characterId} character={character} />
            ))}
          </div>
        </section>
      )}

      {/* 신고는 Play 와 이 화면 양쪽에서 열린다 (3c). 여기서 고를 수 있는 대상은 작품 하나다 */}
      <div className={own.detailSection}>
        <ReportButton storyId={story.storyId} title={story.title} />
      </div>

      {/* 고지문은 이 화면의 응답에서 온다 (백엔드 #257) — `/landing` 을 다시 부르지 않는다 */}
      <AiNoticeFooter text={noticeText} />
    </main>
  )
}

/** 신고 진입점 하나. 시트가 자기 상태(대상 · 사유 · 상세)를 들고 있으므로 여기 남는 것은 여닫기뿐이다. */
function ReportButton({ storyId, title }: { storyId: string; title: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={`${css.button} ${css.buttonSmall}`}
        onClick={() => setOpen(true)}
      >
        이 작품 신고하기
      </button>
      {open && (
        <ReportDialog
          targets={[storyTarget(storyId, title)]}
          returnLabel="작품으로 돌아가기"
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function Character({ character }: { character: CharacterCard }) {
  return (
    <div>
      <div className={own.portrait}>
        {character.portraitImage !== null && (
          <img className={css.coverImage} src={character.portraitImage} alt="" />
        )}
      </div>
      {/* 긴 이름은 2줄까지 허용하고 자른다 (1h) */}
      <p className={`${css.cardTitle} ${css.clamp2}`}>{character.name}</p>
      {character.role !== null && <p className={css.cardMeta}>{character.role}</p>}
      {character.oneLine !== null && (
        <p className={`${css.cardDesc} ${css.clamp2}`}>{character.oneLine}</p>
      )}
    </div>
  )
}

/**
 * CTA 는 진행 중 세션의 유무로 둘이다 (1h).
 *
 * 세션이 있으면 **"이어하기"가 Primary** 이고 시작 버튼은 "처음부터 다시"로 바뀐다. 이어하기는
 * Resume 화면(2e)이 세션 상태를 판정하는 자리이므로 그리로 보내고, 시작은 세션을 만드는
 * 요청이므로 여기서 부른다.
 */
function StoryCta({ storyId, mySession }: { storyId: string; mySession: MySessionBrief | null }) {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const start = () => {
    setPending(true)
    setError(null)
    startSession(storyId, { restart: mySession !== null }).then(
      (created) => {
        void navigate(playPath(created.sessionId))
      },
      (cause: unknown) => {
        setPending(false)
        setError(toApiError(cause))
      },
    )
  }

  return (
    <>
      <div className={own.ctaRow}>
        {mySession !== null && (
          <Link
            className={`${css.button} ${css.buttonPrimary}`}
            to={resumePath(mySession.sessionId)}
          >
            이어하기 · Ch.{mySession.chapterNo}
          </Link>
        )}
        <button
          type="button"
          className={`${css.button} ${mySession === null ? css.buttonPrimary : ''}`}
          disabled={pending}
          onClick={start}
        >
          {mySession === null ? '이야기 시작하기' : '처음부터 다시'}
        </button>
      </div>
      {error !== null && <ErrorBlock error={error} />}
    </>
  )
}

/** Loading — Hero 스켈레톤 + 텍스트 3줄 (1h). Hero 는 비율로만 자리를 잡는다. */
function DetailSkeleton() {
  return (
    <main className={css.page} data-screen="StoryDetailScreen" aria-busy="true">
      <div className={`${own.hero} ${css.skeleton}`} />
      <div className={own.detailSection}>
        <div className={`${css.skeletonLine} ${css.wMedium}`} />
        <div className={css.skeletonLine} />
        <div className={`${css.skeletonLine} ${css.wLong}`} />
      </div>
    </main>
  )
}
