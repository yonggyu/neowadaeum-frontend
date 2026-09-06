import type {
  ConditionTemplateParameter,
  ConditionTemplateSpec,
  DraftPayload,
  OutlineChapter,
  OutlineEnding,
  OutlineResponse,
} from '../../api/endpoints/authoring'

/**
 * Step 4 — 챕터 & 엔딩이 `payload` 안에서 읽고 쓰는 자리 (와이어프레임 3e).
 *
 * **이름의 정본은 계약이다** (`DraftPayload` 의 `DraftChapter` · `DraftEnding`, 정정본 §13-70).
 * 한동안 `payload` 는 `additionalProperties: true` 로만 열려 있었고 이름을 아무도 정해 주지
 * 않아 화면과 발행이 각자 지었다 — 그 갈라짐이 실제 마법사의 제출을 계속 `400` 으로 막았다.
 * 백엔드 #354 가 그 자리를 세우면서 **이 화면이 이미 쓰던 이름을 그대로 계약으로 채택했다.**
 * 그래서 여기서 바뀐 것은 이름이 아니라 *누가 그 이름을 정하는가*다.
 *
 * **개수 상한을 여기 두지 않는다.** 3e 가 *"챕터 3~10 · 엔딩 1~5"* 를 근거를 대고 지웠다 —
 * 상한은 백엔드 B-60 이 정하고 계약은 값을 주지 않는다. 정해진 것은 *"작성 중인 원고 10개"*
 * 뿐이다 (정정본 §13-32).
 */

/** 검사·저장의 필드 경로. `stepFields.ts` 의 `FIELD` 와 같은 이유로 화면이 직접 적지 않는다. */
export const OUTLINE_FIELD = {
  chapters: 'chapters',
  endings: 'endings',
} as const

/**
 * `chapters[0].summarySeed` — precheck 요청의 배열 표기 (계약 `PrecheckRequest.fields` 의 예시
 * 형식이 `characters[0].name` 이다). DOM id 도 이 값이며, 그래서 우측 패널의 "해당 필드로
 * 이동" 이 Step 4 의 칸도 찾아간다.
 */
export function chapterField(index: number, key: 'title' | 'summarySeed'): string {
  return `${OUTLINE_FIELD.chapters}[${index}].${key}`
}

export function endingField(index: number, key: 'label' | 'epilogueText'): string {
  return `${OUTLINE_FIELD.endings}[${index}].${key}`
}

/** 챕터 `count` 개가 차지하는 필드 경로 전부. 순서가 바뀌거나 하나가 빠질 때 옛 결과를 버린다. */
export function chapterFieldPaths(count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => [
    chapterField(index, 'title'),
    chapterField(index, 'summarySeed'),
  ]).flat()
}

export function endingFieldPaths(count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => [
    endingField(index, 'label'),
    endingField(index, 'epilogueText'),
  ]).flat()
}

/**
 * 조건 템플릿이 요구하는 값들 — `슬롯 이름 → 고른 값`.
 *
 * **슬롯 이름을 화면이 짓지 않는다.** `ConditionTemplateParameter.name` 이 그 이름이고
 * (`character` · `threshold` · `flag`), 계약이 템플릿마다 무엇이 필요한지를 선언한다
 * (정정본 §13-56) — *"키만으로는 조건이 완성되지 않는다."*
 *
 * **담는 그릇의 이름(`conditionParams`)도 이제 계약의 것이다** — 계약 `ConditionParams` 이고,
 * `conditionTemplateKey` 의 **형제 필드**로 선언되어 있다 (§13-70). §13-69 가 한때 이것을
 * `condition: {templateKey, params}` 로 한 겹 접었다가 물렸다: 초안 응답(`OutlineChapter` ·
 * `OutlineEnding`)이 키를 그 높이에 돌려주므로, 저장이 접으면 화면은 **받은 모양과 보내는
 * 모양이 다른** 상태를 매번 변환해야 하고 그 변환은 어느 날 하나를 빠뜨린다.
 *
 * 값의 형과 이름은 계약이 적어 두었다 — `character` 는 이 원고의 `characters[].name` 중
 * 하나, `flag` 는 이 원고의 `flags[]` 중 하나, `threshold` 는 **정수**이고 문자열로 온 숫자를
 * 받지 않는다. 그것을 지키는 것이 `conditionIncomplete` 다.
 *
 * 조립된 조건식을 만드는 것은 **서버의 몫**이다 (I-1 과 같은 이유) — 클라이언트가 만든 구조를
 * 그대로 평가기에 먹이면 그것이 곧 DSL 입력면이 된다.
 */
