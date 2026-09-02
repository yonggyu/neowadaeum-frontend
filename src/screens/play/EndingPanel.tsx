import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError } from '../../api/client'
import { startSession, type Turn } from '../../api/endpoints/play'
import { UNKNOWN_ERROR } from '../../api/errors'
import { ROUTES, historyPath, playPath } from '../../routes/routes'
import { reachRatePercent } from './ending'
import s from './play.module.css'

/**
 * Ending (2d).
 *
 * **`choices` 가 빈 배열인 것이 곧 끝이라는 신호다** (R7.8). 별도 상태를 만들지 않고
 * `isEnding` 과 함께 이 자리에서 갈린다 — 본문은 여전히 같은 턴의 `paragraphs` 다.
 */
export function EndingPanel({ turn, sessionId }: { turn: Turn; sessionId: string }) {
  // 아직 붙지 않은 백엔드 작업(B-17 · B-35 · B-39)의 필드는 계약에서 선택 항목이다 —
  // 오지 않는 것과 `null` 인 것을 화면이 구분할 이유가 없으므로 여기서 한 번에 좁힌다.
  const label = turn.endingLabel ?? null
  const epilogue = turn.epilogueText ?? null
  const stats = turn.stats ?? null
  // 단위는 계약이 정했다 — 0~1 비율이다 (백엔드 #260). 곱셈은 `ending.ts` 가 지킨다.
  const reachRate = reachRatePercent(turn.reachRate)

  return (
    <section className={s.ending}>
      <p className={s.endingBadge}>
        Ending
        {turn.endingIndex === null || turn.totalEndings === null
          ? null
          : ` ${pad(turn.endingIndex)} / ${pad(turn.totalEndings)}`}
        {/*
         * 표본이 적으면 계약이 `null` 을 준다 (R2.8). 그때 **이 줄에서 도달률만 사라진다** —
         * 0% 로 적으면 아무도 도달하지 못한 결말이라는 뜻이 되고, 그건 사실이 아니다.
         */}
        {reachRate === null ? null : ` · 도달률 ${reachRate}%`}
      </p>
      {label === null ? null : <h2 className={s.endingTitle}>{label}</h2>}
      {epilogue === null ? null : <p className={s.epilogue}>{epilogue}</p>}
      {stats === null ? null : (
        <ul className={s.stats}>
          <li>Chapter {stats.chapters}</li>
          <li>{stats.turns} Turn</li>
          <li>선택 {stats.choices}회</li>
        </ul>
      )}
      {/* 세 행동의 순서는 2d 가 정했다 — 다른 결말 · 기록 · 둘러보기 */}
      <Restart storyId={turn.storyId} />
      <div className={s.actions}>
        {/* 볼 것이 있는지는 서버가 답한다. `canViewHistory` 가 참일 때만 길을 연다 */}
        {turn.canViewHistory === true ? (
          <Link className={s.action} to={historyPath(sessionId)}>
            기록 다시 읽기
          </Link>
        ) : null}
        <Link className={s.action} to={ROUTES.library}>
          다른 이야기 둘러보기
        </Link>
      </div>
    </section>
  )
}

/**
 * "다른 결말 보기" — `POST /stories/{storyId}/sessions?restart=true`.
 *
 * 어느 작품인지는 **턴이 말한다** (`TurnResponse.storyId`, 백엔드 #259). 플레이 라우트는
 * `/sessions/{sessionId}` 라 URL 에 작품이 없고, 계약이 `storyId` 의 설명에 이 버튼을 그 용도로
 * 적어 두었다.
 *
 * **확인을 한 단계 둔다.** 계약이 `restart=true` 의 뜻을 *"기존 `active` 세션을 `abandoned` 로
 * 전환한 뒤 새로 만든다"* 로 적었다 (§13-9). 되돌릴 수 없는 요청이므로 버튼 한 번으로 보내지
 * 않고, **무엇이 사라지는지 문장으로 말한 뒤** 다시 누르게 한다. 이것은 문구를 지어내는 것이
 * 아니다 — F-4 는 *서버 오류 문구*를 프론트가 대신 쓰지 말라는 규칙이고, 여기서 말하는 것은
 * 계약이 이미 정의한 동작이다. 숨기면 사용자는 진행이 사라진 뒤에야 알게 된다.
 */
function Restart({ storyId }: { storyId: string }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const start = () => {
    setPending(true)
    setError(null)
    startSession(storyId, { restart: true }).then(
      (created) => {
        // 새 세션의 턴 1 은 이 응답에 이미 들어 있지만, 화면은 라우트가 바뀐 뒤 `GET /current`
        // 로 자기 상태를 세운다 — 같은 세션을 두 경로로 세우면 어느 쪽이 진실인지 갈린다.
        void navigate(playPath(created.sessionId))
      },
      (cause: unknown) => {
        setPending(false)
        // 세션 시작이 막히는 경우는 계약에 있다 — `409 SESSION_ALREADY_ACTIVE` ·
        // `423 STORY_SUSPENDED`. 어느 쪽이든 **서버 `message` 를 그대로 보여 준다** (F-4).
        setError(
          cause instanceof ApiError
            ? cause
            : new ApiError(0, UNKNOWN_ERROR, '이야기를 새로 시작하지 못했어요.', {}),
        )
      },
    )
  }

  if (!confirming) {
    return (
      <div className={s.actions}>
        <button
          type="button"
          className={`${s.action} ${s.actionPrimary}`}
          onClick={() => setConfirming(true)}
        >
          다른 결말 보기
        </button>
      </div>
    )
  }

  return (
    <div className={s.confirm} role="group" aria-label="다른 결말 보기 확인">
      <p className={s.confirmText}>
        다른 결말을 보려면 이 작품을 처음부터 다시 시작합니다. 이 작품에 진행 중인 이야기가
        남아 있으면 그 진행은 버려지고, 되돌릴 수 없습니다.
      </p>
      {error === null ? null : (
        <p className={s.confirmError} role="alert">
          {error.message}
        </p>
      )}
      <div className={s.actions}>
        <button
          type="button"
          className={`${s.action} ${s.actionPrimary}`}
          disabled={pending}
          onClick={start}
          autoFocus
        >
          처음부터 다시 시작
        </button>
        <button
          type="button"
          className={s.action}
          disabled={pending}
          onClick={() => {
            setConfirming(false)
            setError(null)
          }}
        >
          취소
        </button>
      </div>
    </div>
  )
}

const pad = (value: number): string => String(value).padStart(2, '0')
