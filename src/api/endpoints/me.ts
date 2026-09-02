import { request } from '../client'
import type { components } from '../schema'

/**
 * 내 계정 — `GET /me` 와, 내 세션 · 내가 만든 작품.
 *
 * **`GET /me` 가 생겼다** (backend #262). 이전에는 `/api/v1/me` 에 `DELETE`(탈퇴) 하나뿐이라
 * "지금 로그인돼 있는가" 를 물을 자리가 없었다. 다만 `MeResponse` 가 주는 것은 여전히
 * `displayName` · `role` · `status` 셋뿐이다 — `playerRef` · 이메일 · 소셜 식별자 · 생년월일은
 * 오지 않는다 (§13-7, I-3). 화면이 그것을 그릴 수 없는 것이 아니라 **받지 않는다** (F-6).
 */
export type MeResponse = components['schemas']['MeResponse']
export type MySessionItem = components['schemas']['MySessionItem']
export type MySessionsResponse = components['schemas']['MySessionsResponse']
export type MyStoryItem = components['schemas']['MyStoryItem']
export type MyStoriesResponse = components['schemas']['MyStoriesResponse']

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
