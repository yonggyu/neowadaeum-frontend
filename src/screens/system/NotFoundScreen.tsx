import { Link } from 'react-router-dom'

import css from './system.module.css'
import { NOT_FOUND_EXITS } from './systemNotice'

/**
 * 없는 주소 — 와이어프레임 8차 `NotFound` · `NotFoundMobile`.
 *
 * **F-4 의 대상이 아니다.** 요청이 아예 일어나지 않았고 — 맞는 라우트가 없었을 뿐이다 —
 * 서버가 준 문구가 없다. 보여 줄 대상이 없으므로 문구를 화면이 쓴다.
 *
 * **API 의 `NOT_FOUND` 는 여기 오지 않는다.** 없는 작품 · 없는 세션은 그 화면이 서버의
 * `message` 로 답한다. 둘을 한 화면으로 합치면 서버의 문장이 사라지고 여기 적힌 문장이
 * 그 자리를 대신한다 — 그때 F-4 가 실제로 깨진다.
 *
 * **그리지 않는 것** — 친 주소(오류 덤프처럼 보이고 고칠 단서도 되지 못한다) · 추천 ·
 * 검색(라이브러리 조회가 인증 뒤에 있어 로그아웃 상태에서 빈 자리가 된다) · 뒤로 가기
 * (깨진 링크로 왔다면 뒤가 그 링크 자리다) · 오류 코드.
 *
 * 셸을 붙이지 않는다 — 셸의 링크가 가리키는 곳이 전부 인증 뒤에 있다.
 */
export function NotFoundScreen() {
  return (
    <main className={css.screen} data-screen="NotFound">
      <div className={css.column}>
        <p className={css.code}>404</p>
        <h1 className={css.headline}>없는 주소예요</h1>
        <p className={css.body}>이 주소에 해당하는 화면이 없습니다.</p>

        {NOT_FOUND_EXITS.map((exit) => (
          <Link key={exit.to} className={`${css.action} ${css.primary}`} to={exit.to}>
            {exit.label}
          </Link>
        ))}
      </div>
    </main>
  )
}
