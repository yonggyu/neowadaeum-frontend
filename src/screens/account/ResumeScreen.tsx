import { Link, useParams } from 'react-router-dom'

import type { ResumeResponse } from '../../api/endpoints/resume'
import { useSessionResume } from '../../hooks/useSessionResume'
import { historyPath, playPath, ROUTES, storyDetailPath } from '../../routes/routes'
import shared from './account.module.css'
import { ErrorNotice } from './ErrorNotice'
import { formatRelativeTime } from './relativeTime'
import {
  progressLabel,
  resumeNotice,
  type ResumeAction,
  type ResumeMeta,
} from './resumeNotice'

/**
 * 이어하기 진입 (와이어프레임 2e · 4b).
 *
 * 바로 Play 로 들어가지 않고 이 요약을 한 단계 거친다 — **맥락 복원용**이다. 며칠 만에
 * 돌아온 사람에게 마지막 장면 없이 선택지부터 들이밀면 무엇을 고르는지 알 수 없다.
 *
 * `sessionState` 다섯의 판정은 서버가 한다 (§13-26). 화면은 받은 값 하나를 그린다.
 */
export function ResumeScreen() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const state = useSessionResume(sessionId ?? '')

  return (
    <main className={`${shared.page} ${shared.reading}`} data-screen="ResumeScreen">
      {state.status === 'loading' ? <p className={shared.status}>불러오는 중…</p> : null}
      {state.status === 'error' ? <ErrorNotice error={state.error} /> : null}
      {state.status === 'ready' ? <Summary resume={state.resume} /> : null}
    </main>
  )
}

function Summary({ resume }: { resume: ResumeResponse }) {
  const notice = resumeNotice(resume)

  return (
    <article>
      {/*
       * 마지막 장면. `lastSceneVisual` 은 장면 이미지가 P3 라 **항상 `null`** 이므로
       * (백엔드 §13-26) 지금 그려지는 것은 폴백뿐이다. 높이를 px 로 박지 않고 비율로만 둔다.
       */}
      <div className={shared.visualFallback} aria-hidden="true" />

      <h1 className={shared.pageTitle}>{notice.title}</h1>
      <p className={shared.body}>{notice.body === '' ? summaryOf(resume) : notice.body}</p>
      <p className={shared.meta}>{metaOf(resume, notice.meta)}</p>

      <div className={shared.actions}>
        {notice.actions.map((action) => (
          <ActionLink key={action} action={action} resume={resume} />
        ))}
      </div>
    </article>
  )
}

/**
 * `valid` 일 때 본문에 오는 것 — 마지막 장면 요약과 직전 선택.
 *
 * 서버가 `null` 을 줄 수 있다. 그때 문장을 지어내지 않는다 — 요약이 없으면 아래 메타 줄의
 * 챕터·턴이 맥락을 대신한다.
 */
function summaryOf(resume: ResumeResponse): string {
  const summary = resume.lastSceneSummary ?? ''
  const choice = resume.lastChoiceText
  return choice === null ? summary : `${summary} 당신은 “${choice}”를 골랐다.`.trim()
}

function metaOf(resume: ResumeResponse, meta: ResumeMeta): string {
  const when = formatRelativeTime(resume.updatedAt, Date.now())
  if (meta === 'progress') {
    return `${progressLabel(resume)} · ${when}`
  }
  if (meta === 'lastProgress') {
    return `마지막 진행 ${when}`
  }
  return ''
}

/**
 * 행동 넷을 링크로 옮긴다.
 *
 * "처음부터 시작"이 세션을 만들지 않고 **작품 상세로 보내는** 이유 — 세션 생성은 플레이
 * 슬라이스의 오퍼레이션이고, 이미 진행 중인 세션이 있으면 서버가 `SESSION_ALREADY_ACTIVE`
 * 로 답한다. 그 판단이 이뤄지는 자리가 작품 상세다.
 */
function ActionLink({ action, resume }: { action: ResumeAction; resume: ResumeResponse }) {
  const primary = action === 'continue' || action === 'restart'
  const className = `${shared.button} ${primary ? shared.primary : ''}`

  if (action === 'continue') {
    return (
      <Link className={className} to={playPath(resume.sessionId)}>
        이어서 읽기
      </Link>
    )
  }
  if (action === 'restart') {
    return (
      <Link className={className} to={storyDetailPath(resume.storyId)}>
        처음부터 시작
      </Link>
    )
  }
  if (action === 'history') {
    return (
      <Link className={className} to={historyPath(resume.sessionId)}>
        전체 기록 보기
      </Link>
    )
  }
  return (
    <Link className={className} to={ROUTES.library}>
      다른 이야기 둘러보기
    </Link>
  )
}