export type ConditionParams = Readonly<Record<string, string | number>>

/**
 * `character` · `flag` 의 선택지가 오는 곳.
 *
 * **이 목록을 서버가 주지 않는다** — 계약이 그렇게 적었다: *"인물은 작성 중인 원고의 캐릭터
 * 목록에서 오고, 플래그는 그 원고가 선언한 것에서 온다 — 원고마다 다르므로 서버가 전역
 * 목록으로 줄 수 있는 값이 아니다."*
 *
 * **저장 시점의 검증도 같은 목록을 본다** (계약 `ConditionParams`). 서버는 `payload` 의
 * `characters[].name` · `flags[]` 밖의 이름을 가리키는 조건을 `400` 으로 거절한다 — 받아
 * 두면 그 조건은 평가기에서 조용히 거짓이 되고 그 챕터·엔딩은 영원히 도달되지 않는다.
 */
export interface ConditionSources {
  readonly characters: readonly string[]
  readonly flags: readonly string[]
}

/** 조건을 가진 값 — 챕터와 엔딩이 같은 두 자리를 갖는다. */
export interface Conditioned {
  readonly conditionTemplateKey: string | null
  readonly conditionParams: ConditionParams
}

/**
 * 화면이 실제로 쓰는 모양. **`chapterNo` · `endingNo` 를 들고 있지 않는다.**
 *
 * 번호는 순서다 — 배열의 자리가 곧 그 값이므로 둘을 함께 들면 순서 변경·삭제마다 두 곳을
 * 맞춰야 하고, 어긋나는 날 서버는 번호를 믿고 화면은 순서를 믿는다. 번호는 저장할 때
 * `writeOutline` 이 한 곳에서 매긴다.
 */
export interface ChapterDraft extends Conditioned {
  readonly title: string
  readonly summarySeed: string
}

/**
 * **`isDefault` 가 없다** (#103).
 *
 * 계약이 `DraftEnding` 에 직접 적었다 — *"`isDefault` 를 서버가 받아들이지 않는다 (§13-16,
 * I-10). 기본 엔딩은 서버가 따로 하나를 더해 만든다."* 그러므로 **작성자가 쓴 엔딩은 모두
 * 조건을 갖는다.** 그 자리를 화면의 값 모형에 남겨 두면 화면은 계속 그것으로 무언가를
 * 결정하게 되고, 서버는 그 결정을 읽지 않는다 — 두 곳이 서로 다른 규칙을 갖는 상태다.
 */
export interface EndingDraft extends Conditioned {
  readonly label: string
  readonly epilogueText: string
}

export interface OutlineValues {
  readonly chapters: readonly ChapterDraft[]
  readonly endings: readonly EndingDraft[]
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

const nullableText = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null

/**
 * `payload` 원문을 화면의 값으로 좁힌다. 어느 자리가 비었거나 다른 타입이어도 **빈 값으로
 * 읽는다** — 초안을 한 번도 받지 않은 원고가 예외가 아니라 이 단계의 기본값이다.
 */
export function readOutline(payload: DraftPayload): OutlineValues {
  const raw: Record<string, unknown> = payload ?? {}
  const chapters = raw[OUTLINE_FIELD.chapters]
  const endings = raw[OUTLINE_FIELD.endings]
  return {
    chapters: Array.isArray(chapters) ? chapters.map(readChapter) : [],
    endings: Array.isArray(endings) ? endings.map(readEnding) : [],
  }
}

function readChapter(raw: unknown): ChapterDraft {
  const value: Record<string, unknown> = typeof raw === 'object' && raw !== null ? { ...raw } : {}
  return {
    title: text(value['title']),
    summarySeed: text(value['summarySeed']),
    conditionTemplateKey: nullableText(value['conditionTemplateKey']),
    conditionParams: readParams(value['conditionParams']),
  }
}

function readEnding(raw: unknown): EndingDraft {
  const value: Record<string, unknown> = typeof raw === 'object' && raw !== null ? { ...raw } : {}
  return {
    label: text(value['label']),
    epilogueText: text(value['epilogueText']),
    // `isDefault` 를 읽지 않는다 (#103). 이미 저장된 원고에 남아 있어도 화면은 그것으로
    // 아무것도 결정하지 않는다 — 계약이 *"참고만 한다"* 라고 적은 값이다 (§13-16).
    conditionTemplateKey: nullableText(value['conditionTemplateKey']),
    conditionParams: readParams(value['conditionParams']),
  }
}

/** 문자열과 정수만 남긴다 — 다른 타입이 들어 있으면 고르지 않은 것으로 읽는다. */
function readParams(raw: unknown): ConditionParams {
  if (typeof raw !== 'object' || raw === null) return {}
  const params: Record<string, string | number> = {}
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'number') {
      params[name] = value
    }
  }
  return params
}

