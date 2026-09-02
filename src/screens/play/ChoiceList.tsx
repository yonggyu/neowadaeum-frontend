import type { Choice } from '../../api/endpoints/play'
import { choiceLayout, choiceNumber, showsChoiceNumber } from './choiceLayout'
import s from './play.module.css'

interface Props {
  choices: readonly Choice[]
  onSelect: (choiceId: string) => void
}

/**
 * 진행은 여기서만 일어난다 — **본문 어디를 탭해도 다음으로 가지 않는다** (2f).
 *
 * `choice.disabled` 를 읽지 않는다. 계약에는 남아 있지만 서버가 항상 `false` · `null` 로
 * 돌려주므로 (corrections P0) 그릴 것이 없고, 없는 상태를 위해 분기를 만들어 두면
 * **한 번도 실행되지 않는 코드가 규칙인 척한다** (4a 가 2b·3a 의 Disabled 규칙을 철회했다).
 */
export function ChoiceList({ choices, onSelect }: Props) {
  const layout = choiceLayout(choices)
  if (layout === 'none') {
    return null
  }

  return (
    <div className={s.choices} data-layout={layout} role="group" aria-label="선택지">
      {choices.map((choice) => (
        <button
          key={choice.choiceId}
          type="button"
          className={s.choice}
          // 서버가 발급한 `choiceId` 만 넘긴다. 화면에 보이는 `text` 는 제출면에 없다 (F-1).
          onClick={() => onSelect(choice.choiceId)}
        >
          {showsChoiceNumber(layout) ? (
            <span className={s.number}>{choiceNumber(choice.order)}</span>
          ) : null}
          <span className={s.choiceText}>{choice.text}</span>
          <span className={s.arrow} aria-hidden="true">
            →
          </span>
        </button>
      ))}
    </div>
  )
}
