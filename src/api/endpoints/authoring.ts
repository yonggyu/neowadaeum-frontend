import { request } from '../client'
import type { components } from '../schema'

/**
 * 작품 만들기 슬라이스의 계약 (`tags: [authoring]`) 중 **내 작품의 공개 범위**만.
 *
 * `me.ts` 에 두지 않는다 — 그 파일은 `/me/**` 를 부르는 자리이고 이것은 `/stories/{id}` 다.
 * 같은 화면이 쓴다는 이유로 한 파일에 모으면 경로와 파일의 대응이 한 번 깨지고, 그다음부터는
 * 어디를 열어야 하는지 매번 찾아야 한다.
 *
 * 원고(`/authoring/drafts/**`)는 아직 여기 없다 — 작품 만들기 화면이 없어서 부를 자리가 없다.
 */
export type Visibility = components['schemas']['Visibility']
export type ReviewStatus = components['schemas']['ReviewStatus']
export type ReviewStatusResponse = components['schemas']['ReviewStatusResponse']

/**
 * 공개 범위 변경 (`changeStoryVisibility`). 응답은 **변경 후 상태**다.
 *
 * `unlisted → public` 승격은 **재검수를 강제 트리거한다** — 계약이 이유를 적었다:
 * *"자동 검수만 받은 작품이 공개 섹션에 올라오는 경로를 막는다."* 그래서 이 호출의 응답으로
 * `reviewStatus` 가 검수 중으로 되돌아오는 일이 정상이며, 화면은 그것을 실패로 읽지 않는다.
 * 서버가 준 상태 하나가 진실이고 프론트가 다시 판정하지 않는다.
 *
 * 응답의 `rejectReasons` 는 **카테고리만** 담는다 (백엔드 R8.7) — 화면이 그 이상을 추측하지
 * 않는다 (F-5).
 */
export function changeStoryVisibility(
  storyId: string,
  visibility: Visibility,
  signal?: AbortSignal,
): Promise<ReviewStatusResponse> {
  return request<ReviewStatusResponse>(`/stories/${encodeURIComponent(storyId)}/visibility`, {
    method: 'PATCH',
    body: { visibility },
    signal,
  })
}
