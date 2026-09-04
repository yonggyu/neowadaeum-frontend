import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { UNREACHABLE_MESSAGE } from '../../api/errors'
import { ROUTES } from '../../routes/routes'
import { NOT_FOUND_EXITS, retryLabel } from './systemNotice'

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
