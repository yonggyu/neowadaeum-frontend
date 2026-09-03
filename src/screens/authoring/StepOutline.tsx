import { useState } from 'react'

import type { ConditionTemplateKey } from '../../api/endpoints/authoring'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import {
  chapterField,
  chapterFieldPaths,
  chaptersMissingSeed,
  emptyChapter,
  emptyEnding,
  endingField,
  endingFieldPaths,
  endingsMissingCondition,
  setDefaultEnding,
  type ChapterDraft,
  type EndingDraft,
  type OutlineValues,
} from './outline'
import { moveItem } from './stepFields'
import { useOutlineDraft, type OutlineJob } from './useOutlineDraft'
import type { PrecheckHandle } from './usePrecheck'
import { DraftField } from './WizardField'
import css from './wizard.module.css'

/**
 * Step 4 — 챕터 & 엔딩 (와이어프레임 3e · 6a).
 *
 * **3e 가 지운 것을 다시 그리지 않는다.**
 * - 개수 상한(챕터 3~10 · 엔딩 1~5)을 말하지 않는다 — 상한은 백엔드 B-60 이 정하고 계약이
 *   값을 주지 않는다. 정해진 것은 *"작성 중인 원고 10개"* 뿐이다 (정정본 §13-32).
 * - 조건은 **드롭다운 하나**다. `[호감도 ▾][유나 ▾][30 이상 ▾]` 같은 3단은 계약에 자리가
 *   없다 — `conditionTemplateKey` 는 문자열 하나이고 대상·임계값을 담지 못한다.
 *
 * **입력 칸은 Step 1~3 과 같은 `DraftField` 다.** 같은 모양이라서가 아니라 같은 일을 하기
 * 때문이다 — 작성자가 쓴 글이고, 그래서 입력 중 검수(R8.1)의 대상이며, 6a 가 정한 대로
 * 결과가 필드 바로 아래 인라인으로 붙어야 한다.
 */
export interface StepOutlineProps {
  draftId: string
  values: OutlineValues
  onChange: (values: OutlineValues) => void
  precheck: PrecheckHandle
}

