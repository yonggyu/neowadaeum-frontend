import type { DraftPayload } from '../../api/endpoints/authoring'

/**
 * Step 1~3 이 `payload` 안에서 읽고 쓰는 자리 (와이어프레임 3d).
 *
 * 계약은 `payload` 를 `additionalProperties: true` 로 열어 두었다 — **필드 이름을 계약이 정해
 * 주지 않는다.** 그래서 지어내는 대신 이미 계약 안에 있는 이름을 그대로 쓴다: 발행된 작품이
 * 같은 값을 `title` · `genres` · `shortDescription` · `worldIntro`(`StoryDetail`) ·
 * `name` · `oneLine` · `portraitImage`(`CharacterCard`) 로 부른다. 원고의 이름과 발행물의
 * 이름이 다르면 게시 시점에 한 번 옮겨 적어야 하고, 그 옮김은 반드시 어느 날 하나를 빠뜨린다.
 *
 * 이름을 고를 자유가 없는 자리가 하나 있다 — **캐릭터의 필드 경로**다. precheck 요청의
 * 예시가 `characters[0].name` 이므로 배열 표기는 그 형식이다.
 *
 * 인물의 `persona` 는 고를 자유가 없는 또 하나의 자리다 — 계약 `DraftCharacter` 가 직접
 * 적어 둔 이름이고, 검수 원고(`ReviewManuscript.characters[].persona`)가 같은 이름으로 받는다.
 *
 * `flags` 도 그런 자리다 — 계약 `DraftPayload.flags` 가 세운 이름이며 (#362, 정정본 §13-73),
 * 조건의 `flag` 파라미터가 가리키는 목록의 **정본**이다 (계약 `ConditionParams`). 여기 적히지
 * 않은 이름을 가리키는 조건은 `400` 이고, 받아 두었다면 평가기에서 조용히 거짓이 되어 그
 * 챕터·엔딩은 영원히 도달되지 않는다.
 *
 * `settingDetail`(AI 에게만 전달되는 설정 상세)만 발행물에 짝이 없다. 독자에게 보이지 않는
 * 값이라 `StoryDetail` 에 나올 이유가 없기 때문이고, 이름은 3d 의 라벨에서 왔다.
 */

/** 검사·저장의 필드 경로. 문자열을 화면이 직접 적지 않는다 — 두 곳이 어긋나면 검수가 조용히 빗나간다. */
export const FIELD = {
  title: 'title',
  genres: 'genres',
  shortDescription: 'shortDescription',
  coverImage: 'coverImage',
  worldIntro: 'worldIntro',
  settingDetail: 'settingDetail',
  characters: 'characters',
  flags: 'flags',
} as const

/** 인물 카드가 쓰는 세 칸. 이름은 계약 `DraftCharacter` 의 것이며 여기서 짓지 않는다. */
export type CharacterKey = 'name' | 'oneLine' | 'persona'

/** 검수·초기화가 한 인물에서 훑는 순서. 두 곳이 다른 목록을 들면 한쪽이 조용히 빠진다. */
const CHARACTER_KEYS: readonly CharacterKey[] = ['name', 'oneLine', 'persona']

/** `characters[0].name` (계약 `PrecheckRequest.fields` 의 예시 형식). */
export function characterField(index: number, key: CharacterKey): string {
  return `${FIELD.characters}[${index}].${key}`
}

/**
 * 등장인물 `count` 명이 차지하는 필드 경로 전부. 자리가 바뀔 때 옛 결과를 버리는 데 쓴다.
 *
 * **`persona` 도 센다.** 검수에 보내는 값이면 버릴 때도 같이 버려야 한다 — 한쪽만 세면
 * 지운 인물의 밑줄이 페르소나 자리에만 남고, 그것은 영영 사라지지 않는다.
 */
export function characterFieldPaths(count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) =>
    CHARACTER_KEYS.map((key) => characterField(index, key)),
  ).flat()
}

/**
 * `flags[0]` — `characterField` 와 **같은 이유**의 표기다: 계약 `PrecheckRequest.fields` 의
 * 예시가 `characters[0].name` 이고, 그 형식이 곧 DOM id 여서 라벨과 입력이 서로를 가리킨다.
 *
 * **검수(precheck)에 이 경로를 보내지 않는다.** 계약이 플래그를 검수 대상으로 요구하지
 * 않았고 (#125 의 물음 2), 7차 아트보드도 그 자리를 그리지 않았다 — 없는 화면을 지어내지
 * 않는다. 여기 있는 것은 **한 줄을 식별하는 이름**뿐이다.
 */
