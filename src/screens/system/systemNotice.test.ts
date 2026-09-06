import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { ApiError, toApiError } from '../../api/client'
import { UNKNOWN_ERROR, UNREACHABLE_MESSAGE } from '../../api/errors'
import { ROUTES } from '../../routes/routes'
import { isUnreachable, NOT_FOUND_EXITS, PLAY_ENTRY_EXITS, retryLabel } from './systemNotice'

const sourceOf = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')

describe('404 의 나가는 문', () => {
  it('문이 하나다 — 추천도 검색도 뒤로 가기도 두지 않는다', () => {
    expect(NOT_FOUND_EXITS).toHaveLength(1)
  })

  it('그 하나가 랜딩이다 — 라이브러리로 보내면 RequireAuth 가 다시 튕겨 두 번 튕긴다', () => {
    expect(NOT_FOUND_EXITS[0]?.to).toBe(ROUTES.landing)
    expect(NOT_FOUND_EXITS[0]?.to).not.toBe(ROUTES.library)
  })
})

describe('retryLabel', () => {
  it('누르기 전과 누른 뒤가 다른 문구다', () => {
    expect(retryLabel(false)).not.toBe(retryLabel(true))
  })

  it('두_번째_실패에서_문구를_바꾸지_않는다 — 몇 번 눌렀는지는 새로운 사실이 아니다', () => {
    // 횟수를 받지 않는다. 인자가 `pending` 하나라는 것이 그 규칙의 자리다.
    expect(retryLabel).toHaveLength(1)
    expect(retryLabel(false)).toBe('다시 시도')
    expect(retryLabel(true)).toBe('다시 확인하는 중…')
  })
})

/*
 * 화면이 **무엇을 그리지 않는가** 는 렌더링해야 보이지만 러너에 DOM 이 없다(jsdom 미설치).
 * 그래서 그리는 결과 대신 **그릴 수단이 없다는 사실**을 못박는다 — 링크를 만들 방법도,
 * 두 번째 문구를 적을 자리도 파일 안에 없다.
 *
 * 다음 둘은 이 방식으로 지킬 수 없어 남는다: 버튼이 실제로 화면에 그려지는가, `role="alert"`
 * 가 붙은 자리가 맞는가. 렌더링 테스트가 생기면 그때 옮긴다.
 */
describe('unreachable 화면이 두지 않는 것', () => {
  const source = sourceOf('./UnreachableScreen.tsx')

  it('랜딩_링크도_로그인_버튼도_두지_않는다 — 라우터를 아예 부르지 않는다', () => {
    // 로그인 여부를 모르는 상태이고, 랜딩도 서버를 부른다. 갈 수 있는 곳이 없다.
    expect(source).not.toContain('react-router-dom')
    expect(source).not.toContain('ROUTES')
  })

  it('두_번째_문구를_만들지_않는다 — errors.ts 의 그 한 줄을 그대로 쓴다', () => {
    expect(source).toContain('UNREACHABLE_MESSAGE')
    // 같은 문장을 복사해 두면 계약 밖 실패에 두 개의 진실이 생긴다.
    expect(source).not.toContain(UNREACHABLE_MESSAGE)
  })
})

/*
 * #122 — 화면 **안**에서 일어난 같은 실패.
 *
 * 지금까지 이 갈래는 `ErrorNotice` 를 지나며 [작품 둘러보기] 를 그렸다. 부팅 자리는 "갈 곳이
 * 없다" 고 하고 화면 안에서는 "라이브러리로 가 보라" 고 한 것이며, **누르면 같은 이유로
 * 실패한다.** 아래 둘이 그 갈림을 못박는다: 판정(`isUnreachable`)과, 그 갈래가 문을 그릴
 * 수단을 아예 갖지 않는다는 사실.
 */
