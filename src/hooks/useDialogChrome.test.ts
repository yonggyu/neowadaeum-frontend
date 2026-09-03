import { describe, expect, it } from 'vitest'

import { dialogKeyAction, type FocusSpot } from './useDialogChrome'

/**
 * 확인 다이얼로그는 **되돌릴 수 없는 동작 앞에 선다** (#43 · #63). Esc 로 닫히는 것과 Tab 이
 * 판 밖으로 새지 않는 것이 그래서 테스트가 지켜야 하는 것이 됐다.
 *
 * 여기서 지키는 것은 **판정**이다. `focus()` 호출과 `document.body.style.overflow` 는 이
 * 러너에 DOM 이 없어 확인할 수 없고(vitest 기본 환경 · jsdom 미설치), 그 사실은 PR 본문에
 * 적는다 — 통과하는 테스트가 지키지 않는 것을 지키는 척하지 않기 위해서다.
 */
const SPOTS: FocusSpot[] = ['none', 'only', 'root', 'first', 'last', 'middle']

describe('dialogKeyAction', () => {
  it('Esc_는_어디에_있든_닫는다', () => {
    for (const spot of SPOTS) {
      expect(dialogKeyAction('Escape', false, spot)).toBe('close')
      expect(dialogKeyAction('Escape', true, spot)).toBe('close')
    }
  })

  it('Tab_과_Esc_가_아닌_키는_브라우저에_맡긴다', () => {
    for (const spot of SPOTS) {
      expect(dialogKeyAction('Enter', false, spot)).toBe('pass')
      expect(dialogKeyAction('a', false, spot)).toBe('pass')
      expect(dialogKeyAction('ArrowDown', true, spot)).toBe('pass')
    }
  })

  it('마지막에서_Tab_은_처음으로_감아_돈다', () => {
    expect(dialogKeyAction('Tab', false, 'last')).toBe('focus-first')
  })

  it('처음에서_Shift_Tab_은_마지막으로_감아_돈다', () => {
    expect(dialogKeyAction('Tab', true, 'first')).toBe('focus-last')
  })

  it('판_자신이_초점일_때_Shift_Tab_은_마지막으로_간다', () => {
    // 열리자마자 판이 초점을 받는다. 그 상태의 Shift+Tab 이 뒤 화면으로 나가면 안 된다.
    expect(dialogKeyAction('Tab', true, 'root')).toBe('focus-last')
  })

  it('누를_것이_하나뿐이어도_밖으로_나가지_않는다', () => {
    expect(dialogKeyAction('Tab', false, 'only')).toBe('focus-first')
    expect(dialogKeyAction('Tab', true, 'only')).toBe('focus-last')
  })

  it('누를_것이_없으면_판을_붙들어_둔다', () => {
    expect(dialogKeyAction('Tab', false, 'none')).toBe('hold')
    expect(dialogKeyAction('Tab', true, 'none')).toBe('hold')
  })

  it('가운데_이동은_브라우저에_맡긴다', () => {
    // 양 끝에서만 개입한다 — 전부 가로채면 브라우저의 순서 규칙을 프론트가 다시 구현하게 된다.
    expect(dialogKeyAction('Tab', false, 'middle')).toBe('pass')
    expect(dialogKeyAction('Tab', true, 'middle')).toBe('pass')
    expect(dialogKeyAction('Tab', false, 'first')).toBe('pass')
    expect(dialogKeyAction('Tab', true, 'last')).toBe('pass')
  })
})