/**
 * 화면의 값을 다시 `payload` 로 되돌린다 — **모르는 키를 지우지 않는다** (`writeValues` 와 같다).
 *
 * 그 보존은 **payload 의 최상위 키**에 대한 것이다. 챕터·엔딩 한 줄은 여기서 새로 만들어지므로,
 * 옛 원고의 엔딩에 남아 있던 `isDefault` 는 다음 저장에서 사라진다 (#103). 해롭지 않다 —
 * 계약이 그 값을 *"참고만 한다"* 라고 적었고 판정은 서버가 갖는다 (§13-16).
 *
 * 번호를 여기서 매긴다. 계약이 `chapterNo` · `endingNo` 를 필수로 받고 그 값의 뜻은 순서이므로,
 * 배열의 자리에서 한 번만 만든다.
 *
 * **완성되지 않은 조건은 키를 비워 내보낸다.** 서버는 저장 시점에 조건을 조립하고, 슬롯이 비었거나
 * 형이 다르거나 원고가 선언하지 않은 이름을 가리키면 `400` 이다 (계약 `ConditionParams` ·
 * `ConditionTemplateKey`). 고르는 중인 조건을 그대로 실어 보내면 **저장 자체가 막히고**,
 * 작성자는 단계를 넘길 길을 잃는다 — 아직 채우지 않은 단계가 있는 것은 정상이다 (R8.3).
 *
 * 조건 없이 저장하는 것은 오류가 아니므로(`ConditionTemplateKey` — *"`null` 은 오류가
 * 아니다"*) 키를 비워 보낸다. **조용히 사라지지 않는다** — 무엇이 비었는지는
 * `endingsMissingCondition` 이 같은 판정으로 화면에서 이미 말하고 있다.
 */
export function writeOutline(
  payload: DraftPayload,
  values: OutlineValues,
  templates: readonly ConditionTemplateSpec[],
  sources: ConditionSources,
): Record<string, unknown> {
  // 계약의 이름 그대로다 (`DraftChapter` · `DraftEnding`, §13-70). `OutlineChapter` 를 바탕으로
  // 쓰는 것은 초안 응답과 원고가 **같은 이름을 쓰기 때문**이며, `conditionParams` 만 초안
  // 응답에 없는 자리다 — 초안은 키만 주고 슬롯은 작성자가 채운다.
  const chapters: (OutlineChapter & { conditionParams: ConditionParams })[] = values.chapters.map(
    (chapter, index) => ({
      chapterNo: index + 1,
      title: chapter.title,
      summarySeed: chapter.summarySeed,
      ...writableCondition(chapter, templates, sources),
    }),
  )
  // **`isDefault` 를 싣지 않는다** (#103) — 계약이 그것을 받지 않는다고 `DraftEnding` 에
  // 직접 적었다 (§13-16, I-10). `Omit` 인 것은 이 자리의 나머지 이름이 여전히 계약의 것이기
  // 때문이다: 빼는 것은 한 자리뿐이고, 그 사실이 형에 남는다.
  const endings: (Omit<OutlineEnding, 'isDefault'> & { conditionParams: ConditionParams })[] =
    values.endings.map((ending, index) => ({
      endingNo: index + 1,
      label: ending.label,
      epilogueText: ending.epilogueText === '' ? null : ending.epilogueText,
      ...writableCondition(ending, templates, sources),
    }))
  return {
    ...(payload ?? {}),
    [OUTLINE_FIELD.chapters]: chapters,
    [OUTLINE_FIELD.endings]: endings,
  }
}

