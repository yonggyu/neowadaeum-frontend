import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import type { Turn } from '../../api/endpoints/play'
import { usePlaySession } from '../../hooks/usePlaySession'
import { ROUTES } from '../../routes/routes'
import { ChapterInterstitial } from './ChapterInterstitial'
import { ChoiceList } from './ChoiceList'
import { EndingPanel } from './EndingPanel'
import { Generating, PlayProblem } from './PlayNotice'
import { StoryText } from './StoryText'
import s from './play.module.css'

/**
 * Story Play — 와이어프레임 1b(Stacked) · 1e(390) · 2a~2d · 2f · 3a · 4a.
 *
 * 1c 의 Split(Visual 좌 / Story 우)은 1440 전용 옵션이고 1k 가 *"Play 는 1b 로 확정"* 이라고
 * 정했다. **한 폭에만 있는 두 번째 레이아웃을 지금 만들지 않는다** — 넓은 화면에서만 도는
 * 분기는 나머지 세 폭에서 아무도 보지 못한 채 낡는다.
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
  const storyRef = useRef<HTMLElement>(null)
  const choicesRef = useRef<HTMLDivElement>(null)

  const turn = play.turn
  const turnNo = turn?.turnNo

  useEffect(() => {
    if (turnNo === undefined) {
      return
    }
    // 새 턴은 새 본문 시작에서 읽는다 (2a). 부드럽게 움직이되, 움직임을 줄여 달라고 한
    // 사람에게는 즉시 옮긴다 — `scrollIntoView` 의 behavior 는 CSS 처럼 알아서 꺾이지 않는다.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    storyRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }, [turnNo])

  const handlers = useMemo(
    () => ({
      retry: play.retry,
      chooseOther: play.chooseOther,
      refresh: play.refresh,
      leave: () => navigate(ROUTES.library),
    }),
    [play.retry, play.chooseOther, play.refresh, navigate],
  )

  const playable = play.status === 'ready' && turn !== null && !turn.isEnding
  // 선택지가 화면 밖이면 우하단에 미세 힌트만 띄운다. **sticky 로 끌어올리지 않는다** —
  // 읽는 자리를 가리는 순간 본문이 선택지에 밀린다 (2a · 1k).
  const choicesOffscreen = useOffscreen(choicesRef, playable)

  return (
    <main className={s.screen} data-screen="PlayScreen">
      <PlayHeader turn={turn} />
      {/*
       * `sceneImage` 는 아직 발행되지 않는다(P3). 화면은 **언제나 그라디언트 폴백**이며,
       * 오지 않을 값을 기다리는 빈 상자를 두지 않는다. 높이는 비율로만 잡는다 (1k).
       */}
      <div
        className={s.visual}
        role="presentation"
        data-dimmed={play.status !== 'ready' && play.status !== 'chapter'}
      />
      <div className={s.column}>
        <div className={s.center}>
          {turn === null ? null : <StoryText turn={turn} ref={storyRef} />}

          {play.status === 'restoring' ? (
            // Resume 진입과 409 이후의 재조회가 같은 자리에 온다. 문구가 디자인에 없으므로
            // dot 만 둔다 — 읽는 사람에게 없는 말을 지어내 보이지 않는다.
            <p className={s.notice} aria-busy="true" aria-label="이야기를 불러오는 중">
              <span className={s.dots} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </p>
          ) : null}

          {play.status === 'generating' && play.startedAt !== null ? (
            <Generating
              choice={turn?.choices.find((c) => c.choiceId === play.selectedChoiceId) ?? null}
              startedAt={play.startedAt}
            />
          ) : null}

          {play.status === 'error' && play.error !== null ? (
            <PlayProblem error={play.error} savedTurnNo={turnNo ?? null} handlers={handlers} />
          ) : null}

          {playable ? (
            <div ref={choicesRef}>
              <ChoiceList choices={turn.choices} onSelect={play.select} />
            </div>
          ) : null}

          {play.status === 'ready' && turn?.isEnding === true ? (
            <EndingPanel turn={turn} sessionId={sessionId} />
          ) : null}
        </div>
      </div>

      {choicesOffscreen ? (
        <p className={s.hint} aria-hidden="true">
          ↓ 선택으로
        </p>
      ) : null}

      {play.status === 'chapter' && turn !== null ? (
        <ChapterInterstitial turn={turn} onDone={play.skipChapter} />
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
function PlayHeader({ turn }: { turn: Turn | null }) {
  if (turn === null) {
    return <header className={s.header} />
  }
  return (
    <header className={s.header}>
      <p className={s.storyTitle}>{turn.title}</p>
      <p className={s.chapterMeta}>
        {turn.progressHint ?? `Chapter ${String(turn.chapterNo).padStart(2, '0')}`}
      </p>
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
