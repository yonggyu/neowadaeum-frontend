import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { getDraft, updateDraft, type Draft } from '../../api/endpoints/authoring'
import { ROUTES } from '../../routes/routes'
import { ErrorNotice } from '../account/ErrorNotice'
import { useResource } from '../library/useResource'
import css from './wizard.module.css'
import { clampStep, isBlocked, savedAtLabel, STEP_COUNT, STEP_LABELS } from './draft'
import { chaptersMissingSeed, readOutline, writeOutline, type OutlineValues } from './outline'
import { StepOutline } from './StepOutline'
import { GENRES, readValues, writeValues, type StepValues } from './stepFields'
import { usePrecheck, type PrecheckHandle } from './usePrecheck'
import { StepBasics, StepCharacters, StepWorld } from './WizardSteps'

/**
 * 작품 만들기 마법사 (와이어프레임 3d · 6a).
 *
 * 상단 고정 진행바 · 임시 저장 표시 · 나가기 · 단계 이동은 골격(#54)이 세웠고, 이 화면은
 * 거기에 **Step 1~4 의 입력과 실시간 검수**를 채운다. Step 5(미리보기 · 공개 설정)는 아직
 * 없으며, 그 사실을 화면이 직접 말한다 — 비어 있는 화면은 돌아가는 것처럼 보인다.
 *
 * **저장 버튼을 따로 두지 않는다** (6a). 저장은 단계가 넘어갈 때 일어나고, 헤더 우측의
 * 표시가 그 결과를 말한다.
 *
 * **셸(상단 내비 · 하단 탭바)을 붙이지 않는다.** 라우터가 그 결정을 들고 있다 — 6a 가 이
 * 화면에 자기 헤더(나가기 · STEP · 저장 표시)와 390 하단 고정 바를 그렸고, 둘 다 셸의 것과
 * 같은 자리를 쓴다.
 */
export function DraftWizardScreen() {
  const { draftId } = useParams<{ draftId: string }>()
  const id = draftId ?? ''
  const { resource, reload } = useResource(
    useCallback((signal: AbortSignal) => getDraft(id, signal), [id]),
  )

  if (resource.status === 'loading') {
    return (
      <main className={css.screen} data-screen="DraftWizardScreen">
        <p className={css.status}>불러오는 중…</p>
      </main>
    )
  }

  if (resource.status === 'failed') {
    return (
      <main className={css.screen} data-screen="DraftWizardScreen">
        {/*
         * **`403` 과 `404` 를 구분해 말하지 않는다.** 남의 원고는 없는 것과 구분되지 않는다
         * (I-8) — 화면이 "권한이 없습니다" 와 "없습니다" 를 나눠 말하면 원고 id 를 훑어 남이
         * 무엇을 쓰고 있는지 알 수 있다. 서버의 `message` 를 그대로 낸다 (F-4).
         */}
        <ErrorNotice error={resource.error} onRetry={reload} />
      </main>
    )
  }

  return <Wizard draft={resource.data} />
}

type SaveState =
  | { kind: 'saved' }
  | { kind: 'saving' }
  | { kind: 'failed'; error: unknown }

