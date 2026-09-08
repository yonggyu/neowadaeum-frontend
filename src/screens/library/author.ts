import type { AuthorType } from '../../api/endpoints/library'

/**
 * 계약이 카드(`StoryCard`)와 상세(`StoryDetail`) 양쪽에 **같은 모양으로** 주는 작성자 두 필드.
 *
 * 두 응답의 나머지는 다르지만 작성자 규칙은 하나여서 여기로 모은다 — 규칙이 두 벌이 되면
 * 그중 하나가 먼저 `null` 을 잊는다.
 */
export interface Authorship {
  authorType: AuthorType
  authorDisplayName: string | null
}

/**
 * 상세가 작성자 줄에 함께 적는 종류 (4d).
 *
 * **이름의 자리 채우기가 아니다.** 카드에서는 걷어냈다 — 커뮤니티 섹션 제목이 이미 그 사실을
 * 말한다. 상세에는 그런 맥락이 없어서 4d 가 `@yeonwoo · 사용자 작품` 을 그린다. `authorType`
 * 은 계약이 주는 사실이므로 이것을 적는 것은 지어내는 것이 아니다.
 */
const USER_AUTHORED = '사용자 작품'

/**
 * 작성자 표기. 값이 없으면 `null` 이고, 그때 화면은 **아무것도 그리지 않는다.**
 *
 * 계약이 보장하는 것은 두 가지다 — `authorDisplayName` 은 키가 **항상 있고**, `authorType` 이
 * `official` 이거나 **작성자 프로필이 없으면** `null` 이다. 그래서 `authorType === 'user'` 라는
 * 사실만으로 이름이 있다고 추측하지 않는다. UGC 인데 이름이 없는 경우가 계약 안에 있다.
 *
 * 작성자를 밝히는 값은 이것 하나뿐이다 — `player_ref` 는 화면·URL·로그 어디에도 쓰지 않는다 (F-6).
 * `@` 는 와이어프레임 3g · 4d 의 표기다 (`@yeonwoo · 판타지`).
 */
export function authorHandle(story: Authorship): string | null {
  if (story.authorType !== 'user') return null
  const name = story.authorDisplayName?.trim() ?? ''
  return name === '' ? null : `@${name}`
}

/**
 * 카드 한 줄 메타 — `@yeonwoo · 판타지` (3g · 4d).
 *
 * 공식 작품은 장르만이다. 작성자가 없다는 것이 계약의 사실이고(`authorType: official` 이면
 * `authorDisplayName` 은 `null`), 그 자리를 무엇으로도 채우지 않는다.
 */
export function storyCardMeta(story: Authorship & { genres: readonly string[] }): string {
  const handle = authorHandle(story)
  return [...(handle === null ? [] : [handle]), ...story.genres].join(' · ')
}

/**
 * 상세의 작성자 줄 — `@yeonwoo · 사용자 작품` (4d). 공식 작품은 빈 문자열이고 화면이 숨긴다.
 *
 * 이름이 없는 UGC 는 종류만 남는다. 그것이 계약이 답할 수 있는 전부다.
 */
export function storyByline(story: Authorship): string {
  if (story.authorType !== 'user') return ''
  const handle = authorHandle(story)
  return [...(handle === null ? [] : [handle]), USER_AUTHORED].join(' · ')
}