describe('닿지 못한 실패의 판정 (F-4 · 8차 B-2)', () => {
  const unreachable = new ApiError(0, UNKNOWN_ERROR, UNREACHABLE_MESSAGE, {})

  it('status_0_만_닿지_못한_것이다 — client.ts 가 그 자리에 0 을 적는다', () => {
    expect(isUnreachable(unreachable)).toBe(true)
  })

  it('HTTP_응답이_온_실패는_닿은_것이다 — 502 HTML 페이지도 닿은 것이다', () => {
    // 계약 밖 본문이라 코드는 `UNKNOWN` 이지만 응답은 왔다. 문을 지울 이유가 없다.
    expect(isUnreachable(new ApiError(502, UNKNOWN_ERROR, '요청이 실패했어요 (HTTP 502)', {}))).toBe(
      false,
    )
    expect(isUnreachable(new ApiError(401, 'UNAUTHENTICATED', '로그인이 필요해요', {}))).toBe(false)
    expect(isUnreachable(new ApiError(404, 'NOT_FOUND', '없어요', {}))).toBe(false)
  })

  it('ApiError_가_아닌_것을_닿지_못한_것으로_읽지_않는다', () => {
    expect(isUnreachable(new Error('무언가'))).toBe(false)
    expect(isUnreachable('무언가')).toBe(false)
    expect(isUnreachable(null)).toBe(false)
  })

  it('client_가_계약_밖_실패에_붙이는_그_값과_이어져_있다', () => {
    // 판정이 `client.ts` 의 변환과 같은 사실을 보는지 확인한다 — 여기서 갈리면 화면은
    // 서버가 죽은 것을 모른 채 문을 그린다.
    expect(isUnreachable(toApiError(new TypeError('Failed to fetch')))).toBe(true)
  })
})

describe('화면 안의 unreachable 판이 두지 않는 것', () => {
  const source = sourceOf('./UnreachableNotice.tsx')

  it('나가는_문을_그릴_수단이_없다 — 라우터를 부르지 않는다 (8차 B-2)', () => {
    expect(source).not.toContain('react-router-dom')
    expect(source).not.toContain('ROUTES')
  })

  it('두_번째_문구를_만들지_않는다 — 부팅 자리와 같은 한 줄을 쓴다', () => {
    expect(source).toContain('UNREACHABLE_MESSAGE')
    expect(source).not.toContain(UNREACHABLE_MESSAGE)
  })

  it('누른_뒤의_상태를_들지_않는다 — 이 자리의 재시도는 돌아온다', () => {
    // 부팅 자리의 재시도는 새로 고침이라 돌아오지 않아 그 자리에만 상태가 있다. 두 뜻을
    // 한 조각에 넣지 않았다는 것이 이 줄이다 — 상태를 만들 수단 자체가 여기 없다.
    expect(source).not.toContain('useState')
    expect(source).toContain('retryLabel(false)')
  })
})

describe('껍데기는 문을 정하지 않는다 (#122 · #129)', () => {
  const source = sourceOf('./NoticePanel.tsx')

  it('공유하는_것은_모양뿐이다 — 라우터도 재시도도 안쪽에 없다', () => {
    // 셋이 함께 쓰는 조각이 문 하나를 들고 있으면, 문을 두지 않는 화면이 그것을 꺼야 한다.
    expect(source).not.toContain('react-router-dom')
    expect(source).not.toContain('onRetry')
  })
})

describe('sessionId 없이 열린 Play 의 나가는 문 (8차 B-4)', () => {
  it('문이_하나다 — 원인을 나누지 않으니 갈래도 하나다', () => {
    expect(PLAY_ENTRY_EXITS).toHaveLength(1)
  })

  it('그_하나가_라이브러리다 — 이 화면은 RequireAuth 안이라 실제로 열린다', () => {
    expect(PLAY_ENTRY_EXITS[0]?.to).toBe(ROUTES.library)
    // 랜딩이 아니다. `B-1` 이 랜딩을 고른 근거(가드 밖이라 세션을 모른다)가 여기엔 없다.
    expect(PLAY_ENTRY_EXITS[0]?.to).not.toBe(ROUTES.landing)
  })

  it('이어서_하기로_보내지_않는다 — 없는 sessionId 가 이 실패의 원인이다', () => {
    // `:sessionId` 가 남아 있는 주소는 만들 수 없다. 만들 수 없는 문을 그리지 않는다.
    expect(PLAY_ENTRY_EXITS[0]?.to).not.toContain(':')
    expect(PLAY_ENTRY_EXITS[0]?.to).not.toBe(ROUTES.resume)
  })
})

/*
 * **이 파일이 지키지 못하는 것** — 러너에 DOM 이 없다(jsdom 미설치).
 *
 * 위의 것들은 판정과 *그릴 수단*까지만 못박는다. 다음은 렌더링 테스트가 생기기 전까지 남는다:
 * `ErrorNotice` 가 닿지 못한 실패에서 실제로 `UnreachableNotice` 를 그리는가 · Play 진입 실패가
 * 빈 `<main>` 이 아닌가 · `role="alert"` 와 제목 요소가 붙은 자리가 맞는가 · 네 폭에서의 모양.
 * 통과하는 이 테스트들이 그것까지 지킨다고 읽지 않는다.
 */
