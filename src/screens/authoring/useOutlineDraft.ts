import { useEffect, useRef, useState } from 'react'

import { toApiError, type ApiError } from '../../api/client'
import {
  outlineDraft,
  CONDITION_TEMPLATE_KEYS,
  type ConditionTemplateKey,
} from '../../api/endpoints/authoring'
import { emptyChapter, emptyEnding, fromOutlineResponse, type OutlineValues } from './outline'

/**
 * 챕터·엔딩 AI 초안 (`outlineDraft`, 와이어프레임 3e).
 *
 * 이 훅을 부르는 화면은 **뒤따르는 PR** 에 온다 (`outline.ts` 와 같은 이유).
 *
 * **`draftJobId` 가 없다.** 3e 의 "필요 데이터" 가 그 이름을 적었지만 계약의 `outlineDraft` 는
 * `200` 으로 `OutlineResponse` 를 바로 돌려준다 — 작업 id 도, 그것을 조회하는 경로도 없다.
 * 없는 값을 위해 폴링 상태를 만들지 않는다. 이 요청이 **모델을 기다리는 동안**이 곧 "생성 중"
 * 이고, `504 GENERATION_TIMEOUT` · `502 PROVIDER_ERROR` 는 그 기다림의 정상적인 끝이다.
 */
export type OutlineJob =
  /** 아직 초안을 받지도, 직접 쓰기 시작하지도 않았다 */
  | { kind: 'start' }
  | { kind: 'generating' }
  | { kind: 'failed'; error: ApiError }
  | { kind: 'editing' }

export interface OutlineDraftHandle {
  readonly job: OutlineJob
  /**
   * 조건 템플릿의 키 목록.
   *
   * **서버가 준다** (`OutlineResponse.conditionTemplates`) — 계약이 그 자리에 *"클라이언트가
   * 이 목록을 소스에 적지 않는다"* 고 적었다. 초안을 받기 전에는 폴백 상수이며, 그 길은
   * "직접 작성하기" 하나다.
   */
  readonly templates: readonly ConditionTemplateKey[]
  /** 초안을 받는다. `ConfirmDialog` 가 `Promise` 를 요구하므로 그대로 돌려준다 */
  generate: () => Promise<void>
  /** 3e — "직접 작성하기". 기다리던 요청을 접고 빈 칸 하나씩으로 시작한다 */
  writeManually: () => void
}

export function useOutlineDraft(
  draftId: string,
  values: OutlineValues,
  onChange: (values: OutlineValues) => void,
): OutlineDraftHandle {
  // 이미 챕터나 엔딩이 있으면 편집부터 시작한다 — 초안을 받았거나, 앞서 직접 쓴 원고다.
  const [job, setJob] = useState<OutlineJob>(() =>
    values.chapters.length > 0 || values.endings.length > 0 ? { kind: 'editing' } : { kind: 'start' },
  )
  const [templates, setTemplates] = useState<readonly ConditionTemplateKey[]>(
    CONDITION_TEMPLATE_KEYS,
  )
  const inFlight = useRef<AbortController | null>(null)

  // 화면을 떠난 뒤에 응답이 도착해 값을 덮지 않게 한다.
  useEffect(() => () => inFlight.current?.abort(), [])

  /**
   * **자동으로 부르지 않는다.** 3e 는 이 단계의 첫 화면을 "생성 중" 으로 그렸지만, 초안은
   * 모델을 부르는 유료 호출이고 계정당 **하루 20회**다 (정정본 §13-34). 단계를 오가는 것만으로
   * 그 횟수가 줄면 작성자는 자기가 쓰지도 않은 이유로 막히고, 그 사실은 20번째 호출에서야
   * 드러난다. 그래서 시작을 사람이 누른다 — 눌린 뒤의 화면은 3e 가 그린 그대로다.
   */
  function generate(): Promise<void> {
    inFlight.current?.abort()
    const controller = new AbortController()
    inFlight.current = controller
    setJob({ kind: 'generating' })
    return outlineDraft(draftId, controller.signal).then(
      (response) => {
        if (controller.signal.aborted) return
        setTemplates(response.conditionTemplates)
        onChange(fromOutlineResponse(response))
        setJob({ kind: 'editing' })
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return
        // 문구는 서버의 것이다 (F-4). 504 · 502 · 429 어느 쪽이든 여기서 다시 쓰지 않는다.
        setJob({ kind: 'failed', error: toApiError(cause) })
      },
    )
  }

  function writeManually(): void {
    inFlight.current?.abort()
    if (values.chapters.length === 0 && values.endings.length === 0) {
      // 빈 편집 화면을 주지 않는다 — 무엇을 채워야 하는지가 칸으로 보여야 한다. 첫 엔딩이
      // 기본인 것은 R2.11 을 만족하는 유일한 시작 상태이기 때문이다(조건 없는 엔딩 하나).
      onChange({ chapters: [emptyChapter()], endings: [{ ...emptyEnding(), isDefault: true }] })
    }
    setJob({ kind: 'editing' })
  }

  return { job, templates, generate, writeManually }
}
