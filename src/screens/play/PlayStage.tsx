import { useEffect, useRef, type ReactNode, type RefObject } from 'react'

import type { PlaySession } from '../../hooks/usePlaySession'
import { ChapterInterstitial } from './ChapterInterstitial'
import { ChoiceList } from './ChoiceList'
import { Generating, PlayProblem } from './PlayNotice'
import { StoryText } from './StoryText'
import s from './play.module.css'

/**
 * 읽고 고르는 자리 — Visual · 본문 · 생성 중 · 오류 · 선택지 · 챕터 인터스티셜.
 *
 * **Play 화면에서 갈라 냈다.** 3e 가 작품 만들기 Step 5 의 미리보기를 *"Play 화면 재사용"*
 * 으로 정했기 때문이며, 재사용의 단위가 화면 전체가 아니라 **이 덩어리**인 이유는 나머지가
 * 미리보기에서 뜻을 잃기 때문이다:
 *
 * - **Header** — 작품 제목과 진행(2f). 미리보기는 자기 머리를 얹는다 (3e 의 "미리보기 · N턴").
 * - **메뉴 · 신고**(3c) — 자기 원고를 자기가 신고하는 길이다. 대상 작품도 아직 발행되지 않았다.
 * - **Ending 의 세 행동**(2d — 다른 결말 · 기록 · 둘러보기) — 미리보기 세션은 저장되지 않고
 *   My Stories 에도 나타나지 않으므로 갈 곳이 셋 다 없다.
 * - **`main` 과 `100dvh`** — 미리보기는 마법사 안에 들어가고, `main` 은 한 문서에 하나다.
 *
 * 그래서 이 컴포넌트는 **자기 컨테이너를 만들지 않는다.** 좌우 여백(`--pad`)과 Visual 의
 * 높이 상한(`--visual-cap`)을 부르는 쪽이 정의하며, 그래서 같은 조각이 전체 화면에서도
 * 380px 패널에서도 제 폭으로 선다.
 */
export interface PlayStageProps {
  session: PlaySession
  /**
   * 본문과 선택 **뒤에** 오는 자리. 라우트는 Ending(2d)을, 미리보기는 상한 도달 안내(3e)를
   * 여기 둔다 — 조각마다 다른 것이 그 하나뿐이라 boolean 으로 모드를 나누지 않는다.
   */
  tail?: ReactNode
  /** 선택지가 화면 밖인지 재는 쪽이 준다 (2a 의 "↓ 선택으로" 힌트). */
  choicesRef?: RefObject<HTMLDivElement | null>
  /**
   * 오류의 "나중에 이어하기" (`recovery.ts` 의 `leave`).
   *
   * 목적지가 조각마다 다르다 — 라우트는 라이브러리로 나가고, 미리보기는 **편집으로 돌아간다**:
   * 미리보기 세션에는 이어할 자리가 없다.
   */
  onLeave: () => void
}

/** 지금 고를 수 있는가. 힌트를 켜는 쪽과 선택지를 그리는 쪽이 같은 판정을 써야 한다. */
export function isPlayable(session: PlaySession): boolean {
  return session.status === 'ready' && session.turn !== null && !session.turn.isEnding
}

export function PlayStage({ session, tail, choicesRef, onLeave }: PlayStageProps) {
  const storyRef = useRef<HTMLElement>(null)
  const turn = session.turn
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

  return (
    <>
      {/*
       * `sceneImage` 는 아직 발행되지 않는다(P3). 화면은 **언제나 그라디언트 폴백**이며,
       * 오지 않을 값을 기다리는 빈 상자를 두지 않는다. 높이는 비율로만 잡는다 (1k).
       */}
      <div
        className={s.visual}
        role="presentation"
        data-dimmed={session.status !== 'ready' && session.status !== 'chapter'}
      />
      <div className={s.column}>
        <div className={s.center}>
          {turn === null ? null : <StoryText turn={turn} ref={storyRef} />}

          {session.status === 'restoring' ? (
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

          {session.status === 'generating' && session.startedAt !== null ? (
            <Generating
              choice={turn?.choices.find((c) => c.choiceId === session.selectedChoiceId) ?? null}
              startedAt={session.startedAt}
            />
          ) : null}

          {session.status === 'error' && session.error !== null ? (
            <PlayProblem
              error={session.error}
              savedTurnNo={turnNo ?? null}
              handlers={{
                retry: session.retry,
                chooseOther: session.chooseOther,
                refresh: session.refresh,
                leave: onLeave,
              }}
            />
          ) : null}

          {isPlayable(session) && turn !== null ? (
            <div ref={choicesRef}>
              {/* 제출되는 것은 `choiceId` 하나다 (F-1) — `ChoiceList` 가 그것만 넘긴다 */}
              <ChoiceList choices={turn.choices} onSelect={session.select} />
            </div>
          ) : null}

          {tail}
        </div>
      </div>

      {session.status === 'chapter' && turn !== null ? (
        <ChapterInterstitial turn={turn} onDone={session.skipChapter} />
      ) : null}
    </>
  )
}
