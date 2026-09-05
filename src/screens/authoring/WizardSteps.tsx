import { useState } from 'react'

import type { AuthoringGenre, ConditionTemplateSpec } from '../../api/endpoints/authoring'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import {
  flagJumpLabel,
  flagReferenceNote,
  flagRemovalWarning,
  flagRemovedEntirely,
} from './flagsView'
import { ImageSlotField } from './ImageSlotField'
import {
  templateBlockedReason,
  type ConditionSources,
  type FlagReference,
} from './outline'
import {
  characterField,
  characterFieldPaths,
  emptyCharacter,
  FIELD,
  flagField,
  FLAG_MAX_COUNT,
  FLAG_NAME_MAX,
  moveCharacter,
  SETTING_DETAIL_MAX,
  SHORT_DESCRIPTION_MAX,
  toggleGenre,
  WORLD_INTRO_MAX,
  type CharacterDraft,
  type StepValues,
} from './stepFields'
import type { PrecheckHandle } from './usePrecheck'
import { DraftField } from './WizardField'
import css from './wizard.module.css'

/**
 * Step 1~3 의 입력 (와이어프레임 3d).
 *
 * 세 Step 이 한 파일에 있는 이유는 **셋이 같은 값 하나(`StepValues`)를 고치기 때문**이다.
 * 파일을 셋으로 나누면 그 값을 넘기는 배관만 세 벌이 되고, 각 파일이 실제로 하는 일은
 * 입력 칸 두셋을 그리는 것뿐이다.
 */
export interface StepProps {
  /** 이미지 자리가 이 원고에 발급을 요청한다 — **키(경로)는 서버가 정한다** (§13-65) */
  draftId: string
  values: StepValues
  onChange: (values: StepValues) => void
  precheck: PrecheckHandle
  /**
   * 이미지 자리 하나가 진행 중인지 마법사에 알린다.
   *
   * 진행 중에 단계가 넘어가면 **확정이 끝나기 전의 원고**가 저장되고, 그 자리는 언마운트되면서
   * 업로드가 중단된다 — 사용자는 올렸다고 믿은 이미지가 없는 채로 다음 화면을 본다.
   */
  onImageBusy: (key: string, busy: boolean) => void
}

/**
 * Step 1 — 기본 정보 (3d).
 *
 * **장르 목록을 이 파일이 들고 있지 않다.** `getAuthoringMetadata` 가 주고 (backend #282 ·
 * #315), 정본은 `catalog` 의 `genre` 표다 — 코드에 다섯을 적으면 라이브러리가 여는 섹션과
 * 작성자가 고를 수 있는 목록이 갈라진다 (§13-56). **순서도 서버의 것이다** (`display_order`).
 */
export function StepBasics({
  draftId,
  values,
  onChange,
  precheck,
  onImageBusy,
  genres,
}: StepProps & { genres: readonly AuthoringGenre[] }) {
  return (
    <>
      <h1 className={css.pageTitle}>어떤 이야기인가요?</h1>
      <DraftField
        field={FIELD.title}
        label="제목"
        control="input"
        value={values.title}
        onChange={(title) => onChange({ ...values, title })}
        precheck={precheck}
      />

      {/*
       * 장르는 검수 대상이 아니다 — 사용자가 쓴 글이 아니라 **고른 값**이고, 목록은 우리가
       * 준다. precheck 로 보내면 우리가 준 값을 우리에게 되묻는 셈이 된다.
       */}
      <fieldset className={css.field}>
        <legend className={css.fieldLabel}>장르 · 다중 선택</legend>
        <div className={css.chips}>
          {genres.map((genre) => {
            const on = values.genres.includes(genre.key)
            return (
              <button
                key={genre.key}
                type="button"
                aria-pressed={on}
                className={on ? `${css.chip} ${css.chipOn}` : css.chip}
                onClick={() => onChange({ ...values, genres: toggleGenre(values.genres, genre.key) })}
              >
                {genre.label}
              </button>
            )
          })}
        </div>
      </fieldset>

      <DraftField
        field={FIELD.shortDescription}
        label="한줄소개"
        control="input"
        max={SHORT_DESCRIPTION_MAX}
        value={values.shortDescription}
        onChange={(shortDescription) => onChange({ ...values, shortDescription })}
        precheck={precheck}
      />
      {/*
       * 대표 이미지 (7차 `ImageUpload` · #88). **원고에 적히는 값은 객체 키다** — 응답에
       * 이미지 주소가 없고(I-8) 화면이 주소를 조립하지 않는다.
       */}
      <ImageSlotField
        draftId={draftId}
        slot="cover"
        label="대표 이미지"
        hint="독자에게 보입니다"
        note="라이브러리 카드와 작품 상세가 2:3 으로 보여 줍니다."
        objectKey={values.coverImage}
        onChange={(coverImage) => onChange({ ...values, coverImage })}
        busyKey={FIELD.coverImage}
        onBusyChange={onImageBusy}
      />
    </>
  )
}

