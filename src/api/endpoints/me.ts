import { request } from '../client'
import type { components } from '../schema'
import type { VisibleReviewStatus } from './authoring'

/**
 * 내 계정 — `GET /me` 와, 내 세션 · 내가 만든 작품.
 *
 * **`GET /me` 가 생겼다** (backend #262). 이전에는 `/api/v1/me` 에 `DELETE`(탈퇴) 하나뿐이라
 * "지금 로그인돼 있는가" 를 물을 자리가 없었다. 다만 `MeResponse` 가 주는 것은 여전히
 * `displayName` · `role` · `status` 셋뿐이다 — `playerRef` · 이메일 · 소셜 식별자 · 생년월일은
 * 오지 않는다 (§13-7, I-3). 화면이 그것을 그릴 수 없는 것이 아니라 **받지 않는다** (F-6).
 */
export type MeResponse = components['schemas']['MeResponse']
export type UpdateMeRequest = components['schemas']['UpdateMeRequest']
export type MySessionItem = components['schemas']['MySessionItem']
export type MySessionsResponse = components['schemas']['MySessionsResponse']

/**
 * 내가 만든 작품 한 줄. `reviewStatus` 가 계약보다 **좁다** — `deleted` 가 빠진다.
 *
 * 지운 작품은 이 목록에서 조회되지 않는다 (정정본 §13-58). 근거와 좁히는 이유는
 * `VisibleReviewStatus` 에 적혀 있다.
 */
export type MyStoryItem = Omit<components['schemas']['MyStoryItem'], 'reviewStatus'> & {
  reviewStatus: VisibleReviewStatus
}

export type MyStoriesResponse = Omit<components['schemas']['MyStoriesResponse'], 'items'> & {
  items: MyStoryItem[]
}

/** 계약의 `status` 는 이 둘뿐이다 — `in_progress` 는 존재하지 않는 값이었다 (§13-6). */
export type MySessionStatus = MySessionItem['status']

/** 커서 페이지 요청. `limit` 은 계약의 기본값(20)에 맡긴다. */
export interface CursorQuery {
  cursor?: string | null
  signal?: AbortSignal
}

/**
 * 쿼리 문자열을 만든다.
 *
 * 커서를 손으로 이어 붙이지 않는다 — 서버가 주는 커서의 형식은 계약이 정하지 않았고
 * (`type: string` 뿐), 인코딩하지 않으면 base64 의 `+` 나 `=` 가 조용히 망가진다.
 */
function query(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      search.set(key, value)
    }
  }
  const encoded = search.toString()
  return encoded === '' ? '' : `?${encoded}`
}

/**
 * 내 계정 (`getMe`).
 *
 * **로그인 여부는 상태 코드로 온다** — 유효하면 `200`, 아니면 `401` 이다. 본문에
 * `isLoggedIn` 이 없으므로 호출부는 `ApiError.status` 로 갈린다. 부팅 복원이 이것을 부른다
 * (`src/auth/session.ts`).
 */
export function getMe(signal?: AbortSignal): Promise<MeResponse> {
  return request<MeResponse>('/me', { signal })
}

/**
 * 표시명 설정·변경 (`updateMe`). 응답은 **바뀐 내 계정**이다.
 *
 * **표시명을 만드는 유일한 경로다** (backend #271, 정정본 §13-55). 읽는 곳은 셋인데(작품 상세 ·
 * 커뮤니티 카드 · `GET /me`) 쓰는 곳이 없어서 실사용에서 `displayName` 이 늘 `null` 이었다.
 *
 * **설정과 변경이 같은 요청이다** (upsert) — 프로필이 있는지 화면이 먼저 물어보지 않는다.
 * 나누면 두 요청 사이에 다른 요청이 끼는 순간 어느 쪽도 맞지 않는다.
 *
 * **돌려받은 값이 저장된 이름이다.** 서버가 정규화한다(NFC · 양끝 공백 · 연속 공백 하나로).
 * 보낸 값을 낙관적으로 그리면 화면과 서버가 갈라진다 — 그래서 이 함수가 `void` 가 아니라
 * `MeResponse` 를 돌려주고, 화면은 그것만 쓴다.
 *
 * **형식 규칙을 여기 옮겨 적지 않는다.** 길이·허용 문자·`@` 금지의 정본은 서버 도메인이고
 * (계약: *"화면 검증은 편의이지 계약이 아니다"*), 옮겨 적는 순간 정본이 둘이 된다 — 갈라지는
 * 날 한쪽이 통과시킨 이름을 다른 쪽이 거절한다. 거절은 `400 VALIDATION_ERROR` 로 오고 화면은
 * 서버의 `message` 를 그대로 낸다 (F-4).
 *
 * **`409` 가 없다.** 표시명에 유일 제약이 없어 같은 이름을 가진 회원이 둘 이상 있을 수 있다 —
 * 화면이 "이미 사용 중" 같은 문구를 지어내지 않는다.
 */
export function updateMe(displayName: string, signal?: AbortSignal): Promise<MeResponse> {
  const body: UpdateMeRequest = { displayName }
  return request<MeResponse>('/me', { method: 'PATCH', body, signal })
}

/**
 * 탈퇴 (`withdraw`). `204` · 본문 없음.
 *
 * **되돌릴 수 없다.** 다만 이 호출이 하는 일은 회원 상태를 `withdrawn` 으로 옮기는 데까지이고
 * (R12.5), 실제 파기(플레이 기록 삭제 · `player_ref` 매핑 파기)와 공개 UGC 강등은 파기 배치가
 * 뒤에 수행한다 (B-61, §13-9). 그래서 성공했다고 **"삭제됐다"고 말하지 않는다** — 확인 화면의
 * 문구가 그 경계를 지킨다 (`src/screens/account/accountSettings.ts`).
 *
 * 이미 탈퇴한 계정에도 `204` 로 답하므로 재시도가 화면을 어긋나게 하지 않는다.
 */
export function withdraw(signal?: AbortSignal): Promise<void> {
  return request<void>('/me', { method: 'DELETE', signal })
}

/** 내 이야기 (`getMySessions`). `status` 를 생략하면 둘 다 온다 — 화면은 탭마다 하나만 받는다. */
export function getMySessions(
  status: MySessionStatus,
  page: CursorQuery = {},
): Promise<MySessionsResponse> {
  return request<MySessionsResponse>(`/me/sessions${query({ status, cursor: page.cursor })}`, {
    signal: page.signal,
  })
}

/**
 * 내가 만든 작품 (`getMyStories`).
 *
 * `rejectReasons` 는 **카테고리만** 담는다 — 어떤 표현이 걸렸는지는 서버가 주지 않고,
 * 화면도 그 이상을 추측하지 않는다 (F-5, 백엔드 R8.7).
 */
export function getMyStories(page: CursorQuery = {}): Promise<MyStoriesResponse> {
  return request<MyStoriesResponse>(`/me/stories${query({ cursor: page.cursor })}`, {
    signal: page.signal,
  })
}

/**
 * 세션 삭제 (`deleteSession`). 204 · 본문 없음.
 *
 * My Stories 의 세션 카드에서만 부른다 — 진행 기록을 지우는 자리가 여기 하나다 (3g).
 * 두 번 지워도 `204` 이므로(백엔드 §13-26) 재시도해도 화면이 어긋나지 않는다.
 */
export function deleteMySession(sessionId: string, signal?: AbortSignal): Promise<void> {
  return request<void>(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE', signal })
}
