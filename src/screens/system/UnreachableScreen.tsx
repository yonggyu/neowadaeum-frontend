import { useState } from 'react'

import { UNREACHABLE_MESSAGE } from '../../api/errors'
import css from './system.module.css'
import { retryLabel } from './systemNotice'

/**
 * 서버에 닿지 못한 채 부팅이 끝난 자리 — 와이어프레임 8차 `Unreachable` · `UnreachableMobile`.
 *
 * `RequireAuth` 가 `unreachable` 로 판정했을 때 보호된 라우트 전체를 대신한다. 라우트가
 * 아니라 **가드 안의 한 분기**이며, 셸이 붙는 라우트에서는 셸의 본문 자리에 그대로 들어간다.
 * 두 경우 모두 같은 420 컬럼이다.
 *
 * **문구를 새로 만들지 않는다.** `errors.ts` 의 그 한 줄을 그대로 쓴다 — 같은 사실에 두 번째
 * 문장을 더하면 어느 쪽이 맞는지가 매번 문제가 된다.
 *
 * **그리지 않는 것**
 *
 * - 로그인 버튼과 "다시 로그인해 주세요" — 이 상태는 로그인 여부를 **모른다**. 버튼이 있으면
 *   그것이 첫 해법으로 보이고, 사용자는 일어나지도 않은 로그아웃을 고치려 든다
 * - 랜딩으로 가는 링크 — **그 화면도 서버를 부른다.** 갈 수 없는 곳으로 가는 문을 그리지 않는다
 * - 원인(오프라인 · 미기동 · DNS · CORS 가 화면에서 같아 보인다) · 추적 번호(응답이 없으니
 *   `X-Request-Id` 도 오지 않았다) · 재시도 횟수
 * - 자동 재시도 — 서버가 뜨는 순간 모든 탭이 동시에 몰린다. 다시 부르는 것은 사람이 정한다
 *
 * `role="alert"` 다. 복원 중(`restoring`)의 `role="status"` 와 다르다 — 저쪽은 아직 아무 일도
 * 일어나지 않았고, 이쪽은 화면이 바뀐 것을 낭독기가 그 자리에서 알려야 한다.
 */
export function UnreachableScreen({ onRetry }: { onRetry: () => void }) {
  /*
   * 누른 뒤의 상태를 여기서 든다. `onRetry` 는 부팅을 통째로 다시 돌리므로 돌아오지 않는다 —
   * 되돌릴 자리가 없고, 그동안 같은 버튼이 두 번 눌리지 않아야 한다.
   */
  const [pending, setPending] = useState(false)

  return (
    <main className={css.screen} data-screen="Unreachable">
      {/* `role` 은 안쪽 덩어리가 갖는다 — `main` 에 얹으면 랜드마크가 사라진다 */}
      <div className={css.column} role="alert">
        <svg
          className={css.icon}
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9.5 24h11a5.5 5.5 0 0 0 1.2-10.87A7.5 7.5 0 0 0 8.6 11.4" />
          <path d="M9.5 24a5.5 5.5 0 0 1-1.6-10.77" />
          <path d="M5 5l22 22" />
        </svg>

        <h1 className={css.headline}>{UNREACHABLE_MESSAGE}</h1>

        <button
          type="button"
          className={`${css.action} ${css.primary}`}
          disabled={pending}
          onClick={() => {
            setPending(true)
            onRetry()
          }}
        >
          {retryLabel(pending)}
        </button>
      </div>
    </main>
  )
}