/**
 * Step 2 — 세계관 (3d).
 *
 * **두 칸의 대상이 다르다는 것을 라벨이 말한다.** 3d 가 그렇게 적었고, 그 한 줄이 없으면
 * 작성자는 설정 상세에 독자용 소개문을 쓴다 — 그리고 그것이 매 턴 프롬프트로 나간다.
 */
export function StepWorld({ values, onChange, precheck }: StepProps) {
  return (
    <>
      <h1 className={css.pageTitle}>세계관을 알려주세요</h1>
      <DraftField
        field={FIELD.worldIntro}
        label="배경 소개"
        hint="독자에게 보입니다"
        control="textarea"
        max={WORLD_INTRO_MAX}
        value={values.worldIntro}
        onChange={(worldIntro) => onChange({ ...values, worldIntro })}
        precheck={precheck}
      />
      <DraftField
        field={FIELD.settingDetail}
        label="설정 상세"
        hint="AI에게만 전달됩니다"
        control="textarea"
        max={SETTING_DETAIL_MAX}
        nearLimitNote="상한에 거의 도달했습니다. 설정이 길면 매 턴 생성 비용이 늘어납니다."
        value={values.settingDetail}
        onChange={(settingDetail) => onChange({ ...values, settingDetail })}
        precheck={precheck}
      />
    </>
  )
}

/**
 * Step 3 이 플래그 절을 그리는 데 필요한 것 (7차 `A-1` · #125).
 *
 * **마법사가 이미 다 들고 있는 것을 골라 받는다.** 개요(`OutlineValues`)도 메타데이터 응답도
 * 통째로 내려오지 않는다 — 이 단계가 실제로 묻는 것은 셋뿐이다: *이 이름을 가리키는 조건이
 * 어디 있는가* · *지금 Step 4 가 무엇을 잠그는가* · *지우거나 보러 갈 때 무엇을 부르는가*.
 */
export interface FlagStepProps {
  /** `getAuthoringMetadata` 의 템플릿 선언. D-7 의 미리보기가 라벨을 여기서 받는다 (§13-56) */
  templates: readonly ConditionTemplateSpec[]
  /** 조건이 고를 수 있는 이름 — D-7 의 잠금 사유가 이것으로 판정된다 */
  sources: ConditionSources
  /** 이 **이름**을 가리키는 조건들 (D-4). 같은 이름이 둘이면 둘 다 같은 목록을 보여 준다 */
  referencesTo: (flag: string) => readonly FlagReference[]
  /** D-5 의 *[지우고 조건 비우기]* — 값과 개요를 **함께** 옮기는 것은 마법사의 일이다 */
  onRemoveFlag: (index: number) => void
  /** D-5 의 *[엔딩 3 으로]* — Step 4 로 옮긴 **뒤** 그 필드에 초점을 준다 */
  onGoToReference: (reference: FlagReference) => void
}