export function flagField(index: number): string {
  return `${FIELD.flags}[${index}]`
}


/**
 * 글자 수 상한 — **3d 가 값으로 적은 셋만** 둔다.
 *
 * 제목에는 상한이 없다. 3d 가 제목의 카운터를 그리지 않았고, 계약도 원고의 제목 길이를
 * 말하지 않는다 — 여기서 정하면 그 숫자가 곧 규칙이 된다.
 */
export const SHORT_DESCRIPTION_MAX = 40
export const WORLD_INTRO_MAX = 300
export const SETTING_DETAIL_MAX = 1500

/**
 * 플래그의 상한 — **계약의 값이다.** `DraftPayload.flags` 의 `maxItems: 32` 와 항목의
 * `maxLength: 40` 이고, 화면이 정한 숫자가 아니다 (#362, 정정본 §13-73).
 *
 * **7차 아트보드는 `3 / 12` 로 그렸다.** 그 그림은 #362 **이전**의 것이라 계약에 숫자가 없던
 * 때이며, `CLAUDE.md` 의 순서대로 **계약이 화면을 이긴다** — 그래서 12 가 아니라 32 다.
 * 계약보다 좁은 선을 화면이 따로 그으면 그것은 *왜 좁혔는지가 보이지 않는 규칙*이 되고,
 * 작성자에게는 고장으로 읽힌다. 아트보드를 역반영하는 것은 디자인 쪽 일이다.
 *
 * **이 둘이 진짜 게이트가 아니다** (정정본 §13-76). 계약이 남겨 둔 *거친 바깥 울타리*이고,
 * 실제로 저장을 막는 것은 이 원고의 어휘가 프롬프트 예산에 들어가는가이며 그 판정은 인물
 * 이름까지 **함께** 본다. 그래서 화면은 이 숫자로 남은 자리를 보여 줄 뿐, 통과를 약속하지
 * 않는다 — 넘으면 서버가 `400` 과 함께 얼마나 줄여야 하는지를 말한다 (F-4).
 */
export const FLAG_MAX_COUNT = 32
export const FLAG_NAME_MAX = 40

/**
 * 상한이 가까워졌다고 말할 지점 (3d — *"상한에 거의 도달했습니다"*).
 *
 * 3d 는 1,480 / 1,500 에서 그 문장을 그렸다. 값 하나를 그대로 옮기면 300자 필드에는 쓸 수
 * 없으므로 **비율로** 옮긴다. 화면 표현의 문제이지 계약의 값이 아니다.
 */
export function isNearLimit(length: number, max: number): boolean {
  return length >= max * 0.9
}

/**
 * 장르는 **여기 없다.** 목록을 `getAuthoringMetadata` 가 준다 (backend #282 · #315, §13-56).
 *
 * 이 자리에는 다섯 개의 상수가 있었다 — 계약에 목록을 주는 경로가 없어서였다. 그 경로가
 * 열렸으므로 상수를 지운다: **정본은 `catalog` 의 `genre` 표**이고, 코드에 다섯을 적으면
 * 라이브러리가 보여 주는 목록과 작성자가 고를 수 있는 목록이 서로 다른 정본을 갖게 된다.
 * 갈라지는 날 *작성자가 고른 장르로는 열리지 않는 섹션*이 생긴다.
 *
 * 라벨도 서버의 것이다. 서버로 나가는 값은 언제나 `AuthoringGenre.key` 다.
 */

/**
 * Step 3 의 등장인물 하나. `portraitImage` 는 **확정을 통과한 객체 키**이며 (#88 · §13-65),
 * 아직 올리지 않았으면 `null` 이다 — URL 이 아니다 (I-8).
 *
 * **`persona` 와 `oneLine` 은 서로 다른 독자를 갖는다** (계약 `DraftCharacter`, 백엔드 #350).
 * `oneLine` 은 발행되면 `CharacterCard.oneLine` 으로 **독자에게 보이고**, `persona` 는 매 턴
 * 모델에게 들어가며 검수자가 보는 것도 이쪽이다 (`ReviewManuscript.characters[].persona`).
 *
 * **`persona` 가 비어 있는 것은 오류가 아니다.** 비면 서버가 `oneLine` 을 대신 발행한다
 * (#350) — 서버가 문장을 지어내지는 않는다. 그래서 여기에 필수 검사를 두지 않는다: 두면
 * 계약이 이미 정해 둔 폴백을 화면이 막는 셈이 된다.
 */