/** 저장할 수 있는 조건이면 고른 그대로, 아니면 **고르지 않은 것과 같은 모양**으로 내보낸다. */
function writableCondition(
  value: Conditioned,
  templates: readonly ConditionTemplateSpec[],
  sources: ConditionSources,
): Conditioned {
  if (conditionIncomplete(value, templates, sources)) {
    return { conditionTemplateKey: null, conditionParams: {} }
  }
  return {
    conditionTemplateKey: value.conditionTemplateKey,
    conditionParams: { ...value.conditionParams },
  }
}

/**
 * AI 초안 응답을 편집 값으로 옮긴다.
 *
 * **응답이 준 순서를 그대로 쓴다.** `chapterNo` 로 다시 정렬하지 않는다 — 두 값이 어긋나는 것은
 * 서버의 문제이고, 화면이 조용히 고치면 그 어긋남은 아무 데도 드러나지 않는다.
 */
export function fromOutlineResponse(response: OutlineResponse): OutlineValues {
  return {
    // 초안 응답은 **키만** 준다 — 대상·임계는 접혀 있지 않으므로(§13-56) 빈 채로 온다.
    chapters: response.chapters.map((chapter) => ({
      title: chapter.title,
      summarySeed: chapter.summarySeed,
      conditionTemplateKey: chapter.conditionTemplateKey ?? null,
      conditionParams: {},
    })),
    // 초안 응답은 `isDefault` 를 **필수로 준다** (계약 `OutlineEnding.required`). 받는 것과
    // 쓰는 것은 다른 문제다 — 화면은 그 값을 옮겨 담지 않는다 (#103).
    endings: response.endings.map((ending) => ({
      label: ending.label,
      epilogueText: ending.epilogueText ?? '',
      conditionTemplateKey: ending.conditionTemplateKey ?? null,
      conditionParams: {},
    })),
  }
}

export const emptyChapter = (): ChapterDraft => ({
  title: '',
  summarySeed: '',
  conditionTemplateKey: null,
  conditionParams: {},
})

export const emptyEnding = (): EndingDraft => ({
  label: '',
  epilogueText: '',
  conditionTemplateKey: null,
  conditionParams: {},
})

/**
 * 줄거리 씨앗이 빈 챕터의 자리 (3e — `summarySeed` **필수**).
 *
 * **이 판정이 서버의 검증을 대신하지 않는다.** 계약이 `summarySeed` 를 필수로 받으므로 비면
 * 서버가 거부하고, 여기서 미리 막는 것은 그 거부를 눌러 보기 전에 알려 주는 안내다 —
 * `isBlocked` 와 같은 성질이다 (6a: *"화면 Disabled + 서버도 거부"*).
 */
export function chaptersMissingSeed(chapters: readonly ChapterDraft[]): number[] {
  return chapters.flatMap((chapter, index) => (chapter.summarySeed.trim() === '' ? [index] : []))
}

/**
 * 고른 템플릿의 선언 — 없으면 `null`.
 *
 * **키가 목록에 없을 수 있다.** 원고에 옛 키가 남아 있고 서버가 목록을 바꾼 경우이며, 그때
 * 화면은 라벨을 지어내지 않고 고르지 않은 것으로 다룬다 (F-4 와 같은 이유). 그렇게 읽힌 조건은
 * `writeOutline` 도 쓰지 않으므로 **서버가 모르는 키가 나가는 일이 없다** — 계약이 그것을
 * `400` 으로 받는다 (`ConditionTemplateKey` — *"목록에 없는 키는 `400` 이다"*).
 */
export function findTemplate(
  templates: readonly ConditionTemplateSpec[],
  key: string | null,
): ConditionTemplateSpec | null {
  if (key === null) return null
  return templates.find((template) => template.key === key) ?? null
}