export function StepOutline({ draftId, values, onChange, precheck }: StepOutlineProps) {
  const outline = useOutlineDraft(draftId, values, onChange)
  const [confirming, setConfirming] = useState(false)

  if (outline.job.kind !== 'editing') {
    return (
      <OutlineIntro
        job={outline.job}
        onGenerate={() => void outline.generate()}
        onWriteManually={outline.writeManually}
      />
    )
  }

  /**
   * 순서가 바뀌거나 하나가 빠지면 **자리의 뜻이 달라진다** — `chapters[1].summarySeed` 가
   * 가리키는 챕터가 다른 챕터가 된다. 옛 검수 결과를 버리고 남은 것들을 다시 물어보는
   * 이유가 이것이며, `StepCharacters` 의 `restack` 과 같은 판단이다.
   */
  function restack(next: OutlineValues): void {
    onChange(next)
    precheck.forget([
      ...chapterFieldPaths(Math.max(values.chapters.length, next.chapters.length)),
      ...endingFieldPaths(Math.max(values.endings.length, next.endings.length)),
    ])
    next.chapters.forEach((chapter, index) => {
      precheck.check(chapterField(index, 'title'), chapter.title)
      precheck.check(chapterField(index, 'summarySeed'), chapter.summarySeed)
    })
    next.endings.forEach((ending, index) => {
      precheck.check(endingField(index, 'label'), ending.label)
      precheck.check(endingField(index, 'epilogueText'), ending.epilogueText)
    })
  }

  const missingSeed = chaptersMissingSeed(values.chapters)
  const missingCondition = endingsMissingCondition(values.endings)

  return (
    <>
      <div className={css.listHead}>
        <h1 className={css.pageTitle}>챕터</h1>
        <div className={css.rowActions}>
          {/*
           * 다시 생성은 **손으로 고친 것을 통째로 덮는다** — 초안 응답에 챕터와 엔딩이 함께
           * 오므로 두 목록이 다 바뀐다. 되돌릴 길이 없으므로 무엇을 잃는지 먼저 말한다.
           */}
          <button type="button" className={css.button} onClick={() => setConfirming(true)}>
            ↻ 다시 생성
          </button>
          <button
            type="button"
            className={css.button}
            onClick={() => restack({ ...values, chapters: [...values.chapters, emptyChapter()] })}
          >
            + 챕터 추가
          </button>
        </div>
      </div>

      {values.chapters.map((chapter, index) => (
        <ChapterCard
          key={index}
          index={index}
          total={values.chapters.length}
          chapter={chapter}
          templates={outline.templates}
          missingSeed={missingSeed.includes(index)}
          precheck={precheck}
          onChange={(next) =>
            onChange({
              ...values,
              chapters: values.chapters.map((c, i) => (i === index ? next : c)),
            })
          }
          onMove={(to) => restack({ ...values, chapters: moveItem(values.chapters, index, to) })}
          onRemove={() =>
            restack({ ...values, chapters: values.chapters.filter((_, i) => i !== index) })
          }
        />
      ))}

      <div className={css.listHead}>
        <h2 className={css.pageTitle}>엔딩</h2>
        <div className={css.rowActions}>
          <button
            type="button"
            className={css.button}
            onClick={() => restack({ ...values, endings: [...values.endings, emptyEnding()] })}
          >
            + 엔딩 추가
          </button>
        </div>
      </div>

      {values.endings.map((ending, index) => (
        <EndingCard
          key={index}
          index={index}
          total={values.endings.length}
          ending={ending}
          templates={outline.templates}
          missingCondition={missingCondition.includes(index)}
          precheck={precheck}
          onChange={(next) =>
            onChange({
              ...values,
              endings: values.endings.map((e, i) => (i === index ? next : e)),
            })
          }
          /* 라디오다 — 하나를 켜면 나머지가 꺼진다. 그 불변은 `setDefaultEnding` 한 곳에 있다 */
          onDefault={() => onChange({ ...values, endings: setDefaultEnding(values.endings, index) })}
          onMove={(to) => restack({ ...values, endings: moveItem(values.endings, index, to) })}
          onRemove={() =>
            restack({ ...values, endings: values.endings.filter((_, i) => i !== index) })
          }
        />
      ))}

      {confirming ? (
        <ConfirmDialog
          title="초안을 다시 생성할까요?"
          confirmLabel="다시 생성"
          pendingLabel="생성 중…"
          cancelLabel="취소"
          onConfirm={outline.generate}
          onCancel={() => setConfirming(false)}
        >
          <p className={css.body}>
            지금 화면에 있는 챕터와 엔딩이 새 초안으로 바뀝니다. 손으로 고친 내용은 남지 않습니다.
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  )
}

/**
 * 초안을 받기 전 · 받는 중 · 실패 (3e 의 첫 판).
 *
 * 셋을 한 컴포넌트에 둔 이유는 **같은 자리에서 갈리기 때문**이다 — 어느 쪽이든 이 단계에는
 * 아직 편집할 것이 없고, 빠져나가는 길("직접 작성하기")도 셋 모두에서 같다.
 */
function OutlineIntro({
  job,
  onGenerate,
  onWriteManually,
}: {
  job: OutlineJob
  onGenerate: () => void
  onWriteManually: () => void
}) {
  const generating = job.kind === 'generating'
  return (
    <div className={css.outlineIntro}>
      <p className={css.outlineIntroTitle}>
        {generating ? '세계관과 캐릭터를 바탕으로 챕터 초안을 쓰고 있어요' : '챕터와 엔딩을 어떻게 시작할까요?'}
      </p>
      {generating ? (
        <span className={css.dots} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ) : null}
      <p className={css.meta}>생성 후 자유롭게 편집할 수 있어요.</p>
      {/* 실패의 문구는 서버가 준 것 그대로다 (F-4) — 504 · 502 · 429 를 우리가 다시 쓰지 않는다 */}
      {job.kind === 'failed' ? (
        <p className={css.blockedMessage} role="alert">
          {job.error.message}
        </p>
      ) : null}
      <div className={css.rowActions}>
        <button
          type="button"
          className={`${css.button} ${css.primary}`}
          onClick={onGenerate}
          disabled={generating}
        >
          {job.kind === 'failed' ? '다시 시도' : 'AI 초안 받기'}
        </button>
        <button type="button" className={`${css.button} ${css.dashed}`} onClick={onWriteManually}>
          직접 작성하기
        </button>
      </div>
    </div>
  )
}

interface ChapterCardProps {
  index: number
  total: number
  chapter: ChapterDraft
  templates: readonly ConditionTemplateKey[]
  missingSeed: boolean
  precheck: PrecheckHandle
  onChange: (chapter: ChapterDraft) => void
  onMove: (to: number) => void
  onRemove: () => void
}

function ChapterCard({
  index,
  total,
  chapter,
  templates,
  missingSeed,
  precheck,
  onChange,
  onMove,
  onRemove,
}: ChapterCardProps) {
  return (
    <section className={css.card}>
      <CardHead
        label={`CHAPTER ${pad(index + 1)}`}
        index={index}
        total={total}
        onMove={onMove}
        onRemove={onRemove}
      />
      <DraftField
        field={chapterField(index, 'title')}
        label="제목"
        control="input"
        value={chapter.title}
        onChange={(title) => onChange({ ...chapter, title })}
        precheck={precheck}
      />
      <DraftField
        field={chapterField(index, 'summarySeed')}
        label="줄거리 씨앗"
        hint="필수"
        control="textarea"
        value={chapter.summarySeed}
        onChange={(summarySeed) => onChange({ ...chapter, summarySeed })}
        precheck={precheck}
      />
      {missingSeed ? (
        <p className={css.blockedMessage}>줄거리 씨앗을 채워야 다음으로 넘어갈 수 있습니다.</p>
      ) : null}
      <ConditionSelect
        id={`${chapterField(index, 'title')}--condition`}
        label="전환 조건"
        templates={templates}
        value={chapter.conditionTemplateKey}
        onChange={(conditionTemplateKey) => onChange({ ...chapter, conditionTemplateKey })}
      />
    </section>
  )
}

interface EndingCardProps {
  index: number
  total: number
  ending: EndingDraft
  templates: readonly ConditionTemplateKey[]
  missingCondition: boolean
  precheck: PrecheckHandle
  onChange: (ending: EndingDraft) => void
  onDefault: () => void
  onMove: (to: number) => void
  onRemove: () => void
}

function EndingCard({
  index,
  total,
  ending,
  templates,
  missingCondition,
  precheck,
  onChange,
  onDefault,
  onMove,
  onRemove,
}: EndingCardProps) {
  return (
    <section className={css.card}>
      <CardHead
        label={`ENDING ${pad(index + 1)}`}
        index={index}
        total={total}
        onMove={onMove}
        onRemove={onRemove}
      />
      <DraftField
        field={endingField(index, 'label')}
        label="엔딩 이름"
        control="input"
        value={ending.label}
        onChange={(label) => onChange({ ...ending, label })}
        precheck={precheck}
      />
      {/*
       * `type="radio"` 에 같은 `name` 을 준다 — 하나만 켜지는 것이 브라우저의 기본 동작이고,
       * 키보드 화살표 이동도 그것을 따라온다. 값을 바꾸는 쪽은 `setDefaultEnding` 이다.
       */}
      <label className={css.radioRow} htmlFor={`${endingField(index, 'label')}--default`}>
        <input
          type="radio"
          id={`${endingField(index, 'label')}--default`}
          name="ending-default"
          checked={ending.isDefault}
          onChange={onDefault}
        />
        <span>기본 엔딩</span>
      </label>
      {/*
       * 기본 엔딩에는 조건 칸이 없다 — 계약이 그렇게 적었다: *"기본 엔딩은 조건을 갖지 않고,
       * 일반 엔딩은 조건을 반드시 갖는다"* (R2.11, 정정본 §13-16).
       */}
      {ending.isDefault ? (
        <p className={css.meta}>기본 엔딩은 조건 없이 도달합니다.</p>
      ) : (
        <>
          <ConditionSelect
            id={`${endingField(index, 'label')}--condition`}
            label="도달 조건"
            templates={templates}
            value={ending.conditionTemplateKey}
            onChange={(conditionTemplateKey) => onChange({ ...ending, conditionTemplateKey })}
          />
          {missingCondition ? (
            <p className={css.meta}>기본이 아닌 엔딩에는 도달 조건이 필요합니다.</p>
          ) : null}
        </>
      )}
      <DraftField
        field={endingField(index, 'epilogueText')}
        label="에필로그"
        control="textarea"
        value={ending.epilogueText}
        onChange={(epilogueText) => onChange({ ...ending, epilogueText })}
        precheck={precheck}
      />
    </section>
  )
}

/**
 * 조건 템플릿 하나를 고른다 (3e).
 *
 * **키를 그대로 보여 준다.** 계약이 표시 라벨을 아직 정하지 않았고(*"표시 라벨은 아직 여기
 * 없다"*, 백엔드 #282) 3e 도 문구를 그리지 않았다 — 여기서 지어 두면 그것이 그대로 규칙이
 * 된다. 없는 디자인을 채우는 대신 없다는 사실을 화면이 말한다.
 */
function ConditionSelect({
  id,
  label,
  templates,
  value,
  onChange,
}: {
  id: string
  label: string
  templates: readonly ConditionTemplateKey[]
  value: string | null
  onChange: (value: string | null) => void
}) {
  return (
    <div className={css.field}>
      <label className={css.fieldLabel} htmlFor={id}>
        {label}
        <span className={css.fieldHint}> · 표시 문구는 아직 정해지지 않았습니다</span>
      </label>
      <select
        id={id}
        className={css.control}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">선택 안 함</option>
        {templates.map((template) => (
          <option key={template} value={template}>
            {template}
          </option>
        ))}
      </select>
    </div>
  )
}

/** 카드 머리 — 번호와 순서·삭제. 챕터와 엔딩이 같은 모양이고 같은 일을 한다 (3e). */
function CardHead({
  label,
  index,
  total,
  onMove,
  onRemove,
}: {
  label: string
  index: number
  total: number
  onMove: (to: number) => void
  onRemove: () => void
}) {
  return (
    <div className={css.cardHead}>
      <span className={css.fieldLabel}>{label}</span>
      {/* 순서는 **버튼**이다 — 드래그만 두면 키보드와 스크린리더에 길이 없다 (3d 와 같다) */}
      <div className={css.cardActions}>
        <button
          type="button"
          className={css.iconButton}
          onClick={() => onMove(index - 1)}
          disabled={index === 0}
        >
          <span aria-hidden="true">↑</span>
          <span className={css.srOnly}>{`${label} 위로`}</span>
        </button>
        <button
          type="button"
          className={css.iconButton}
          onClick={() => onMove(index + 1)}
          disabled={index === total - 1}
        >
          <span aria-hidden="true">↓</span>
          <span className={css.srOnly}>{`${label} 아래로`}</span>
        </button>
        <button type="button" className={css.iconButton} onClick={onRemove}>
          삭제
        </button>
      </div>
    </div>
  )
}

const pad = (value: number): string => String(value).padStart(2, '0')