/**
 * Step 3 — 등장인물과 플래그 (3d · 6a · 7차 `A-1`). 이름 필드가 검수의 최우선 지점이다 (3d).
 *
 * **한 줄 소개와 페르소나의 대상이 다르다는 것을 라벨이 말한다.** 3d 가 세계관 쪽(배경 소개 ·
 * 설정 상세)에 세운 구분을 인물 카드에 그대로 옮긴 것이고, 그 한 줄이 없으면 작성자는 독자용
 * 문장 하나로 두 가지 일을 시킨다 — 그것이 지금까지 매 턴 프롬프트로 나가던 값이다 (#350).
 *
 * **개수 상한을 화면이 말하지 않는다** — 계약도 정정본도 값을 주지 않는다. 지어 두면 그
 * 숫자가 규칙이 된다. `persona` 의 글자 수 상한도 같은 이유로 없다.
 */
export function StepCharacters({
  draftId,
  values,
  onChange,
  precheck,
  onImageBusy,
  templates,
  sources,
  referencesTo,
  onRemoveFlag,
  onGoToReference,
}: StepProps & FlagStepProps) {
  /**
   * 순서가 바뀌거나 하나가 빠지면 **자리의 뜻이 달라진다** — `characters[1].name` 이 가리키는
   * 사람이 다른 사람이 된다. 옛 결과를 버리고 남은 것들을 다시 물어보는 이유가 이것이다:
   * 버리지 않으면 고치지도 않은 이름에 밑줄이 남고, 지운 사람의 밑줄이 영영 사라지지 않는다.
   */
  const restack = (characters: readonly CharacterDraft[]): void => {
    onChange({ ...values, characters })
    precheck.forget(characterFieldPaths(Math.max(values.characters.length, characters.length)))
    characters.forEach((character, index) => {
      precheck.check(characterField(index, 'name'), character.name)
      precheck.check(characterField(index, 'oneLine'), character.oneLine)
      precheck.check(characterField(index, 'persona'), character.persona)
    })
  }

  return (
    <>
      <h1 className={css.pageTitle}>등장인물과 플래그</h1>
      {values.characters.map((character, index) => (
        <CharacterCard
          key={index}
          draftId={draftId}
          index={index}
          total={values.characters.length}
          character={character}
          precheck={precheck}
          onImageBusy={onImageBusy}
          onChange={(next) =>
            onChange({
              ...values,
              characters: values.characters.map((c, i) => (i === index ? next : c)),
            })
          }
          onMove={(to) => restack(moveCharacter(values.characters, index, to))}
          onRemove={() => restack(values.characters.filter((_, i) => i !== index))}
        />
      ))}
      <button
        type="button"
        className={`${css.button} ${css.addCharacter}`}
        onClick={() =>
          onChange({ ...values, characters: [...values.characters, emptyCharacter()] })
        }
      >
        + 캐릭터 추가
      </button>

      {/*
       * 플래그 절은 **인물 목록 아래 구분선 뒤**다 (7차 `A-1` D-1). 새 스텝을 만들지 않는다 —
       * 두 목록이 하는 일이 같기 때문이다: *조건이 가리킬 수 있는 이름을 이 원고에 만든다*.
       */}
      <hr className={css.divider} />
      <FlagSection
        values={values}
        onChange={onChange}
        templates={templates}
        sources={sources}
        referencesTo={referencesTo}
        onRemoveFlag={onRemoveFlag}
        onGoToReference={onGoToReference}
      />
    </>
  )
}

/**
 * 이 원고가 선언하는 플래그 (7차 `A-1` · #125).
 *
 * **인물 카드가 아니다.** 플래그에는 순서도 초상도 소개도 없고 아트보드도 그리지 않았다 —
 * 한 줄에 입력 하나와 지우기 하나뿐이며(D-3), 값은 **문자열 하나**다 (계약 `DraftPayload.flags`).
 * 모양이 닮았다는 이유로 `CharacterCard` 와 합치면 그 순간 두 목록이 서로의 제약을 나눠 갖는다.
 *
 * **검수(precheck)에 보내지 않는다.** 계약이 플래그를 검수 대상으로 요구하지 않았고 아트보드도
 * 그 자리를 그리지 않았다 — 없는 화면을 지어내지 않는다.
 *
 * **값을 다듬지 않는다** (§13-73). `trim()` 도 하지 않고 빈 줄도 막지 않으며 쓸 수 있는 문자도
 * 좁히지 않는다: "추가" 가 빈 줄을 먼저 만드는 화면이라 빈 줄을 막으면 줄을 하나 더한 순간
 * 저장이 멈추고, 문자를 좁히면 문장부호가 섞인 정상적인 한글 이름이 거절된다. 판정도 문장도
 * 서버의 것이다 (F-4).
 */
