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
      {/* Play 화면은 AI 고지를 상시 둔다 (1k). 계약이 실제 생성 경로를 알려주면 그것을 따른다 */}
      {turn.isAiGenerated === false ? null : (
        <p className={s.aiNotice}>AI Generated Story</p>
      )}
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
