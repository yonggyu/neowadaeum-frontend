import { request } from '../client'
import type { components } from '../schema'

/**
 * 신고 (계약 `createReport`). 타입을 손으로 적지 않는다 (F-2).
 *
 * 대상은 **`targetType` + `targetId`** 다. `storyId` 단일 필드가 아니다 — 장면(`turn`)과
 * 작품(`story`)은 신고의 결과가 다르기 때문에 계약이 둘을 나눠 받는다 (§13-41).
 */
export type ReportRequest = components['schemas']['ReportRequest']
export type ReportTargetType = ReportRequest['targetType']
export type ReportReason = ReportRequest['reason']

/**
 * 신고를 접수한다.
 *
 * **돌려받는 것이 없다.** `202` 이고 본문이 없다 — 접수 번호도, 지금 몇 건인지도 오지 않는다.
 * 계약이 이유를 적었다: 알려 주면 임계를 역산할 수 있다 (§13-12). 그래서 반환 타입이 `void`
 * 이고 **화면이 보여 줄 수 있는 사실은 "접수됐다" 하나뿐이다.** 번호 자리를 만들어 두면
 * 언젠가 무엇이든 채워 넣게 된다.
 *
 * `Idempotency-Key` 를 붙이지 않는다. F-7 은 **재시도가 중복 과금이 되는 요청**(턴 생성)의
 * 규칙이다. 신고는 모델을 부르지 않고 중복은 서버가 `409 ALREADY_EXISTS` 로 답하는데,
 * 키로 그 응답을 가리면 **이미 신고했다는 사실을 사용자가 알 수 없게 된다.**
 */
export function createReport(body: ReportRequest, signal?: AbortSignal): Promise<void> {
  return request<void>('/reports', { method: 'POST', body, signal })
}