function FlagSection({
  values,
  onChange,
  templates,
  sources,
  referencesTo,
  onRemoveFlag,
  onGoToReference,
}: Pick<StepProps, 'values' | 'onChange'> & FlagStepProps) {
  /** 확인 판이 물어보고 있는 자리. `null` 이면 판이 없다 */
  const [removing, setRemoving] = useState<number | null>(null)

  /**
   * 이 자리를 지우면 **비워질** 조건들.
   *
   * `referencesTo` 가 이름으로 세는 것과 다르다 — 같은 이름을 두 번 적었다면 하나를 지워도
   * 이름은 남고, 그것을 가리키던 조건도 멀쩡하다 (`flagRemovedEntirely`).
   */
  const lostBy = (index: number): readonly FlagReference[] =>
    flagRemovedEntirely(values.flags, index) ? referencesTo(values.flags[index] ?? '') : []

  /**
   * 지우기 — **되돌릴 것이 있을 때만 판이 뜬다** (D-5).
   *
   * 가리키는 조건이 없으면 바로 지운다. 되돌릴 것이 없는 자리에 판을 띄우면 다음부터 아무도
   * 읽지 않고, 그러면 정작 잃을 것이 있는 판도 그냥 넘어간다.
   */
  const remove = (index: number): void => {
    if (lostBy(index).length === 0) {
      onRemoveFlag(index)
      return
    }
    setRemoving(index)
  }

  const lost = removing === null ? [] : lostBy(removing)
  // 여럿이면 첫째로 데려간다 — 판은 길을 하나만 그렸고, 그 자리에 가면 나머지도 Step 4 에 있다
  const detour = lost[0]

  return (
    <section className={css.flagSection} aria-labelledby={FIELD.flags}>
      <div className={css.fieldHead}>
        {/* D-2 — 인물의 "이름 · 독자에게 보입니다" 와 짝이다. 대상이 다르다는 것을 라벨이 말한다 */}
        <h2 className={`${css.fieldLabel} ${css.flagTitle}`} id={FIELD.flags}>
          플래그
          <span className={css.fieldHint}> · 독자에게 보이지 않습니다</span>
        </h2>
        {/*
         * D-9 — 아트보드는 `3 / 12` 로 그렸다. 그 그림은 백엔드 #362 **이전**의 것이고
         * 계약이 화면을 이긴다 (CLAUDE.md): 상한은 `FLAG_MAX_COUNT` 다.
         */}
        <span className={css.fieldMeta}>{`${values.flags.length} / ${FLAG_MAX_COUNT}`}</span>
      </div>

      {values.flags.length === 0 ? (
        <FlagEmptyState templates={templates} sources={sources} />
      ) : (
        <ul className={css.flagList}>
          {values.flags.map((flag, index) => (
            <FlagRow
              key={index}
              index={index}
              flag={flag}
              references={referencesTo(flag)}
              onChange={(next) =>
                onChange({
                  ...values,
                  flags: values.flags.map((f, i) => (i === index ? next : f)),
                })
              }
              onRemove={() => remove(index)}
            />
          ))}
        </ul>
      )}

      {/* D-6 — 상한에 닿으면 더 담을 자리가 없다. 계약이 `maxItems` 로 거절할 것을 먼저 말한다 */}
      <button
        type="button"
        className={`${css.button} ${css.dashed} ${css.addFlag}`}
        disabled={values.flags.length >= FLAG_MAX_COUNT}
        onClick={() => onChange({ ...values, flags: [...values.flags, ''] })}
      >
        ＋ 플래그 추가
      </button>
      <p className={css.fieldNote}>
        여기서 선언한 이름만 Step 4 의 ‘플래그를 가졌다 · 가지지 않았다’ 조건이 고를 수 있습니다
      </p>

      {removing === null ? null : (
        <ConfirmDialog
          title={`“${values.flags[removing] ?? ''}” 를 지울까요?`}
          confirmLabel="지우고 조건 비우기"
          pendingLabel="지우는 중…"
          cancelLabel="그만두기"
          detour={
            detour === undefined
              ? undefined
              : {
                  label: flagJumpLabel(detour),
                  onSelect: () => {
                    setRemoving(null)
                    onGoToReference(detour)
                  },
                }
          }
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            onRemoveFlag(removing)
            setRemoving(null)
          }}
        >
          {flagRemovalWarning(lost)}
        </ConfirmDialog>
      )}
    </section>
  )
}

