import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { submitDraft, type Visibility } from '../../api/endpoints/authoring'
import { usePlaySession } from '../../hooks/usePlaySession'
import { myStoryPath, ROUTES } from '../../routes/routes'
import {
  submitVisibilityHint,
  VISIBILITY_LABEL,
  VISIBILITY_OPTIONS,
} from '../account/reviewStatus'
import { ErrorNotice } from '../account/ErrorNotice'
import { PlayStage } from '../play/PlayStage'
import { isPreviewOver, previewTurnLabel } from './preview'
import type { PreviewHandle } from './usePreviewSession'
import css from './wizard.module.css'

/**
 * Step 5 — 미리보기와 공개 설정 (와이어프레임 3e · 6a).
 *
 * **두 자리로 나뉜다.** 6a 가 *"Step 5 는 미리보기 세션"* 을 우측 패널의 내용으로 정했으므로
 * 체험은 패널에서 돌고(`PreviewPanel`), 좌측에는 남은 일 하나 — 공개 설정과 제출 — 이 온다
 * (`StepPublish`). 세션 상태는 마법사가 들고 둘에게 넘긴다: 한쪽이 자기 세션을 따로 만들면
 * **미리보기가 두 번 발행된다** (§13-37 — 미리보기마다 새 작품이 생긴다).
 */

/** 공개 설정으로 시선을 옮긴다 (3e 의 "공개 설정" 버튼). 첫 라디오가 그 자리다. */
const VISIBILITY_FIELD = (visibility: Visibility): string => `visibility-${visibility}`

