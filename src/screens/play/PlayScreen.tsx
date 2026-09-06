import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import type { Turn } from '../../api/endpoints/play'
import { usePlaySession } from '../../hooks/usePlaySession'
import { ROUTES } from '../../routes/routes'
import { ReportDialog } from '../report/ReportDialog'
import { storyTarget, turnTarget } from '../report/report'
import { NoticePanel } from '../system/NoticePanel'
import { PLAY_ENTRY_EXITS } from '../system/systemNotice'
import system from '../system/system.module.css'
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

  return sessionId === undefined ? <PlayEntryFailure /> : <Play sessionId={sessionId} />
}

/**
 * 세션 식별자 없이 이 화면에 닿았다 — 8차 design-gaps `B-4` (#129).
 *
 * 라우트가 `:sessionId` 를 요구하므로 정상적인 이동으로는 오지 않는다. 그래도 **빈 화면을
 * 두지 않는다**: 주소를 직접 고쳐 들어오거나 오래된 링크를 열면 이 자리에 닿고, 비어 있는
 * 화면은 돌아가는 것처럼 보인다 (CLAUDE.md 개발 루프).
 *
 * **원인을 나누지 않는다.** 주소를 잘못 친 것과 세션이 사라진 것이 화면에서 같아 보이고,
 * 여기서는 둘을 구분할 근거도 없다 — 식별자가 *있는데* 서버가 `404` 를 주는 경우는
 * `usePlaySession` 의 오류 경로이지 이 자리가 아니다.
 *
 * **문구를 화면이 쓴다.** 이 실패는 서버를 부르기 *전*에 일어나 서버가 준 `message` 가 없다 —
 * `F-4` 가 그대로 보여 주라고 하는 그 대상이 없는 자리이며, `B-1`(404)이 세운 것과 같은
 * 구분이다. 계약의 `NOT_FOUND` 는 여기 오지 않는다.
 *
 * 나가는 문은 있다 — 이 화면은 `RequireAuth` 안이라 라이브러리가 실제로 열린다. 목적지는
 * `PLAY_ENTRY_EXITS` 가 들고, 그 판단에 테스트가 붙는다 (8차 B-2 와 갈리는 지점).
 */
function PlayEntryFailure() {
  return (
    <main className={system.screen} data-screen="PlayScreen">
      <NoticePanel
        headline="이야기를 열 수 없어요"
        headlineTag="h1"
        body="이 주소로는 읽던 이야기를 찾을 수 없습니다."
      >
        {PLAY_ENTRY_EXITS.map((exit) => (
          <Link key={exit.to} className={`${system.action} ${system.primary}`} to={exit.to}>
            {exit.label}
          </Link>
        ))}
      </NoticePanel>
    </main>
  )
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
