import { UNREACHABLE_MESSAGE } from '../../api/errors'
import { NoticePanel, UnreachableMark } from './NoticePanel'
import css from './system.module.css'
import { retryLabel } from './systemNotice'

/**
 * 화면 **안**에서 서버에 닿지 못한 자리 — 8차 B-2 의 규칙을 그대로 받는다 (#122).
 *
 * 부팅의 `UnreachableScreen` 과 **같은 사실**을 말한다. 그래서 같은 껍데기(`NoticePanel`)를
 * 쓰고, 같은 문구(`errors.ts` 의 한 줄)를 쓴다 — 지금까지는 이 자리가 [작품 둘러보기] 를
 * 그려서, 부팅 때는 "갈 곳이 없다" 고 하고 화면 안에서는 "라이브러리로 가 보라" 고 했다.
 * **누르면 같은 이유로 실패한다.**
 *
 * **나가는 문을 그리지 않는다** — 그 화면도 서버를 부른다. 그리는 것은 문구 하나와
 * [다시 시도] 하나뿐이고, `onRetry` 가 없는 호출자(`StepPreview` · `ResumeScreen`)에서는
 * 문구만 남는다.
 *
 * **`pending` 을 들지 않는다.** 부팅 자리의 재시도는 새로 고침이라 돌아오지 않지만, 이 자리의
 * 재시도는 **그 화면의 호출 하나**이고 돌아온다 — 누르면 화면이 곧바로 자기 로딩 상태로
 * 바뀌면서 이 판이 사라진다. 여기에 두 번째 눌림을 막는 상태를 두면 그 화면의 로딩과 이 판의
 * 상태가 같은 것을 두 번 말한다.
 */
export function UnreachableNotice({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className={css.inset}>
      <NoticePanel mark={<UnreachableMark />} headline={UNREACHABLE_MESSAGE} headlineTag="p">
        {onRetry === undefined ? null : (
          <button type="button" className={`${css.action} ${css.primary}`} onClick={onRetry}>
            {/* 문구는 부팅 자리와 같은 곳에서 온다. 이 자리에 `pending` 은 없다 */}
            {retryLabel(false)}
          </button>
        )}
      </NoticePanel>
    </div>
  )
}