/**
 * 이 템플릿을 지금 이 원고에서 고를 수 없는 이유 — 고를 수 있으면 `null`.
 *
 * **선택지가 없는 컨트롤을 그리지 않는다.** `character` 와 `flag` 의 후보는 서버가 주지 않고
 * 원고에서 온다 (§13-56). 후보가 하나도 없는 템플릿을 고르게 두면 작성자는 조건을 끝까지
 * 채울 수 없는 자리에 갇히고, 그 상태를 푸는 길이 화면에 없다 —
 * `visibilityBlockedReason`(3f) 과 같은 판단이다.
 *
 * **두 문구가 같은 모양인 것은 두 자리가 같은 자리이기 때문이다** (#125). 플래그의 이유는
 * 한동안 *"이 원고에는 아직 플래그를 선언하는 자리가 없습니다"* 였다 — 그때는 참이었지만
 * 계약이 `DraftPayload.flags` 를 세우고 (#362, §13-73) Step 3 이 그 자리를 열면서 **거짓말이
 * 되었다.** 화면이 계약의 상태를 스스로 설명해 둔 문장은 계약이 움직여도 아무도 갱신해
 * 주지 않는다. 지금 두 이유가 말하는 것은 하나다: **후보를 만드는 자리는 Step 3 이다.**
 */
export function templateBlockedReason(
  template: ConditionTemplateSpec,
  sources: ConditionSources,
): string | null {
  for (const parameter of template.parameters) {
    if (parameter.type === 'character' && sources.characters.length === 0) {
      return '3단계에서 인물을 먼저 만들면 고를 수 있습니다.'
    }
    if (parameter.type === 'flag' && sources.flags.length === 0) {
      return '3단계에서 플래그를 먼저 선언하면 고를 수 있습니다.'
    }
  }
  return null
}

/** `character` · `flag` 파라미터가 고를 수 있는 값. `integer` 는 목록이 아니다. */
export function parameterOptions(
  parameter: ConditionTemplateParameter,
  sources: ConditionSources,
): readonly string[] {
  if (parameter.type === 'character') return sources.characters
  if (parameter.type === 'flag') return sources.flags
  return []
}

/**
 * 조건이 아직 완성되지 않았는가 — **키만으로는 완성되지 않는다** (§13-56).
 *
 * 셋 중 하나라도 걸리면 참이다.
 * 1. 템플릿을 고르지 않았거나, 고른 키를 서버가 더는 선언하지 않는다 (`findTemplate`)
 * 2. 선언된 슬롯 하나가 비어 있다
 * 3. 채워진 값이 **지금 이 원고에서 뜻을 갖지 못한다** — 인물을 지웠거나 이름을 바꿔서
 *    `characters[].name` 밖을 가리키게 되었거나, 정수 자리에 정수가 아닌 것이 있다
 *
 * **3번을 화면이 조용히 고치지 않는다.** 남은 인물로 옮겨 붙이면 작성자가 고르지 않은 조건이
 * 그의 작품에 발행된다. 대신 *아직 고르지 않은 것*과 같은 자리에 둔다 — 화면은 "도달 조건이
 * 필요합니다" 를 다시 띄우고, 작성자가 남은 인물 중에서 다시 고른다.
 *
 * 서버도 같은 것을 본다: 계약 `ConditionParams` — *"원고에 없는 이름을 가리키면 `400` 이다
 * … 그런 조건은 평가기에서 조용히 거짓이 되고 그 챕터·엔딩은 영원히 도달되지 않는다."*
 */
export function conditionIncomplete(
  value: Conditioned,
  templates: readonly ConditionTemplateSpec[],
  sources: ConditionSources,
): boolean {
  const template = findTemplate(templates, value.conditionTemplateKey)
  if (template === null) return true
  return template.parameters.some(
    (parameter) => !parameterFilled(parameter, value.conditionParams[parameter.name], sources),
  )
}

function parameterFilled(
  parameter: ConditionTemplateParameter,
  param: string | number | undefined,
  sources: ConditionSources,
): boolean {
  if (param === undefined) return false
  // **문자열로 온 숫자를 서버가 받지 않는다** — 받으면 형이 둘이 된다 (계약 `ConditionParams`).
  if (parameter.type === 'integer') return Number.isInteger(param)
  return typeof param === 'string' && parameterOptions(parameter, sources).includes(param)
}

