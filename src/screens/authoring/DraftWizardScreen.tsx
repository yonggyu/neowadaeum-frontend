import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { getDraft, updateDraft, type Draft, type Finding } from '../../api/endpoints/authoring'
import { ROUTES } from '../../routes/routes'
import { ErrorNotice } from '../account/ErrorNotice'
import { useResource } from '../library/useResource'
import css from './wizard.module.css'
import { clampStep, draftTitle, isBlocked, savedAtLabel, STEP_COUNT, STEP_LABELS } from './draft'

/**
 * 작품 만들기 마법사의 **골격** (와이어프레임 6a).
 *
 * 이 화면이 지금 하는 일은 넷이다 — 상단 고정 진행바 · 임시 저장 표시 · 나가기 ·
 * 단계 이동(이전/다음이 `patchDraft` 로 실제 저장된다). **각 단계의 입력 폼은 아직 없다**
 * (#54 는 골격까지, 입력은 다음 이슈다). 그것을 화면이 직접 말한다 — 비어 있는 화면은
 * 돌아가는 것처럼 보이기 때문이다.
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
  const [save, setSave] = useState<SaveState>({ kind: 'saved' })

  const step = clampStep(draft.step)
  const blocked = isBlocked(draft.safetyState)

  async function moveTo(next: number): Promise<void> {
    setSave({ kind: 'saving' })
    try {
      /*
       * `payload` 를 **그대로 되돌려 보낸다.** 이 골격에는 입력 폼이 없어 바꿀 것이 없고,
       * 빈 객체를 보내면 서버에 저장된 원고가 지워진다. 입력이 붙는 이슈에서 이 자리가
       * 각 Step 의 값으로 바뀐다.
       */
      setDraft(await updateDraft(draft.draftId, { step: next, payload: draft.payload ?? {} }))
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
          <SaveIndicator state={save} updatedAt={draft.updatedAt} />
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
          <h1 className={css.pageTitle}>{draftTitle(draft.payload)}</h1>

          {/*
           * 입력 폼이 들어올 자리. **빈 컴포넌트로 두지 않는다** — 무엇이 아직 없는지를
           * 화면이 말한다. 이 문단은 Step 화면이 붙는 이슈에서 통째로 사라진다.
           */}
          <div className={css.placeholder}>
            <h2 className={css.placeholderTitle}>{`${STEP_LABELS[step - 1]} 입력은 아직 붙지 않았습니다`}</h2>
            <p className={css.body}>
              지금 이 화면이 하는 일은 단계 이동과 임시 저장까지입니다. 다섯 단계의 입력 폼(3d ·
              3e)과 실시간 검수 · 초안 생성 · 미리보기는 다음 작업에서 이 자리에 들어옵니다.
            </p>
          </div>

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

        {/*
         * 우측 패널 (6a) — 1024 부터 sticky 로 붙고, 768 이하에서는 본문 아래로 내려온다.
         * 6a 는 Step 마다 다른 것을 담는다고 정했다(1·2 미리보기 · 3 검수 · 4 흐름 · 5 세션).
         * **지금 실을 수 있는 것은 검수 결과 하나뿐**이라 그것만 싣고, 나머지는 적어 둔다.
         */}
        <aside className={css.side} aria-label="검수">
          <h2 className={css.sideTitle}>검수 · 이 원고에서 걸린 것</h2>
          {draft.findings.length === 0 ? (
            <p className={css.meta}>
              {blocked ? '수정이 필요한 곳이 있습니다.' : '지금까지 걸린 곳이 없습니다.'}
            </p>
          ) : (
            <ul className={css.findings}>
              {draft.findings.map((finding) => (
                <li key={`${finding.field}:${finding.span.join('-')}`} className={css.finding}>
                  <FindingItem finding={finding} />
                </li>
              ))}
            </ul>
          )}
          <p className={css.meta}>
            커버 · 소개 미리보기(Step 1·2)와 챕터 흐름(Step 4) · 미리보기 세션(Step 5)은 아직
            이 자리에 없습니다.
          </p>
        </aside>
      </div>
    </main>
  )
}

/**
 * 검수 항목 하나.
 *
 * **서버가 준 `message` 와 `field` 까지만 보여 준다.** `kind` 를 우리 문구로 옮기지 않고
 * 무엇이 걸렸는지도 덧붙이지 않는다 (F-5) — 계약이 `Finding` 에 걸린 항목 자체를 담지 않은
 * 이유와 같다: 우회 학습을 돕는다 (R8.7, S-11).
 */
function FindingItem({ finding }: { finding: Finding }) {
  return (
    <>
      <span className={css.body}>{finding.message}</span>
      <span className={css.meta}>{finding.field}</span>
    </>
  )
}

/**
 * 임시 저장 표시 (6a — Header 우측, 저장 버튼 없음).
 *
 * 실패를 조용히 넘기지 않는다. 저장 버튼이 없다는 것은 **사용자가 다시 누를 수단이 없다**는
 * 뜻이므로, 실패했을 때 서버의 문구를 그대로 내는 것이 유일한 안내다 (F-4).
 */
function SaveIndicator({ state, updatedAt }: { state: SaveState; updatedAt: string }) {
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
  return <span className={css.saveState}>{`임시 저장됨 · ${savedAtLabel(updatedAt, Date.now())}`}</span>
}
