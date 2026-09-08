import type { AdminSessionListItem } from '../../api/endpoints/admin'

/**
 * 세션 목록(7차 와이어프레임 `A-3`)이 판단하는 것 — 무엇을 무엇이라 부르는가, 무엇을 접는가.
 *
 * React 밖에 두는 이유는 `reviewQueue.ts` · `debugConsole.ts` 와 같다. 이 화면의 규칙 대부분이
 * **"없는 것을 지어내지 않는다"** 이고, 그 규칙은 렌더링 없이 확인할 수 있어야 한다 — 러너에
 * DOM 이 없어서가 아니라, 지어낸 이름 하나가 화면에서는 정상으로 보이기 때문이다.
 */

export type SessionStatus = AdminSessionListItem['status']

/** 계약 `AdminSessionListItem.status` 의 넷. 문구는 아트보드 `A-3` 그대로다. */
export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  active: '진행 중',
  completed: '끝남',
  abandoned: '버려짐',
  expired: '만료됨',
}

/**
 * 제목이 없을 때 적는 말. **식별자를 대신 넣지 않는다.**
 *
 * 계약이 `storyTitle: null` 을 허용하는 경우는 하나다 — 작품이 지워지고 세션만 남은 것
 * (백엔드 §13-58). 그 자리에 `storyId` 를 넣으면 목록은 이름이 있는 것처럼 보이고, 그때
 * 관리자는 그 문자열을 작품 이름으로 읽는다.
 */
export const MISSING_TITLE = '(제목 없음)'

export function sessionTitleLabel(storyTitle: string | null): string {
  return storyTitle ?? MISSING_TITLE
}

// ── 표시 ───────────────────────────────────────────────────────────────

/**
 * 실제 플레이가 아닌 것들. 계약이 둘 다 필수로 실었다 (`testSession` · `deletedAt`).
 *
 * **섞어 그리지 않는다** — 미리보기 세션을 사용자 행동으로 읽게 되면 그 뒤의 판단이 전부
 * 어긋난다 (백엔드 I-18, §13-67). 지워진 세션도 같은 이유로 그 사실을 달고 온다.
 */
export type SessionBadge = 'test' | 'deleted'

export const SESSION_BADGE_LABEL: Record<SessionBadge, string> = {
  test: '테스트',
  deleted: '지워짐',
}

/** 붙을 것이 없으면 빈 배열이다 — 아트보드가 *"있을 때만 줄을 차지한다"* 고 적었다. */
export function sessionBadges(item: AdminSessionListItem): readonly SessionBadge[] {
  const badges: SessionBadge[] = []
  if (item.testSession) {
    badges.push('test')
  }
  if (item.deletedAt !== null) {
    badges.push('deleted')
  }
  return badges
}

/** 데스크톱 표의 "턴 / 챕터" 칸. 헤더가 이미 무엇인지 말한다. */
export function turnChapterCompact(item: AdminSessionListItem): string {
  return `${item.turnNo} / ${item.chapterNo}`
}

/** 390 의 카드에는 헤더가 없다 — 숫자 둘만 두면 무엇의 둘인지 알 수 없다. */
export function turnChapterVerbose(item: AdminSessionListItem): string {
  return `턴 ${item.turnNo} · 챕터 ${item.chapterNo}`
}

// ── 좁히기 ─────────────────────────────────────────────────────────────

/**
 * 작품으로 좁히는 값을 정리한다.
 *
 * **필터 축은 이것 하나다** (계약 `listAdminSessions`). 사람으로 좁히는 칸을 만들지 않는다 —
 * 응답에 플레이어 식별자가 없고 (백엔드 I-3), 만들려면 화면이 없는 값을 지어내야 한다 (F-6).
 *
 * 형식을 여기서 검사하지 않는다. 계약이 `format: uuid` 로 정한 것은 서버가 판정하고, 틀리면
 * 서버 문장이 그대로 화면에 온다 (F-4) — 프론트가 먼저 막으면 "잘못된 ID" 라는 서버가 하지
 * 않은 말을 하게 된다.
 */
export function normalizeStoryId(raw: string): string {
  return raw.trim()
}

/**
 * 테스트 세션을 접는가.
 *
 * **계약에 이 축이 없다.** `listAdminSessions` 의 쿼리는 `storyId` · `cursor` · `limit`
 * 셋뿐이고, 서버는 미리보기 세션을 늘 함께 보낸다. 그래서 이 토글은 **받아 온 쪽 안에서만**
 * 접는 표시 규칙이고, 서버에 더 요구하지 않는다 — 없는 쿼리를 만들어 보내면 그것은 조용히
 * 무시되고 화면은 걸러진 줄 안다.
 *
 * 접은 건수를 화면이 함께 말한다(`hiddenTestCount`). 말없이 줄이면 목록이 짧아진 이유가
 * 서버인지 화면인지 알 수 없다.
 */
export function visibleSessions(
  items: readonly AdminSessionListItem[],
  includeTest: boolean,
): readonly AdminSessionListItem[] {
  return includeTest ? items : items.filter((item) => !item.testSession)
}

export function hiddenTestCount(
  items: readonly AdminSessionListItem[],
  includeTest: boolean,
): number {
  return includeTest ? 0 : items.filter((item) => item.testSession).length
}

/**
 * 지금 화면에 걸린 작품의 이름 — **받아 온 세션이 말해 준 것만** 쓴다.
 *
 * 계약에 관리자용 작품 조회가 없으므로 이름을 따로 부를 수 없다. 좁힌 결과가 실어 온
 * `storyTitle` 이 있으면 그것을 칩에 적고, 없으면(아직 못 받았거나 지워진 작품이거나)
 * **좁혔다는 사실만** 적는다. 여기서 id 를 이름 자리에 넣지 않는 이유는 위와 같다.
 */
export function filterChipLabel(items: readonly AdminSessionListItem[]): string {
  const named = items.find((item) => item.storyTitle !== null)
  return named?.storyTitle ?? '작품 하나로 좁힘'
}

/**
 * 몇 건인가 — **불러온 만큼만** 말한다.
 *
 * 계약이 전체 건수를 담지 않았다 (`items` · `nextCursor` · `hasMore` 뿐). 받은 배열의 길이를
 * "24건" 이라고 적으면 그것은 서버가 하지 않은 말이 되고, 더 보기가 남아 있는 동안에는 언제나
 * 틀린 말이다. 검수 큐가 밀린 건수를 적지 않는 것과 같은 이유다.
 */
export function loadedCountLabel(count: number, hasMore: boolean): string {
  return hasMore ? `${count}건 불러옴 · 더 있음` : `${count}건`
}
