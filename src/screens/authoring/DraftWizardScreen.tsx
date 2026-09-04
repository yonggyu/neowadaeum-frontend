import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  getAuthoringMetadata,
  getDraft,
  updateDraft,
  type AuthoringGenre,
  type AuthoringMetadata,
  type Draft,
} from '../../api/endpoints/authoring'
import { ROUTES } from '../../routes/routes'
import { ErrorNotice } from '../account/ErrorNotice'
import { useResource } from '../library/useResource'
import css from './wizard.module.css'
import { clampStep, isBlocked, savedAtLabel, STEP_COUNT, STEP_LABELS } from './draft'
import {
  chaptersMissingSeed,
  readOutline,
  writeOutline,
  type ConditionSources,
  type OutlineValues,
} from './outline'
import { StepOutline } from './StepOutline'
import { PreviewPanel, StepPublish } from './StepPreview'
import { readValues, writeValues, type StepValues } from './stepFields'
import { usePrecheck, type PrecheckHandle } from './usePrecheck'
import { usePreviewSession, type PreviewHandle } from './usePreviewSession'
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
  const draft = useResource(useCallback((signal: AbortSignal) => getDraft(id, signal), [id]))
  /*
   * 작성 메타데이터 (`getAuthoringMetadata`, backend #282 · #315).
   *
   * **원고와 함께 게이트에 둔다.** 장르 칩과 조건 템플릿이 이 응답에서 오므로, 없으면 Step 1
   * 은 고를 것이 하나도 없는 화면이 되고 Step 4 는 조건 칸이 빈 드롭다운이 된다 — 비어 있는
   * 화면은 돌아가는 것처럼 보인다. 실패는 실패로 말하고 다시 시도할 길을 준다.
   */
  const metadata = useResource(
    useCallback((signal: AbortSignal) => getAuthoringMetadata(signal), []),
  )

  function retry(): void {
    draft.reload()
    metadata.reload()
  }

  if (draft.resource.status === 'loading' || metadata.resource.status === 'loading') {
    return (
      <main className={css.screen} data-screen="DraftWizardScreen">
        <p className={css.status}>불러오는 중…</p>
      </main>
    )
  }
  if (draft.resource.status === 'failed') {
    return <WizardFailure error={draft.resource.error} onRetry={retry} />
  }
  if (metadata.resource.status === 'failed') {
    return <WizardFailure error={metadata.resource.error} onRetry={retry} />
  }

  return <Wizard draft={draft.resource.data} metadata={metadata.resource.data} />
}

/**
 * 열리지 않은 마법사.
 *
 * **`403` 과 `404` 를 구분해 말하지 않는다.** 남의 원고는 없는 것과 구분되지 않는다 (I-8) —
 * 화면이 "권한이 없습니다" 와 "없습니다" 를 나눠 말하면 원고 id 를 훑어 남이 무엇을 쓰고
 * 있는지 알 수 있다. 서버의 `message` 를 그대로 낸다 (F-4).
 */
function WizardFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <main className={css.screen} data-screen="DraftWizardScreen">
      <ErrorNotice error={error} onRetry={onRetry} />
    </main>
  )
}

type SaveState =
  | { kind: 'saved' }
  | { kind: 'saving' }
  | { kind: 'failed'; error: unknown }

function Wizard({ draft: loaded, metadata }: { draft: Draft; metadata: AuthoringMetadata }) {
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
  /*
   * 미리보기 세션은 **마법사가 든다.** Step 5 의 좌우 두 자리가 같은 세션을 봐야 하고,
   * 각자 만들면 미리보기가 두 번 발행된다 (정정본 §13-37). 시작하기 전에는 아무것도 부르지
   * 않으므로 다른 단계에서 이 훅이 하는 일은 없다.
   */
  const preview = usePreviewSession(draft.draftId)

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
          {step === 1 ? (
            <StepBasics
              values={values}
              onChange={edit}
              precheck={precheck}
              genres={metadata.genres}
            />
          ) : null}
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
              templates={metadata.conditionTemplates}
              sources={conditionSources(values)}
            />
          ) : null}
          {step === 5 ? <StepPublish draftId={draft.draftId} preview={preview} /> : null}

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
             * **마지막 단계에는 "다음" 이 없다.** 그 자리의 행동은 제출이고, 제출은 무엇으로
             * 공개할지를 함께 정해야 한다 — 그래서 버튼이 공개 범위 옆(`StepPublish`)에 있다.
             */}
            {step === STEP_COUNT ? null : (
              <button
                type="button"
                className={`${css.button} ${css.primary}`}
                onClick={() => void moveTo(step + 1)}
                disabled={blocked || save.kind === 'saving'}
              >
                {`다음 · ${STEP_LABELS[step]}`}
              </button>
            )}
          </div>
        </section>

        <SidePanel
          step={step}
          genres={metadata.genres}
          values={values}
          outline={outline}
          precheck={precheck}
          preview={preview}
          onEdit={() => void moveTo(4)}
        />
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
  genres: catalog,
  values,
  outline,
  precheck,
  preview,
  onEdit,
}: {
  step: number
  genres: readonly AuthoringGenre[]
  values: StepValues
  outline: OutlineValues
  precheck: PrecheckHandle
  preview: PreviewHandle
  onEdit: () => void
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

  /*
   * Step 5 의 패널만 **모든 폭에서 보인다** (`sideAlways`). 6a 는 768 이하에서 우측 패널을
   * 걷으라고 했지만 그 문장의 이유는 *"검수는 필드 아래 인라인, 미리보기는 Step 5로 이동"* —
   * 즉 좁은 폭에서 갈 곳이 있는 내용에 한한다. 미리보기 세션은 갈 곳이 없다: 여기서 걷으면
   * 390 과 768 에는 체험할 자리가 아예 없어진다. 대신 1열에서는 공개 설정보다 **위**에 온다.
   */
  if (step === 5) {
    return (
      <aside className={`${css.side} ${css.sideAlways}`} aria-label="미리보기">
        <h2 className={css.sideTitle}>{STEP_LABELS[step - 1]}</h2>
        <PreviewPanel preview={preview} onEdit={onEdit} />
      </aside>
    )
  }

  const genres = catalog.filter((genre) => values.genres.includes(genre.key))

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

/**
 * 조건이 고를 수 있는 값이 **어디서 오는가** (§13-56).
 *
 * 인물은 Step 3 에서 작성자가 만든 사람들이다 — 서버가 줄 수 없는 값이고(원고마다 다르다)
 * 계약도 그 사실을 적었다. 이름이 비어 있는 인물은 고를 수 없다: 빈 문자열을 조건에 담으면
 * 아무도 가리키지 않는 조건이 된다.
 *
 * **플래그는 지금 언제나 비어 있다.** 원고가 플래그를 *선언하는* 자리가 3d~3e 어디에도 없고,
 * 없는 화면을 여기서 지어내지 않는다 (CLAUDE.md 4번). 그래서 `has_flag` · `lacks_flag` 는
 * `templateBlockedReason` 이 이유와 함께 잠근다 — 조용히 빈 드롭다운을 그리는 것보다 낫다.
 * 플래그 선언 화면은 **별도 이슈**다.
 */
function conditionSources(values: StepValues): ConditionSources {
  return {
    characters: values.characters
      .map((character) => character.name.trim())
      .filter((name) => name !== ''),
    flags: [],
  }
}
