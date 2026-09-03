import { useEffect, useRef, useState, type RefObject } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import type { Turn } from '../../api/endpoints/play'
import { usePlaySession } from '../../hooks/usePlaySession'
import { ROUTES } from '../../routes/routes'
import { ReportDialog } from '../report/ReportDialog'
import { storyTarget, turnTarget } from '../report/report'
import { EndingPanel } from './EndingPanel'
import { PlayMenu } from './PlayMenu'
import { isPlayable, PlayStage } from './PlayStage'
import s from './play.module.css'

/**
 * Story Play — 와이어프레임 1b(Stacked) · 1e(390) · 2a~2d · 2f · 3a · 4a.
 *
 * 1c 의 Split(Visual 좌 / Story 우)은 1440 전용 옵션이고 1k 가 *"Play 는 1b 로 확정"* 이라고
 * 정했다. **한 폭에만 있는 두 번째 레이아웃을 지금 만들지 않는다** — 넓은 화면에서만 도는
 * 분기는 나머지 세 폭에서 아무도 보지 못한 채 낡는다.
 *
 * 읽고 고르는 자리 자체는 `PlayStage` 로 갈라져 있다 — 작품 만들기의 미리보기(3e)가 같은
 * 조각을 쓰기 때문이다. 이 화면이 그 위에 얹는 것은 **여기에만 있는 것들**이다: Header(2f) ·
 * 메뉴와 신고(3c) · Ending 의 세 행동(2d) · 화면 밖 선택지 힌트(2a).
 */
export function PlayScreen() {
  const { sessionId } = useParams()

  // 라우트가 `:sessionId` 를 요구하므로 여기에 오려면 값이 있어야 한다. 없는 경우를 위해
  // 문구를 지어내지 않는다 — 디자인에 그 화면이 없다.
  return sessionId === undefined ? <main data-screen="PlayScreen" /> : <Play sessionId={sessionId} />
}

function Play({ sessionId }: { sessionId: string }) {
  const play = usePlaySession(sessionId)
  const navigate = useNavigate()
  const choicesRef = useRef<HTMLDivElement>(null)
  /*
   * 시트는 **한 번에 하나만** 떠 있다 (3c). 둘을 각각 boolean 으로 두면 메뉴 위에 신고가
   * 겹쳐 뜨는 상태가 만들어지고, 그 상태를 막는 조건이 곧 세 번째 규칙이 된다.
   */
  const [sheet, setSheet] = useState<'none' | 'menu' | 'report'>('none')

  const turn = play.turn
  const leave = (): void => void navigate(ROUTES.library)
  // 선택지가 화면 밖이면 우하단에 미세 힌트만 띄운다. **sticky 로 끌어올리지 않는다** —
  // 읽는 자리를 가리는 순간 본문이 선택지에 밀린다 (2a · 1k).
  const choicesOffscreen = useOffscreen(choicesRef, isPlayable(play))

  return (
    <main className={s.screen} data-screen="PlayScreen">
      <PlayHeader turn={turn} onMenu={() => setSheet('menu')} />
      <PlayStage
        session={play}
        choicesRef={choicesRef}
        onLeave={leave}
        tail={
          play.status === 'ready' && turn?.isEnding === true ? (
            <EndingPanel turn={turn} sessionId={sessionId} />
          ) : null
        }
      />

      {choicesOffscreen ? (
        <p className={s.hint} aria-hidden="true">
          ↓ 선택으로
        </p>
      ) : null}

      {sheet === 'menu' && turn !== null ? (
        <PlayMenu
          turn={turn}
          sessionId={sessionId}
          onReport={() => setSheet('report')}
          onLeave={leave}
          onClose={() => setSheet('none')}
        />
      ) : null}

      {/*
       * 대상 둘을 **여기서** 만든다. 장면은 지금 화면에 떠 있는 턴이고 작품은 그 턴이 알려
       * 준 작품이다 (#259) — 신고 시트가 세션을 다시 읽지 않는다. 기본 선택이 장면인 것은
       * 3c 의 순서 그대로다: 이 자리에서 눈에 걸린 것은 대개 방금 읽은 장면이다.
       */}
      {sheet === 'report' && turn !== null ? (
        <ReportDialog
          targets={[
            turnTarget(sessionId, turn.turnNo, turn.chapterNo),
            storyTarget(turn.storyId, turn.title),
          ]}
          returnLabel="이야기로 돌아가기"
          onClose={() => setSheet('none')}
        />
      ) : null}
    </main>
  )
}

/**
 * Header — **두 줄이다: 작품 제목과 챕터** (2f 가 390 에서 정한 모양이고, 그 위 폭도 같다).
 *
 * 제목은 `turn.title` 이다 (백엔드 #259). 세션이 고정한 버전의 제목이므로 (I-4) 작품이 그 뒤에
 * 개정되어도 이 화면은 읽고 있는 판본의 이름을 말한다 — 라이브러리에서 다시 읽어 오지 않는
 * 이유가 그것이다.
 *
 * 챕터 제목(`chapterTitle`)은 여기 두지 않는다. 세 줄이 되면 2f 의 2줄 규칙이 깨지고,
 * 그 값은 챕터가 바뀌는 순간 인터스티셜(2c)이 이미 크게 보여 준다.
 *
 * 진행 표시는 서버가 만든 `progressHint` 문자열을 그대로 쓴다 — 백분율을 계산하지 않고
 * (R7.5), 계약에 없는 값(남은 턴 · 진행바)을 여기에 그리지 않는다.
 */
function PlayHeader({ turn, onMenu }: { turn: Turn | null; onMenu: () => void }) {
  if (turn === null) {
    return <header className={s.header} />
  }
  return (
    <header className={s.header}>
      <div className={s.headerText}>
        <p className={s.storyTitle}>{turn.title}</p>
        <p className={s.chapterMeta}>
          {turn.progressHint ?? `Chapter ${String(turn.chapterNo).padStart(2, '0')}`}
        </p>
      </div>
      {/* 3c 의 `···`. 턴이 없으면 그리지 않는다 — 메뉴의 다섯 줄이 전부 이 턴에서 나온다 */}
      <button
        type="button"
        className={s.menuButton}
        onClick={onMenu}
        aria-haspopup="dialog"
        aria-label="메뉴"
      >
        ···
      </button>
    </header>
  )
}

function useOffscreen(ref: RefObject<HTMLElement | null>, enabled: boolean): boolean {
  const [offscreen, setOffscreen] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!enabled || element === null) {
      setOffscreen(false)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      setOffscreen(entry !== undefined && !entry.isIntersecting)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, enabled])

  return offscreen
}