function Wizard({ draft: loaded }: { draft: Draft }) {
  // 서버가 방금 돌려준 원고가 진실이다. `patchDraft` 의 응답이 저장된 원고 전체이므로
  // 다시 조회하지 않는다 — 같은 값을 한 번 더 물어보는 셈이고, 그 사이에 화면이 되감긴다.
  const [draft, setDraft] = useState(loaded)
  const [values, setValues] = useState<StepValues>(() => readValues(loaded.payload))
  // Step 4 의 값은 따로 든다 — 같은 `payload` 안에 있지만 고치는 자리가 다르고, 한 덩어리로
  // 합치면 Step 1~3 의 입력 하나가 챕터 배열 전체를 다시 만들게 된다.
  const [outline, setOutline] = useState<OutlineValues>(() => readOutline(loaded.payload))
  const [dirty, setDirty] = useState(false)
  const [save, setSave] = useState<SaveState>({ kind: 'saved' })

  /*
   * 이미 걸려 있던 것을 들고 시작한다. 원고에 남은 findings 는 `blocked` 일 때만 뜻이 있다 —
   * `warned` 는 화면이 그리지 않는 상태이므로(3d) 그 findings 도 그리지 않는다.
   */
  const precheck = usePrecheck(draft.draftId, isBlocked(loaded.safetyState) ? loaded.findings : [])

  const step = clampStep(draft.step)
  /*
   * 진행을 막는 이유는 둘이다 — 검수(6a)와 계약이 필수로 받는 값(`summarySeed`, 3e).
   *
   * **둘 다 서버의 검증을 대신하지 않는다.** `safetyState` 가 `blocked` 면 서버가 거부하고
   * (R8.3), 씨앗이 비면 계약이 거부한다 — 화면의 비활성 버튼은 그 거부를 눌러 보기 전에
   * 알려 주는 안내다.
   */
  const seedMissing = step === 4 && chaptersMissingSeed(outline.chapters).length > 0
  const blocked = isBlocked(draft.safetyState) || precheck.blocked || seedMissing

  function edit(next: StepValues): void {
    setValues(next)
    setDirty(true)
  }

  async function moveTo(next: number): Promise<void> {
    setSave({ kind: 'saving' })
    try {
      // 아는 키만 남기지 않는다 — 두 함수 모두 원문을 펼친 뒤 자기 자리만 덮는다. Step 5 의
      // 입력도 같은 `payload` 안에 오므로, 여기서 아는 키만 남기면 그것을 매번 지우게 된다.
      const payload = writeOutline(writeValues(draft.payload, values), outline)
      setDraft(await updateDraft(draft.draftId, { step: next, payload }))
      setDirty(false)
      setSave({ kind: 'saved' })
    } catch (error) {
      setSave({ kind: 'failed', error })
    }
  }

  return (
    <main className={css.screen} data-screen="DraftWizardScreen">
      {/* 진행바는 헤더 안에 있다 — 어느 폭에서도 함께 상단에 고정된다 (6a "공통") */}
      <header className={css.wizardHead}>
        <div className={css.wizardHeadRow}>
          <Link className={css.exit} to={ROUTES.authoringDrafts}>
            ← 나가기
          </Link>
          <span className={css.stepLabel}>{`STEP ${step} / ${STEP_COUNT} · ${STEP_LABELS[step - 1]}`}</span>
          <SaveIndicator state={save} updatedAt={draft.updatedAt} dirty={dirty} />
        </div>
        <ol className={css.progress} aria-label={`${STEP_COUNT}단계 중 ${step}단계`}>
          {STEP_LABELS.map((label, index) => (
            <li
              key={label}
              className={index < step ? `${css.tick} ${css.tickOn}` : css.tick}
              aria-current={index + 1 === step ? 'step' : undefined}
            >
              <span className={css.srOnly}>{label}</span>
            </li>
          ))}
        </ol>
      </header>

      <div className={css.wizardBody}>
        <section className={css.main} aria-label={STEP_LABELS[step - 1]}>
          {step === 1 ? <StepBasics values={values} onChange={edit} precheck={precheck} /> : null}
          {step === 2 ? <StepWorld values={values} onChange={edit} precheck={precheck} /> : null}
          {step === 3 ? (
            <StepCharacters values={values} onChange={edit} precheck={precheck} />
          ) : null}
          {step === 4 ? (
            <StepOutline
              draftId={draft.draftId}
              values={outline}
              onChange={(next) => {
                setOutline(next)
                setDirty(true)
              }}
              precheck={precheck}
            />
          ) : null}
          {step === 5 ? (
            <div className={css.placeholder}>
              <h1 className={css.placeholderTitle}>미리보기는 아직 붙지 않았습니다</h1>
              <p className={css.body}>
                미리보기 세션(3e)과 공개 설정 · 제출은 다음 작업에서 이 자리에 들어옵니다.
              </p>
            </div>
          ) : null}

          {/*
           * 검수 자체가 실패한 경우. **결과를 지우지 않는다** — 검사가 실패했다는 것은
           * 통과했다는 뜻이 아니다. 문구는 서버의 것이다 (F-4).
           */}
          {precheck.error === null ? null : (
            <p className={css.blockedMessage} role="alert">
              {`검수 결과를 받지 못했습니다 · ${precheck.error.message}`}
            </p>
          )}

          <div className={css.wizardNav}>
            <button
              type="button"
              className={css.button}
              onClick={() => void moveTo(step - 1)}
              disabled={step === 1 || save.kind === 'saving'}
            >
              이전
            </button>
            {/*
             * 6a — *"blocked 가 하나라도 있으면 다음 버튼 Disabled + 서버도 거부."* 화면의
             * 비활성은 안내이고 방어는 서버가 한다 (R8.3).
             *
             * 마지막 단계의 다음은 **제출**이며 아직 붙지 않았다 — `submitDraft` 는 데이터
             * 계층에 있지만 공개 설정 화면이 없다. 그래서 여기서 멈추고 그 사실을 적는다.
             */}
            <button
              type="button"
              className={`${css.button} ${css.primary}`}
              onClick={() => void moveTo(step + 1)}
              disabled={step === STEP_COUNT || blocked || save.kind === 'saving'}
            >
              {step === STEP_COUNT ? '제출 · 공개 설정' : `다음 · ${STEP_LABELS[step]}`}
            </button>
          </div>
          {step === STEP_COUNT ? (
            <p className={css.meta}>제출과 공개 설정 화면은 아직 없습니다.</p>
          ) : null}
        </section>

        <SidePanel step={step} values={values} outline={outline} precheck={precheck} />
      </div>
    </main>
  )
}

