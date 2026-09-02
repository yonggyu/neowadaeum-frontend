import { Link } from 'react-router-dom'

import type { Turn } from '../../api/endpoints/play'
import { ROUTES, historyPath } from '../../routes/routes'
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
  const reachRate = turn.reachRate ?? null

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
         *
         * 단위가 계약에 없어 0~1 비율로 읽는다. 백엔드 이슈 후보다.
         */}
        {reachRate === null ? null : ` · 도달률 ${Math.round(reachRate * 100)}%`}
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

const pad = (value: number): string => String(value).padStart(2, '0')