/** 한 줄 — 입력 하나와 지우기 하나 (D-3). 그 아래에 이 이름을 가리키는 자리가 붙는다 (D-4) */
function FlagRow({
  index,
  flag,
  references,
  onChange,
  onRemove,
}: {
  index: number
  flag: string
  references: readonly FlagReference[]
  onChange: (flag: string) => void
  onRemove: () => void
}) {
  const field = flagField(index)
  const note = flagReferenceNote(references)

  return (
    <li className={css.flagRow}>
      <div className={css.flagLine}>
        {/*
         * 라벨은 절에 하나뿐이므로(D-2) 줄마다 다시 적지 않는다 — 대신 낭독기가 몇 번째 줄인지
         * 알 수 있게 이름을 준다. id 는 계약의 필드 경로 그대로다 (`flagField`).
         */}
        <input
          id={field}
          type="text"
          className={css.control}
          value={flag}
          maxLength={FLAG_NAME_MAX}
          aria-label={`플래그 ${index + 1}`}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" className={css.iconButton} onClick={onRemove}>
          지우기
        </button>
      </div>
      <div className={css.flagMeta}>
        {/* D-4 — 어느 자리가 이 이름을 쓰는지. 지우기 전에 보이는 것이 판보다 먼저다 */}
        <span className={css.fieldNote}>{note ?? ''}</span>
        {/* 남은 글자는 한줄소개와 같은 방식으로 보여 준다 (`SHORT_DESCRIPTION_MAX`) */}
        <span className={css.fieldMeta}>{`${flag.length} / ${FLAG_NAME_MAX}`}</span>
      </div>
    </li>
  )
}

/**
 * 아직 하나도 없을 때 (D-7).
 *
 * **비어 있는 자리를 비어 있는 채로 두지 않는다.** 플래그는 이 마법사에서 유일하게 *무엇에
 * 쓰이는지 화면 안에서 보이지 않는* 값이다 — 인물은 카드에 얼굴이 있고 챕터는 제목이 있지만
 * 플래그는 이름 하나뿐이고, 그 이름이 어디서 쓰이는지는 **다음 단계에 있다.** 그래서 그
 * 다음 단계를 여기로 가져와 보여 준다.
 *
 * **잠금 사유를 여기서 짓지 않는다.** `templateBlockedReason` 이 정본이고, 그 문장이 바뀌면
 * 이 자리도 함께 바뀐다 — 옮겨 적으면 계약이 움직인 날 둘 중 하나만 낡는다 (표류 37).
 */