/**
 * 우측 패널 (6a) — **1024 부터만 있다.**
 *
 * 768 이하에서는 그리지 않는다: 6a 가 *"검수는 필드 아래 인라인, 미리보기는 Step 5로 이동"*
 * 이라고 정했고, 필드 아래에 이미 같은 문구가 있는데 아래로 흘러내린 패널이 한 번 더 말하면
 * 같은 오류가 두 번 보인다. 자리를 숨기는 것은 CSS 가 한다.
 *
 * Step 에 따라 **내용만** 바뀐다 (6a) — 1·2 는 커버·소개 미리보기, 3 은 검수 findings.
 */
function SidePanel({
  step,
  values,
  outline,
  precheck,
}: {
  step: number
  values: StepValues
  outline: OutlineValues
  precheck: PrecheckHandle
}) {
  if (step === 3) {
    return (
      <aside className={css.side} aria-label="검수">
        <h2 className={css.sideTitle}>검수 · 이 단계에서 걸린 것</h2>
        {precheck.findings.length === 0 ? (
          <p className={css.meta}>지금까지 걸린 곳이 없습니다.</p>
        ) : (
          <ul className={css.findings}>
            {precheck.findings.map((finding, index) => (
              <li key={index} className={css.finding}>
                {/* 서버가 준 `message` 그대로 (F-4). 무엇에 걸렸는지는 덧붙이지 않는다 (F-5) */}
                <span className={css.body}>{finding.message}</span>
                <button
                  type="button"
                  className={css.jump}
                  onClick={() => document.getElementById(finding.field)?.focus()}
                >
                  해당 필드로 이동 →
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    )
  }

  /*
   * 6a — *"Step 4 는 챕터·엔딩 흐름."* 편집하는 자리가 아니라 **읽는 자리**다: 카드가 길어질수록
   * 지금 어디를 고치고 있는지가 흐려지고, 그 답은 순서와 제목뿐이라 한 줄이면 된다.
   */
  if (step === 4) {
    return (
      <aside className={css.side} aria-label="챕터·엔딩 흐름">
        <h2 className={css.sideTitle}>챕터 · 엔딩 흐름</h2>
        {outline.chapters.length === 0 && outline.endings.length === 0 ? (
          <p className={css.meta}>아직 챕터가 없습니다.</p>
        ) : null}
        <ol className={css.flow}>
          {outline.chapters.map((chapter, index) => (
            <li key={`c${index}`} className={css.flowRow}>
              <span className={css.flowNo}>{`CH ${String(index + 1).padStart(2, '0')}`}</span>
              <span className={css.flowTitle}>{chapter.title === '' ? '제목 없음' : chapter.title}</span>
            </li>
          ))}
          {outline.endings.map((ending, index) => (
            <li key={`e${index}`} className={css.flowRow}>
              <span className={css.flowNo}>{`EN ${String(index + 1).padStart(2, '0')}`}</span>
              <span className={css.flowTitle}>{ending.label === '' ? '이름 없음' : ending.label}</span>
              {ending.isDefault ? <span className={css.flowBadge}>기본</span> : null}
            </li>
          ))}
        </ol>
      </aside>
    )
  }

  if (step === 5) {
    return (
      <aside className={css.side} aria-label="이 단계의 요약">
        <h2 className={css.sideTitle}>{STEP_LABELS[step - 1]}</h2>
        <p className={css.meta}>미리보기 세션은 아직 없습니다.</p>
      </aside>
    )
  }

  const genres = GENRES.filter((genre) => values.genres.includes(genre.value))

  return (
    <aside className={css.side} aria-label="미리보기">
      <h2 className={css.sideTitle}>미리보기 · 독자에게 보이는 모습</h2>
      <div className={css.previewCard}>
        <div className={css.imageSlot}>
          <span className={css.imageSlotNote}>커버 없음</span>
        </div>
        <p className={css.previewTitle}>{values.title === '' ? '제목 없는 작품' : values.title}</p>
        <p className={css.meta}>{genres.map((genre) => genre.label).join(' · ')}</p>
        <p className={css.body}>{values.shortDescription}</p>
        {/* 배경 소개도 독자에게 보이는 값이다 (3d) — Step 2 에서만 자리를 차지한다 */}
        {step === 2 ? <p className={css.body}>{values.worldIntro}</p> : null}
      </div>
    </aside>
  )
}

/**
 * 임시 저장 표시 (6a — Header 우측, 저장 버튼 없음).
 *
 * 실패를 조용히 넘기지 않는다. 저장 버튼이 없다는 것은 **사용자가 다시 누를 수단이 없다**는
 * 뜻이므로, 실패했을 때 서버의 문구를 그대로 내는 것이 유일한 안내다 (F-4).
 *
 * 저장되지 않은 변경도 같은 이유로 말한다 — 저장은 단계가 넘어갈 때 일어나므로, 방금 친
 * 글자가 아직 서버에 없다는 사실을 화면 말고는 알려 줄 것이 없다.
 */
function SaveIndicator({
  state,
  updatedAt,
  dirty,
}: {
  state: SaveState
  updatedAt: string
  dirty: boolean
}) {
  if (state.kind === 'saving') {
    return <span className={css.saveState}>저장 중…</span>
  }
  if (state.kind === 'failed') {
    return (
      <span className={`${css.saveState} ${css.saveFailed}`} role="alert">
        {state.error instanceof Error ? state.error.message : String(state.error)}
      </span>
    )
  }
  if (dirty) {
    return <span className={css.saveState}>단계를 넘기면 저장됩니다</span>
  }
  return <span className={css.saveState}>{`임시 저장됨 · ${savedAtLabel(updatedAt, Date.now())}`}</span>
}
