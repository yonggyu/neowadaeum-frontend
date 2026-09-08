import { Link } from 'react-router-dom'

import type { ApiError } from '../../api/client'
import type { ContinueSession, StoryCard } from '../../api/endpoints/library'
import { ROUTES, resumePath, storyDetailPath } from '../../routes/routes'
import { storyCardMeta } from './author'
import css from './discovery.module.css'

/** 커버 자리. 이미지가 `null` 이어도 **비율은 유지한다** — 그리드가 흔들리지 않는다. */
function Cover({ src, alt, isNew }: { src: string | null; alt: string; isNew?: boolean }) {
  return (
    <div className={css.cover}>
      {src !== null && <img className={css.coverImage} src={src} alt={alt} loading="lazy" />}
      {isNew === true && <span className={css.badge}>NEW</span>}
    </div>
  )
}

/**
 * 작품 카드.
 *
 * 공식과 사용자 작품을 **같은 그리드에 섞지 않는다** (R13.1). 그 분리는 섹션이 하고, 카드는
 * 계약이 준 닉네임이 있을 때만 작성자를 표기한다 — `@yeonwoo · 판타지` (3g · 4d).
 *
 * 메타는 **한 줄로 자른다.** 닉네임은 길이를 우리가 정하지 못하는 사용자 값이고, 390 의 2열
 * 카드에서 이 줄이 두세 줄로 늘면 같은 행의 카드 높이가 서로 어긋난다.
 */
export function StoryTile({ story }: { story: StoryCard }) {
  const meta = storyCardMeta(story)

  return (
    <Link className={css.card} to={storyDetailPath(story.storyId)}>
      <Cover src={story.coverImage} alt="" isNew={story.isNew} />
      <h3 className={`${css.cardTitle} ${css.clamp2}`}>{story.title}</h3>
      {meta !== '' && <p className={`${css.cardMeta} ${css.clamp1}`}>{meta}</p>}
      <p className={`${css.cardDesc} ${css.clamp2}`}>{story.shortDescription}</p>
    </Link>
  )
}

/**
 * 이어하기 카드.
 *
 * **진행바를 그리지 않는다** — `progressPercent` 가 계약에 없다 (R13.2). AI 생성이라 챕터당
 * 턴 수가 가변이어서 백분율에 근거가 없고, 없는 근거로 막대를 그리면 그 막대가 거짓말을 한다.
 */
export function ContinueTile({ session }: { session: ContinueSession }) {
  return (
    <Link className={css.continueCard} to={resumePath(session.sessionId)}>
      <Cover src={session.coverImage} alt="" />
      <span className={css.continueBody}>
        <span className={`${css.cardTitle} ${css.clamp2}`}>{session.title}</span>
        <span className={css.cardMeta}>
          Chapter {session.chapterNo} / 전체 {session.totalChapters}장
        </span>
        {session.lastSceneSummary !== null && (
          <span className={`${css.cardDesc} ${css.clamp2}`}>{session.lastSceneSummary}</span>
        )}
      </span>
    </Link>
  )
}

/** Loading — 커버 비율을 유지한 스켈레톤 (1f). 비율이 틀리면 로딩이 끝날 때 화면이 튄다. */
export function TileSkeleton() {
  return (
    <div className={css.card} aria-hidden="true">
      <div className={`${css.cover} ${css.skeleton}`} />
      <div className={`${css.skeletonLine} ${css.wLong}`} />
      <div className={`${css.skeletonLine} ${css.wShort}`} />
    </div>
  )
}

/**
 * 오류.
 *
 * **서버의 `message` 를 그대로 보여 준다** (F-4). 문구를 프론트가 지어내면 서버가 하지 않은
 * 말이 화면에 남는다. 코드로 분기하는 것은 *덧붙일 행동* 하나뿐이다 — 인증이 필요하면
 * 로그인으로 가는 길을 함께 준다.
 */
export function ErrorBlock({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div className={css.errorBlock} role="alert">
      <p className={css.errorMessage}>{error.message}</p>
      {error.errorCode === 'UNAUTHENTICATED' ? (
        <Link className={`${css.button} ${css.buttonSmall}`} to={ROUTES.login}>
          로그인
        </Link>
      ) : (
        onRetry !== undefined && (
          <button type="button" className={`${css.button} ${css.buttonSmall}`} onClick={onRetry}>
            다시 시도
          </button>
        )
      )}
    </div>
  )
}

/**
 * AI 사전 고지 (1k · §11).
 *
 * 문구를 코드에 두지 않는다 (R11.1) — `service_config` 가 정하고, **그 화면이 이미 받은 응답**이
 * 함께 싣는다 (백엔드 #257). 기본값도 폴백도 두지 않는다: 설정이 비면 서버가 500 이고, 그것이
 * 백엔드 13-27 이 고른 결과다.
 *
 * 전에는 이 컴포넌트가 자기 화면과 별개로 `/landing` 을 한 번 더 불렀다. 요청 하나가 낭비되는
 * 것보다 나빴던 것은 **고지문이 자기 응답과 다른 시점의 값**이라는 점이다. 이제 문구는 화면이
 * 넘겨주고, 이 컴포넌트는 그리기만 한다.
 */
export function AiNoticeFooter({ text }: { text: string }) {
  return <footer className={css.footer}>{text}</footer>
}