export interface CharacterDraft {
  readonly name: string
  readonly oneLine: string
  readonly persona: string
  readonly portraitImage: string | null
}

/**
 * 화면이 실제로 쓰는 모양. **서버 응답의 `payload` 를 컴포넌트로 그대로 흘리지 않는다** (설계 원칙).
 */
export interface StepValues {
  readonly title: string
  readonly genres: readonly string[]
  readonly shortDescription: string
  readonly coverImage: string | null
  readonly worldIntro: string
  readonly settingDetail: string
  readonly characters: readonly CharacterDraft[]
  /**
   * 이 원고가 선언한 플래그 이름 (계약 `DraftPayload.flags`).
   *
   * **문자열의 배열이다** (S-1). 인물이 객체 배열이므로 여기도 같은 모양으로 만드는 것이
   * 이 자리의 가장 있을 법한 실수이고, 정정본 §13-73 이 그것을 직접 경고했다 — 객체로
   * 보내면 서버는 이름을 찾지 못해 **조용히 빈 목록**이 되고, 그러면 작성자가 고른
   * `has_flag` 는 *없는 이름을 가리킨다* 는 이유로 거절된다.
   */
  readonly flags: readonly string[]
}

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

const nullableText = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null

/**
 * `payload` 원문을 화면의 값으로 좁힌다.
 *
 * 어느 자리가 비었거나 다른 타입이어도 **빈 값으로 읽는다.** 원고는 Step 1 의 첫 글자를 치기
 * 전에 이미 만들어져 있고(`createDraft` 는 본문이 없다), 그 상태가 예외가 아니라 기본값이다.
 */
export function readValues(payload: DraftPayload): StepValues {
  const raw: Record<string, unknown> = payload ?? {}
  const genres = raw[FIELD.genres]
  const characters = raw[FIELD.characters]
  const flags = raw[FIELD.flags]
  return {
    title: text(raw[FIELD.title]),
    genres: Array.isArray(genres) ? genres.filter((g): g is string => typeof g === 'string') : [],
    shortDescription: text(raw[FIELD.shortDescription]),
    coverImage: nullableText(raw[FIELD.coverImage]),
    worldIntro: text(raw[FIELD.worldIntro]),
    settingDetail: text(raw[FIELD.settingDetail]),
    characters: Array.isArray(characters) ? characters.map(readCharacter) : [],
    // 문자열만 남긴다 — 계약이 그 형을 정했고 (S-1), 다른 형이 섞여 있으면 그것은 조건이
    // 가리킬 수 없는 이름이다. `genres` 와 같은 자리다.
    flags: Array.isArray(flags) ? flags.filter((flag): flag is string => typeof flag === 'string') : [],
  }
}

function readCharacter(raw: unknown): CharacterDraft {
  const value: Record<string, unknown> = typeof raw === 'object' && raw !== null ? { ...raw } : {}
  return {
    name: text(value['name']),
    oneLine: text(value['oneLine']),
    persona: text(value['persona']),
    portraitImage: nullableText(value['portraitImage']),
  }
}

/**
 * 화면의 값을 다시 `payload` 로 되돌린다 — **모르는 키를 지우지 않는다.**
 *
 * Step 4·5(챕터 · 엔딩)의 입력은 아직 붙지 않았지만 그 자리는 같은 `payload` 안에 있다.
 * `PATCH` 는 payload 를 통째로 받으므로, 여기서 아는 키만 남기면 **다음 이슈가 붙일 값을
 * 이 화면이 매번 지우게 된다.**
 */
