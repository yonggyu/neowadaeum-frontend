import type { Ref } from 'react'

import type { Paragraph, Turn } from '../../api/endpoints/play'
import s from './play.module.css'

/**
 * 본문.
 *
 * 계약이 주는 것은 **문단 배열이다** — 통 문자열이 아니다 (R5.1). 대사와 나레이션을
 * 다르게 렌더할 수 있는 것이 그 이유이고 (R5.2), 합쳐 놓으면 그 구분이 사라진다.
 */
export function StoryText({ turn, ref }: { turn: Turn; ref?: Ref<HTMLElement> }) {
  return (
    <article className={s.story} ref={ref}>
      <div className={s.paragraphs}>
        {/*
         * 문단에 식별자가 없다. 한 턴의 문단 배열은 도착한 뒤 바뀌지 않으므로 순서가
         * 안정적인 키다 — 여기서 키를 만들어 붙이면 그 값이 무엇을 뜻하는지 아무도 모른다.
         */}
        {turn.paragraphs.map((paragraph, index) => (
          <ParagraphText key={index} paragraph={paragraph} />
        ))}
      </div>
      {/*
       * AI 사전 고지 — **문구를 코드에 두지 않는다** (R11.1). `service_config` 가 정하고
       * 계약이 `TurnResponse.noticeText` 로 매 턴 실어 준다 (백엔드 #281). 플레이 화면만
       * `/landing` 을 따로 부르지 않는 이유가 이것이다 — 같은 화면에서 캐시 수명이 갈리면
       * 다른 문구가 보인다.
       *
       * **상시 표시한다.** 문구가 설정돼 있지 않으면 서버가 500 으로 끊으므로 (13-27 개정),
       * 이 자리가 비어 보이는 상태 자체가 존재하지 않는다.
       */}
      <p className={s.aiNotice}>{turn.noticeText}</p>
    </article>
  )
}

function ParagraphText({ paragraph }: { paragraph: Paragraph }) {
  if (paragraph.type === 'narration' || paragraph.speakerName === null) {
    // 화자가 없으면 나레이션이다 (R5.2).
    return <p className={s.narration}>{paragraph.text}</p>
  }
  return (
    <p className={s.dialogue}>
      <span className={s.speaker}>{paragraph.speakerName}</span>
      <span>{paragraph.text}</span>
    </p>
  )
}