export function StepPublish({
  draftId,
  preview,
  carriesImage,
}: {
  draftId: string
  preview: PreviewHandle
  /** 이 원고가 커버나 초상을 나르는가 (§13-83) — 고지가 갈리는 유일한 조건이다. */
  carriesImage: boolean
}) {
  const navigate = useNavigate()
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function submit(): Promise<void> {
    setSubmitting(true)
    setError(null)
    try {
      const review = await submitDraft(draftId, visibility)
      /*
       * 제출 뒤의 자리는 검수 상태 화면이다 (3f). `storyId` 는 계약에서 `null` 이 될 수 있고
       * 그때 갈 곳은 목록이다 — 없는 id 로 상세를 열면 그 화면이 빈 채로 선다.
       */
      void navigate(review.storyId === null ? ROUTES.myStories : myStoryPath(review.storyId))
    } catch (cause) {
      setSubmitting(false)
      setError(cause)
    }
  }

  return (
    <>
      <h1 className={css.pageTitle}>누구에게 보여줄까요?</h1>
      {preview.state.kind === 'idle' ? (
        <p className={css.meta}>
          미리보기로 직접 체험해 본 뒤 공개 범위를 정할 수 있습니다.
        </p>
      ) : null}

      <fieldset className={css.field}>
        <legend className={css.fieldLabel}>공개 범위</legend>
        {/*
         * 문구는 3f · 6c 가 정한 것을 그대로 쓴다 (`reviewStatus.ts`). 같은 세 값을 두 화면이
         * 다르게 부르면 작성자는 제출할 때와 나중에 바꿀 때 서로 다른 것을 고르는 셈이 된다.
         */}
        {VISIBILITY_OPTIONS.map((option) => (
          <label className={css.radioRow} key={option} htmlFor={VISIBILITY_FIELD(option)}>
            <input
              type="radio"
              id={VISIBILITY_FIELD(option)}
              name="visibility"
              checked={visibility === option}
              onChange={() => setVisibility(option)}
            />
            <span className={css.radioText}>
              <span>{VISIBILITY_LABEL[option]}</span>
              <span className={css.meta}>{submitVisibilityHint(option, carriesImage)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {/*
       * `private → public` 도 이 경로다. 정정본 §13-48 이 그렇게 정했다 — *"아무에게도 보인 적
       * 없는 작품을 공개하는 것은 승격이 아니라 제출이고 그 길은 `submit` 에 있다."*
       * `changeStoryVisibility` 는 이미 발행된 작품의 승격이며, 여기서 부르지 않는다.
       */}
      <button
        type="button"
        className={`${css.button} ${css.primary}`}
        onClick={() => void submit()}
        disabled={submitting}
      >
        {submitting ? '제출 중…' : '제출'}
      </button>

      {/*
       * 실패의 문구는 서버의 것이다 (F-4). 400 검증 실패도 여기로 온다.
       *
       * **`onRetry` 를 주지 않는다** (#142) — 이유가 둘이고, 둘 다 이 자리에만 있다.
       *
       * 첫째, **이 화면은 막다른 곳이 아니다.** 실패하면 위의 [제출]이 다시 눌리는 상태로
       * 돌아온다 (`setSubmitting(false)`) — 다시 부르는 길은 이미 그 버튼이고, 그 옆에
       * [다시 시도]를 하나 더 두면 같은 한 가지 일에 버튼이 둘이 된다. `#142` 가 말한
       * *"할 수 있는 일이 하나도 없다"* 는 `ResumeScreen` 쪽의 사실이다.
       *
       * 둘째, **다시 부르는 것이 공짜가 아니다.** `submitDraft` 에는 `Idempotency-Key` 가 없다
       * — 계약이 그 헤더를 선언한 오퍼레이션은 턴 생성 하나뿐이다 (R6.2). 닿지 못한 실패는
       * *요청이 서버에 닿지 않았다*가 아니라 **닿았는지 알 수 없다**는 뜻이고(성공 응답을 읽지
       * 못한 경우도 그 갈래다), 앞의 제출이 실제로 접수됐다면 다시 부르는 것은 **같은 작품에
       * 버전을 하나 더 얹고 검수를 한 번 더 요청하는 일**이다 (R8.8 · §13-40 · I-5).
       * 그 대가를 치를지는 작성자가 [제출]을 다시 누르며 정할 일이지, 실패 판 안의
       * [다시 시도]가 조용히 정할 일이 아니다.
       */}
      {error === null ? null : <ErrorNotice error={error} />}
    </>
  )
}

/**
 * 우측 패널의 미리보기 세션 (6a). **`PlayStage` 를 그대로 쓴다** — 3e 가 *"Play 화면 재사용"*
 * 으로 정했고, 복사하면 두 화면이 서로 다른 속도로 낡는다.
 */
export function PreviewPanel({
  preview,
  onEdit,
}: {
  preview: PreviewHandle
  onEdit: () => void
}) {
  const state = preview.state

  if (state.kind === 'open') {
    return (
      <PreviewSession
        key={state.sessionId}
        sessionId={state.sessionId}
        turnLimit={state.turnLimit}
        onEdit={onEdit}
        onRestart={preview.start}
      />
    )
  }

  return (
    <div className={css.previewIntro}>
      <p className={css.body}>직접 체험해 보고 고칠 곳을 찾습니다.</p>
      {/*
       * 상한을 여기서 말하지 않는다 — 몇 턴인지는 세션이 열린 뒤 `turnLimit` 이 알려 준다.
       *
       * 세션을 여는 데 실패한 자리에도 **[다시 시도]를 따로 두지 않는다** (#142). 아래
       * [미리보기 시작]이 이미 `preview.start` 이고, 그것은 **다시 부르면 세션이 하나 더
       * 열리는** 호출이다 — 미리보기는 부를 때마다 새 작품을 발행하고 일일 상한이 걸려 있다
       * (§13-37 · R8.12). 닿지 못한 실패는 앞의 호출이 접수됐는지 알 수 없는 상태이므로,
       * 자동으로 보이는 [다시 시도]는 작성자가 세지 않은 한 번을 소모할 수 있다. 그 한 번은
       * 작성자가 버튼을 눌러 정한다.
       */}
      {state.kind === 'failed' ? (
        <p className={css.blockedMessage} role="alert">
          {state.error.message}
        </p>
      ) : null}
      <button
        type="button"
        className={`${css.button} ${css.primary}`}
        onClick={preview.start}
        disabled={state.kind === 'creating'}
      >
        {state.kind === 'creating' ? '세션을 여는 중…' : '미리보기 시작'}
      </button>
    </div>
  )
}

function PreviewSession({
  sessionId,
  turnLimit,
  onEdit,
  onRestart,
}: {
  sessionId: string
  turnLimit: number
  onEdit: () => void
  onRestart: () => void
}) {
  const session = usePlaySession(sessionId)
  const turnNo = session.turn?.turnNo ?? 0
  /*
   * 끝나는 길이 둘이다 — 상한에 닿거나 엔딩에 이르거나. 어느 쪽이든 이 세션에서 더 볼 것이
   * 없고, 세션 자체는 살아 있어 방금 읽은 것을 다시 읽을 수 있다 (정정본 §13-36).
   */
  const over = isPreviewOver(turnNo, turnLimit) || session.turn?.isEnding === true

  return (
    <>
      <div className={css.previewHead}>
        <span className={css.fieldLabel}>{`미리보기 · ${turnLimit}턴`}</span>
        {/* 3e 의 "수정하러 가기". `jump` 로 두지 않는다 — 이 패널은 390 에도 서므로
            글자 높이짜리 대상이 되어서는 안 된다 */}
        <button type="button" className={css.button} onClick={onEdit}>
          수정하러 가기
        </button>
      </div>
      <p className={css.meta}>{previewTurnLabel(turnNo, turnLimit)}</p>
      {/*
       * `--pad` 와 `--visual-cap` 을 이 자리가 정한다 — `PlayStage` 는 자기 컨테이너를 만들지
       * 않는다. 380px 패널에 라우트의 여백(1440 에서 88px)이 들어오면 본문이 설 자리가 없다.
       */}
      <div className={css.previewStage}>
        <PlayStage
          session={session}
          onLeave={onEdit}
          tail={
            over ? (
              <div className={css.previewEnd}>
                <p className={css.body}>미리보기가 끝났습니다. 공개 설정으로 넘어갈까요?</p>
                <div className={css.rowActions}>
                  {/* 다시 체험은 **새 세션**이다 — 되감는 경로가 계약에 없다 (§13-37) */}
                  <button type="button" className={css.button} onClick={onRestart}>
                    다시 체험
                  </button>
                  <button
                    type="button"
                    className={`${css.button} ${css.primary}`}
                    onClick={() =>
                      document.getElementById(VISIBILITY_FIELD(VISIBILITY_OPTIONS[0] ?? 'private'))?.focus()
                    }
                  >
                    공개 설정
                  </button>
                </div>
              </div>
            ) : null
          }
        />
      </div>
    </>
  )
}