/**
 * 템플릿을 바꾼다 — **고른 값을 함께 버린다.**
 *
 * 슬롯 이름이 템플릿마다 다르므로 남겨 두면 다른 템플릿의 값이 새 템플릿에 붙는다. 그 값은
 * 화면 어디에도 보이지 않으면서 `payload` 에 남는다.
 */
export function setConditionTemplate<T extends Conditioned>(value: T, key: string | null): T {
  return { ...value, conditionTemplateKey: key, conditionParams: {} }
}

/** 슬롯 하나를 채운다. 빈 값이면 다시 비운다 — 고르지 않은 것과 같은 상태로 되돌린다. */
export function setConditionParam<T extends Conditioned>(
  value: T,
  name: string,
  param: string | number | null,
): T {
  const params: Record<string, string | number> = { ...value.conditionParams }
  if (param === null || param === '') {
    delete params[name]
  } else {
    params[name] = param
  }
  return { ...value, conditionParams: params }
}

/**
 * 조건이 비어 있는 엔딩의 자리 — **엔딩 전부를 센다** (#103).
 *
 * 예외였던 기본 엔딩이 없어졌다. 계약이 `DraftEnding` 에 *"기본 엔딩은 서버가 따로 하나를
 * 더해 만든다"* 라고 적었으므로 **작성자가 쓴 엔딩은 모두 조건을 갖는 편이 맞다** — 조건 없는
 * 엔딩을 하나 남겨 두면 서버의 폴백과 그 엔딩이 같은 자리를 두고 겹치고, 어느 쪽이 나올지는
 * 화면이 말할 수 없다.
 *
 * **다음 단계를 막지 않는다.** 3e 가 조건을 필수로 그리지 않았다 — 막아 두면 진행이 서고 그
 * 상태를 푸는 길이 화면에 없다. 그래서 말하기만 한다.
 *
 * **키가 있어도 슬롯이 비거나 그 값이 원고 밖을 가리키면 비어 있는 것으로 센다.** 그런 조건은
 * 저장될 때 키가 비워져 나가므로(`writeOutline`), 여기서 세지 않으면 작성자는 자기 조건이
 * 저장되지 않은 사실을 어디서도 알 수 없다 — 두 자리가 **같은 판정**(`conditionIncomplete`)을
 * 봐야 하는 이유다 (#98).
 */
export function endingsMissingCondition(
  endings: readonly EndingDraft[],
  templates: readonly ConditionTemplateSpec[],
  sources: ConditionSources,
): number[] {
  return endings.flatMap((ending, index) =>
    conditionIncomplete(ending, templates, sources) ? [index] : [],
  )
}

/**
 * 이 플래그 이름을 가리키는 조건 하나의 자리 (#125, 7차 `A-1` D-4 · D-5).
 *
 * **번호가 아니라 자리(`index`)를 준다** — 화면이 보여 주는 *엔딩 2* 는 `index + 1` 이고,
 * 그 계산은 `writeOutline` 이 번호를 매기는 규칙과 같다 (번호의 뜻은 순서다). 번호를 여기서
 * 미리 만들어 넘기면 같은 규칙이 두 곳에 생긴다.
 */
export interface FlagReference {
  readonly kind: 'chapter' | 'ending'
  readonly index: number
}