export function writeValues(payload: DraftPayload, values: StepValues): Record<string, unknown> {
  return {
    ...(payload ?? {}),
    [FIELD.title]: values.title,
    [FIELD.genres]: [...values.genres],
    [FIELD.shortDescription]: values.shortDescription,
    [FIELD.coverImage]: values.coverImage,
    [FIELD.worldIntro]: values.worldIntro,
    [FIELD.settingDetail]: values.settingDetail,
    [FIELD.characters]: values.characters.map((c) => ({ ...c })),
    // **문자열 그대로 내보낸다** (S-1) — 인물처럼 `{ name }` 으로 감싸지 않는다.
    //
    // **`trim()` 도 하지 않고 빈 항목도 버리지 않는다** (S-6). "추가" 가 빈 줄을 먼저
    // 만드는 화면이므로 빈 줄을 막으면 줄을 하나 더한 순간 저장이 멈춘다 — 서버가 빈 항목을
    // 건너뛴다 (§13-73 #4, 인물과 같다 §13-71). 앞뒤 공백을 화면이 몰래 떼면 작성자가 친
    // 이름과 서버가 검증하는 이름이 갈라지고, 그 차이는 조건이 거절될 때까지 보이지 않는다.
    [FIELD.flags]: [...values.flags],
  }
}

/** 장르 칩 하나를 켜고 끈다. 다중 선택이며 순서는 고른 순서다 (3d). */
export function toggleGenre(genres: readonly string[], value: string): string[] {
  return genres.includes(value) ? genres.filter((g) => g !== value) : [...genres, value]
}

/** 빈 등장인물. **개수 상한을 두지 않는다** — 계약이 값을 주지 않는다. */
export const emptyCharacter = (): CharacterDraft => ({
  name: '',
  oneLine: '',
  persona: '',
  portraitImage: null,
})

/**
 * 순서를 한 칸 옮긴다 (3d — *"⠿ 순서 · 삭제"*).
 *
 * 드래그가 아니라 버튼이다. 드래그만 두면 키보드와 스크린리더에서 순서를 바꿀 방법이 없고,
 * 그 대체 수단이 결국 이 버튼이다 — 하나만 만든다.
 *
 * 범위를 벗어나면 **원본을 그대로 돌려준다.** 첫 항목의 "위로" 가 배열을 뒤집는 일이 없다.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length || from < 0 || from >= items.length) {
    return [...items]
  }
  const next = [...items]
  const moved = next.splice(from, 1)[0]
  if (moved === undefined) return [...items]
  next.splice(to, 0, moved)
  return next
}

/** 등장인물의 순서 (3d). 챕터·엔딩(3e)도 같은 버튼을 쓰므로 옮기는 일 자체는 `moveItem` 이다. */
export function moveCharacter(
  characters: readonly CharacterDraft[],
  from: number,
  to: number,
): CharacterDraft[] {
  return moveItem(characters, from, to)
}

/**
 * 플래그 한 줄을 더한다 (7차 `A-1` — *"[＋ 플래그 추가]"*).
 *
 * **빈 줄로 시작한다.** 그것이 이 화면의 전제이고, 그래서 계약이 빈 항목을 건너뛰기로 했다
 * (S-6, §13-73 #4). 빈 줄을 막으면 줄을 더한 순간 저장이 멈춘다.
 *
 * **`FLAG_MAX_COUNT` 를 여기서 조용히 자르지 않는다.** 자르면 "추가" 를 눌러도 아무 일이
 * 일어나지 않고 이유가 어디에도 보이지 않는다 — 상한에 닿았다는 사실은 화면이 버튼을
 * 잠그며 말한다 (`SHORT_DESCRIPTION_MAX` 를 카운터가 말하는 것과 같은 자리다).
 */
export function addFlag(flags: readonly string[]): string[] {
  return [...flags, '']
}

/**
 * 한 줄을 고친다. **값을 다듬지 않는다** — 판정은 서버가 하고 문장도 서버가 준다 (F-4).
 *
 * 문자 집합도 좁히지 않는다 (S-7, §13-73 #3): 좁히면 한글에 문장부호가 섞인 정상적인 이름이
 * 거절되는데 그 대가로 얻는 안전이 없다.
 */
export function setFlag(flags: readonly string[], index: number, name: string): string[] {
  return flags.map((flag, i) => (i === index ? name : flag))
}

/**
 * 한 줄을 지운다.
 *
 * **여기서 조건까지 손대지 않는다.** 지워진 이름을 가리키던 챕터·엔딩의 조건을 비우는 것은
 * `clearFlagConditions`(`outline.ts`) 의 몫이며, 그 둘은 **서로 다른 값**(Step 3 의 값과
 * Step 4 의 값)을 고친다 — 여기서 함께 하면 이 함수가 개요 전체를 알아야 한다.
 */
export function removeFlag(flags: readonly string[], index: number): string[] {
  return flags.filter((_, i) => i !== index)
}
