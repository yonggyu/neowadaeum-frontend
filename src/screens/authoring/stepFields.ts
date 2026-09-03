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
} as const

/** `characters[0].name` (계약 `PrecheckRequest.fields` 의 예시 형식). */
export function characterField(index: number, key: 'name' | 'oneLine'): string {
  return `${FIELD.characters}[${index}].${key}`
}

/** 등장인물 `count` 명이 차지하는 필드 경로 전부. 자리가 바뀔 때 옛 결과를 버리는 데 쓴다. */
export function characterFieldPaths(count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => [
    characterField(index, 'name'),
    characterField(index, 'oneLine'),
  ]).flat()
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
 * 상한이 가까워졌다고 말할 지점 (3d — *"상한에 거의 도달했습니다"*).
 *
 * 3d 는 1,480 / 1,500 에서 그 문장을 그렸다. 값 하나를 그대로 옮기면 300자 필드에는 쓸 수
 * 없으므로 **비율로** 옮긴다. 화면 표현의 문제이지 계약의 값이 아니다.
 */
export function isNearLimit(length: number, max: number): boolean {
  return length >= max * 0.9
}

/**
 * 장르 다섯 (정정본 13-25 — *"`romance` · `school` · `fantasy` · `action` · `mystery` 다섯"*).
 *
 * **계약에 장르 목록을 주는 경로가 없다.** 라이브러리의 섹션 키가 `genre:<key>` 이므로 값은
 * 그 키여야 하고, 그 다섯을 정한 것은 정정본이다. 3d 의 칩(로맨스 · 청춘 · 판타지 · 미스터리 ·
 * 일상)과 두 개가 다르다 — 와이어프레임이 아니라 **정정본을 따른다**: 여기서 3d 를 따르면
 * 작성자가 고른 장르로는 열리지 않는 섹션이 생긴다. 어긋남은 이슈 후보로 보고한다.
 *
 * 라벨은 화면의 것이다. 서버로 나가는 값은 언제나 키다.
 */
export const GENRES: readonly { value: string; label: string }[] = [
  { value: 'romance', label: '로맨스' },
  { value: 'school', label: '학원' },
  { value: 'fantasy', label: '판타지' },
  { value: 'action', label: '액션' },
  { value: 'mystery', label: '미스터리' },
]

/** Step 3 의 등장인물 하나. 초상은 계약에 올릴 길이 없어 언제나 `null` 이다 (아래 주석). */
export interface CharacterDraft {
  readonly name: string
  readonly oneLine: string
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
  return {
    title: text(raw[FIELD.title]),
    genres: Array.isArray(genres) ? genres.filter((g): g is string => typeof g === 'string') : [],
    shortDescription: text(raw[FIELD.shortDescription]),
    coverImage: nullableText(raw[FIELD.coverImage]),
    worldIntro: text(raw[FIELD.worldIntro]),
    settingDetail: text(raw[FIELD.settingDetail]),
    characters: Array.isArray(characters) ? characters.map(readCharacter) : [],
  }
}

function readCharacter(raw: unknown): CharacterDraft {
  const value: Record<string, unknown> = typeof raw === 'object' && raw !== null ? { ...raw } : {}
  return {
    name: text(value['name']),
    oneLine: text(value['oneLine']),
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
  }
}

/** 장르 칩 하나를 켜고 끈다. 다중 선택이며 순서는 고른 순서다 (3d). */
export function toggleGenre(genres: readonly string[], value: string): string[] {
  return genres.includes(value) ? genres.filter((g) => g !== value) : [...genres, value]
}

/** 빈 등장인물. **개수 상한을 두지 않는다** — 계약이 값을 주지 않는다. */
export const emptyCharacter = (): CharacterDraft => ({ name: '', oneLine: '', portraitImage: null })

/**
 * 순서를 한 칸 옮긴다 (3d — *"⠿ 순서 · 삭제"*).
 *
 * 드래그가 아니라 버튼이다. 드래그만 두면 키보드와 스크린리더에서 순서를 바꿀 방법이 없고,
 * 그 대체 수단이 결국 이 버튼이다 — 하나만 만든다.
 *
 * 범위를 벗어나면 **원본을 그대로 돌려준다.** 첫 항목의 "위로" 가 배열을 뒤집는 일이 없다.
 */
export function moveCharacter(
  characters: readonly CharacterDraft[],
  from: number,
  to: number,
): CharacterDraft[] {
  if (to < 0 || to >= characters.length || from < 0 || from >= characters.length) {
    return [...characters]
  }
  const next = [...characters]
  const moved = next.splice(from, 1)[0]
  if (moved === undefined) return [...characters]
  next.splice(to, 0, moved)
  return next
}