/**
 * 어느 챕터·엔딩의 조건이 이 플래그 이름을 가리키는가 (#125).
 *
 * ## 왜 이 판정이 필요한가
 *
 * **지금은 플래그를 지우면 그 조건이 저장 시점에 조용히 비워진다** — `writableCondition` 이
 * 원고 밖을 가리키는 조건을 *고르지 않은 것과 같은 모양*으로 내보내기 때문이다 (#98). 그것은
 * 옳다: 남은 이름으로 옮겨 붙이면 작성자가 고르지 않은 조건이 그의 작품에 발행되고, 그대로
 * 실어 보내면 서버가 `400` 으로 저장 자체를 막는다 (계약 `ConditionParams`).
 *
 * **말해 주지 않는 것이 문제다.** 화면은 Step 4 에서 "도달 조건이 필요합니다" 를 다시 띄울
 * 뿐 *왜* 비었는지 말하지 않고, 작성자는 자기가 무엇을 잃었는지 알지 못한다. 7차 아트보드는
 * 그것을 **지우기 직전에** 판으로 말하도록 그렸다 (D-5) — *"엔딩 3 의 조건이 이 이름을
 * 가리킵니다. 지우면 그 조건이 비워집니다."* 이 함수가 그 문장의 재료다.
 *
 * ## 무엇을 세는가
 *
 * **템플릿 명세가 `flag` 라고 선언한 슬롯만 본다.** 슬롯 이름을 문자열로 추측하지 않는다 —
 * 이름은 `ConditionTemplateParameter.name` 의 것이고 (§13-56), 서버가 슬롯을 하나 더하거나
 * 이름을 바꾸는 날 추측한 쪽만 조용히 빗나간다. 그래서 같은 이름이 `character` 슬롯에 들어
 * 있으면 **세지 않는다**: 그것은 인물을 가리키는 조건이고, 플래그를 지워도 멀쩡하다.
 *
 * **키가 목록에 없으면 세지 않는다.** 슬롯의 형을 알 길이 없고, 그런 조건은 이미 고르지 않은
 * 것으로 읽혀 저장에도 실리지 않는다 (`findTemplate` · `writableCondition`).
 *
 * **슬롯이 덜 찬 조건도 센다.** 이름을 가리키는 것과 조건이 완성된 것은 다른 문제이고,
 * 지우면 비워지는 것은 어느 쪽이나 같다.
 *
 * 챕터를 먼저, 그다음 엔딩을 각각 배열 순서로 돌려준다.
 */
export function flagReferences(
  values: OutlineValues,
  templates: readonly ConditionTemplateSpec[],
  flag: string,
): FlagReference[] {
  return [
    ...values.chapters.flatMap<FlagReference>((chapter, index) =>
      referencesFlag(chapter, templates, flag) ? [{ kind: 'chapter', index }] : [],
    ),
    ...values.endings.flatMap<FlagReference>((ending, index) =>
      referencesFlag(ending, templates, flag) ? [{ kind: 'ending', index }] : [],
    ),
  ]
}

function referencesFlag(
  value: Conditioned,
  templates: readonly ConditionTemplateSpec[],
  flag: string,
): boolean {
  const template = findTemplate(templates, value.conditionTemplateKey)
  if (template === null) return false
  return template.parameters.some(
    (parameter) => parameter.type === 'flag' && value.conditionParams[parameter.name] === flag,
  )
}

/**
 * 이 플래그를 가리키던 조건을 **비운 새 개요**를 돌려준다 (#125, D-5 의 *[지우고 조건 비우기]*).
 *
 * **`setConditionTemplate(value, null)` 을 쓴다** — 그것이 키와 슬롯 값을 함께 버린다. 키만
 * 지우고 값을 남기면 화면 어디에도 보이지 않는 값이 `payload` 에 남고, 작성자가 다음에 고른
 * 템플릿에 그 값이 붙는다.
 *
 * **남은 플래그로 옮겨 붙이지 않는다.** #98 이 인물에 대해 세운 규칙과 같다 — 화면이 조용히
 * 고르면 작성자가 고르지 않은 조건이 그의 작품에 발행된다. 비워 두면 Step 4 가 "도달 조건이
 * 필요합니다" 로 다시 묻고, 고르는 것은 작성자다.
 *
 * **가리키지 않던 조건은 그대로 둔다** — 같은 템플릿을 쓰더라도 다른 이름을 가리키면 남는다.
 */
export function clearFlagConditions(
  values: OutlineValues,
  templates: readonly ConditionTemplateSpec[],
  flag: string,
): OutlineValues {
  return {
    chapters: values.chapters.map((chapter) =>
      referencesFlag(chapter, templates, flag) ? setConditionTemplate(chapter, null) : chapter,
    ),
    endings: values.endings.map((ending) =>
      referencesFlag(ending, templates, flag) ? setConditionTemplate(ending, null) : ending,
    ),
  }
}