function FlagEmptyState({
  templates,
  sources,
}: {
  templates: readonly ConditionTemplateSpec[]
  sources: ConditionSources
}) {
  return (
    <div className={css.flagEmpty}>
      <p className={css.body}>아직 선언한 플래그가 없습니다</p>
      <p className={css.meta}>
        플래그는 이야기 도중에 켜지는 표시입니다. 여기서 이름을 정해 두면 챕터·엔딩의 도달
        조건이 그 이름을 가리킬 수 있습니다.
      </p>
      <p className={css.fieldLabel}>지금 Step 4 에서 이렇게 보입니다</p>
      <ul className={css.templatePeek}>
        {templates.map((template) => {
          const blocked = templateBlockedReason(template, sources)
          return (
            <li
              key={template.key}
              className={
                blocked === null ? css.templateRow : `${css.templateRow} ${css.templateLocked}`
              }
            >
              <span>{template.label}</span>
              {blocked === null ? null : <span className={css.meta}>{blocked}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface CharacterCardProps {
  draftId: string
  index: number
  total: number
  character: CharacterDraft
  precheck: PrecheckHandle
  onImageBusy: (key: string, busy: boolean) => void
  onChange: (character: CharacterDraft) => void
  onMove: (to: number) => void
  onRemove: () => void
}

function CharacterCard({
  draftId,
  index,
  total,
  character,
  precheck,
  onImageBusy,
  onChange,
  onMove,
  onRemove,
}: CharacterCardProps) {
  const nameField = characterField(index, 'name')
  const oneLineField = characterField(index, 'oneLine')
  const personaField = characterField(index, 'persona')
  const cardFields = [nameField, oneLineField, personaField]
  const blocked = precheck.findings.some((finding) => cardFields.includes(finding.field))

  return (
    <section className={blocked ? `${css.card} ${css.cardBlocked}` : css.card}>
      <div className={css.cardHead}>
        <span className={css.fieldLabel}>{`캐릭터 ${String(index + 1).padStart(2, '0')}`}</span>
        {/*
         * 순서는 **버튼**으로 바꾼다 (3d 의 "⠿ 순서"). 드래그만 두면 키보드와 스크린리더에서
         * 순서를 바꿀 방법이 없고, 그 대체 수단이 결국 이 버튼이다 — 하나만 만든다.
         */}
        <div className={css.cardActions}>
          <button
            type="button"
            className={css.iconButton}
            onClick={() => onMove(index - 1)}
            disabled={index === 0}
          >
            <span aria-hidden="true">↑</span>
            <span className={css.srOnly}>위로</span>
          </button>
          <button
            type="button"
            className={css.iconButton}
            onClick={() => onMove(index + 1)}
            disabled={index === total - 1}
          >
            <span aria-hidden="true">↓</span>
            <span className={css.srOnly}>아래로</span>
          </button>
          <button type="button" className={css.iconButton} onClick={onRemove}>
            삭제
          </button>
        </div>
      </div>
      <div className={css.cardBody}>
        {/*
         * 초상도 커버와 **같은 컴포넌트**다 — 아트보드가 정한 차이는 폭 하나뿐이다.
         * `busyKey` 는 필드 경로가 아니라 **자리를 가리는 이름**이다: 초상은 검수 대상이
         * 아니어서 `characterField` 의 경로 목록에 들어 있지 않다.
         */}
        <ImageSlotField
          draftId={draftId}
          slot="portrait"
          label="초상"
          objectKey={character.portraitImage}
          onChange={(portraitImage) => onChange({ ...character, portraitImage })}
          busyKey={`portrait-${index}`}
          onBusyChange={onImageBusy}
        />
        <div className={css.cardFields}>
          <DraftField
            field={nameField}
            label="이름"
            control="input"
            value={character.name}
            onChange={(name) => onChange({ ...character, name })}
            precheck={precheck}
          />
          <DraftField
            field={oneLineField}
            label="한 줄 소개"
            hint="독자에게 보입니다"
            control="input"
            value={character.oneLine}
            onChange={(oneLine) => onChange({ ...character, oneLine })}
            precheck={precheck}
          />
          {/*
           * **비어 있는 것이 오류가 아니다** — 비면 서버가 `oneLine` 을 대신 발행한다
           * (계약 `DraftCharacter`, 백엔드 #350). 그래서 필수 표시를 붙이지 않고, 대신
           * 무엇이 대신 가는지를 적는다: 그 사실을 모르면 작성자는 빈 칸을 미완성으로 읽고
           * 한 줄 소개를 한 번 더 옮겨 적는다.
           */}
          <div className={css.fieldGroup}>
            <DraftField
              field={personaField}
              label="페르소나"
              hint="AI에게만 전달됩니다"
              control="textarea"
              value={character.persona}
              onChange={(persona) => onChange({ ...character, persona })}
              precheck={precheck}
            />
            <p className={css.fieldNote}>비우면 한 줄 소개가 대신 쓰입니다.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
