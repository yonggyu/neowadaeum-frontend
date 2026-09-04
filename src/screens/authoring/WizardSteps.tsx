import type { AuthoringGenre } from '../../api/endpoints/authoring'
import { ImageSlotField } from './ImageSlotField'
import {
  characterField,
  characterFieldPaths,
  emptyCharacter,
  FIELD,
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
 * Step 3 — 등장인물 (3d · 6a). 이름 필드가 검수의 최우선 지점이다 (3d).
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
}: StepProps) {
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
      <h1 className={css.pageTitle}>등장인물</h1>
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
    </>
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
