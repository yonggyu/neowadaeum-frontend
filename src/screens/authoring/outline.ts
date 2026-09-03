import type {
  DraftPayload,
  OutlineChapter,
  OutlineEnding,
  OutlineResponse,
} from '../../api/endpoints/authoring'

/**
 * Step 4 — 챕터 & 엔딩이 `payload` 안에서 읽고 쓰는 자리 (와이어프레임 3e).
 *
 * `stepFields.ts` 의 Step 1~3 과 같은 방식이다: 계약이 `payload` 를 `additionalProperties: true`
 * 로 열어 두어 필드 이름을 정해 주지 않으므로, **이미 계약 안에 있는 이름을 그대로 쓴다** —
 * `OutlineChapter` · `OutlineEnding` 의 속성 이름이 그것이다. 원고의 이름과 초안 응답의 이름이
 * 다르면 초안을 받을 때마다 옮겨 적어야 하고, 그 옮김은 어느 날 하나를 빠뜨린다.
 *
 * 이것을 부르는 화면(Step 4 의 챕터·엔딩 편집)은 **뒤따르는 PR** 에 온다 — 한 PR 에 넣으면
 * `src/**` 800줄을 넘는다. `draft.ts` 가 마법사 골격과 갈라진 것과 같은 자리다.
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
 * 화면이 실제로 쓰는 모양. **`chapterNo` · `endingNo` 를 들고 있지 않는다.**
 *
 * 번호는 순서다 — 배열의 자리가 곧 그 값이므로 둘을 함께 들면 순서 변경·삭제마다 두 곳을
 * 맞춰야 하고, 어긋나는 날 서버는 번호를 믿고 화면은 순서를 믿는다. 번호는 저장할 때
 * `writeOutline` 이 한 곳에서 매긴다.
 */
export interface ChapterDraft {
  readonly title: string
  readonly summarySeed: string
  /** 전환 조건. **템플릿 키 문자열 하나뿐이다** (R7.16) — 대상·임계값을 고르는 자리가 없다 */
  readonly conditionTemplateKey: string | null
}

export interface EndingDraft {
  readonly label: string
  readonly epilogueText: string
  /** 엔딩 하나에만 켜진다 (3e — 라디오). 그 불변을 지키는 것은 `setDefaultEnding` 이다 */
  readonly isDefault: boolean
  readonly conditionTemplateKey: string | null
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
  }
}

function readEnding(raw: unknown): EndingDraft {
  const value: Record<string, unknown> = typeof raw === 'object' && raw !== null ? { ...raw } : {}
  return {
    label: text(value['label']),
    epilogueText: text(value['epilogueText']),
    isDefault: value['isDefault'] === true,
    conditionTemplateKey: nullableText(value['conditionTemplateKey']),
  }
}

/**
 * 화면의 값을 다시 `payload` 로 되돌린다 — **모르는 키를 지우지 않는다** (`writeValues` 와 같다).
 *
 * 번호를 여기서 매긴다. 계약이 `chapterNo` · `endingNo` 를 필수로 받고 그 값의 뜻은 순서이므로,
 * 배열의 자리에서 한 번만 만든다.
 */
export function writeOutline(
  payload: DraftPayload,
  values: OutlineValues,
): Record<string, unknown> {
  const chapters: OutlineChapter[] = values.chapters.map((chapter, index) => ({
    chapterNo: index + 1,
    title: chapter.title,
    summarySeed: chapter.summarySeed,
    conditionTemplateKey: chapter.conditionTemplateKey,
  }))
  const endings: OutlineEnding[] = values.endings.map((ending, index) => ({
    endingNo: index + 1,
    label: ending.label,
    epilogueText: ending.epilogueText === '' ? null : ending.epilogueText,
    isDefault: ending.isDefault,
    conditionTemplateKey: ending.conditionTemplateKey,
  }))
  return {
    ...(payload ?? {}),
    [OUTLINE_FIELD.chapters]: chapters,
    [OUTLINE_FIELD.endings]: endings,
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
    chapters: response.chapters.map((chapter) => ({
      title: chapter.title,
      summarySeed: chapter.summarySeed,
      conditionTemplateKey: chapter.conditionTemplateKey ?? null,
    })),
    endings: response.endings.map((ending) => ({
      label: ending.label,
      epilogueText: ending.epilogueText ?? '',
      isDefault: ending.isDefault,
      conditionTemplateKey: ending.conditionTemplateKey ?? null,
    })),
  }
}

export const emptyChapter = (): ChapterDraft => ({
  title: '',
  summarySeed: '',
  conditionTemplateKey: null,
})

export const emptyEnding = (): EndingDraft => ({
  label: '',
  epilogueText: '',
  isDefault: false,
  conditionTemplateKey: null,
})

/**
 * 기본 엔딩을 하나로 정한다 (3e — *"`isDefault` 는 엔딩 하나에만 켜진다(라디오)"*).
 *
 * **불변이 이 함수 하나에 있다.** 카드마다 자기 값을 뒤집게 두면 두 엔딩이 동시에 기본이 되는
 * 상태가 만들어지고, 그것을 막는 조건이 곧 두 번째 규칙이 된다.
 *
 * 함께 조건을 비운다 — 계약이 `isDefault` 의 설명에 그 규칙을 적어 두었다: *"기본 엔딩은
 * 조건을 갖지 않고, 일반 엔딩은 조건을 반드시 갖는다"* (R2.11, 정정본 §13-16). 조건을 단 채로
 * 기본이 되면 그 조건은 아무 데서도 읽히지 않으면서 화면에는 남는다.
 */
export function setDefaultEnding(endings: readonly EndingDraft[], index: number): EndingDraft[] {
  return endings.map((ending, i) =>
    i === index
      ? { ...ending, isDefault: true, conditionTemplateKey: null }
      : { ...ending, isDefault: false },
  )
}

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
 * 일반 엔딩(기본이 아닌 것) 중 조건이 비어 있는 자리 (R2.11).
 *
 * **다음 단계를 막지 않는다.** 3e 가 조건을 필수로 그리지 않았고, 조건 템플릿의 표시 문구조차
 * 아직 정해지지 않았다 (계약 `conditionTemplates` 의 설명, 백엔드 #282). 막아 두면 고를 수
 * 없는 값 때문에 진행이 서고, 그 상태를 푸는 길이 화면에 없다 — 그래서 말하기만 한다.
 */
export function endingsMissingCondition(endings: readonly EndingDraft[]): number[] {
  return endings.flatMap((ending, index) =>
    !ending.isDefault && ending.conditionTemplateKey === null ? [index] : [],
  )
}
