import { describe, expect, it } from 'vitest'

import { ApiError } from '../../api/client'
import {
  FALLBACK_REVEAL_MS,
  fallbackView,
  nextFallbackStage,
  recoveryHint,
  type FallbackStage,
} from './signInFallback'

/**
 * 빠져나갈 길이 **언제 서고 무엇을 말하는가** (#218, #212).
 *
 * **이 파일이 지키지 못하는 것** — 실제 GIS 도 실제 Google 계정도 부르지 않는다. 10초 뒤에
 * 사람이 무엇을 보는지, 그 버튼을 눌러 받은 토큰이 계약을 통과하는지는 **실제 계정으로 한 번
 * 돌려 봐야** 알 수 있고 그것은 `#83` 의 DoD 로 남아 있다. 여기서 못박는 것은 *화면이 어느
 * 자리로 가는가* 까지다.
 */

const NONCE_INVALID = new ApiError(401, 'LOGIN_NONCE_INVALID', '로그인을 다시 시도해 주세요.', {})

describe('nextFallbackStage', () => {
  it('218_아무_소식이_없으면_120초를_기다리지_않고_다른_길을_제안한다', () => {
    expect(nextFallbackStage('hidden', { kind: 'reveal' })).toBe('offered')
    // 실패를 선언하는 자리(`NO_RESPONSE_TIMEOUT_MS`)보다 **한참 이르다**.
    expect(FALLBACK_REVEAL_MS).toBeLessThan(120_000)
  })

  it('218_제안은_사람이_누르기_전까지_GIS_를_다시_부르지_않는다', () => {
    // `offered` 는 자리만 세운 상태다. Google 버튼(= nonce 하나)은 `taken` 뒤에만 선다.
    expect(fallbackView('offered', null)).toBe('offer')
    expect(fallbackView(nextFallbackStage('offered', { kind: 'taken' }), null)).toBe('button')
  })

  it('218_늦게_온_타이머가_이미_선_버튼을_되돌리지_않는다', () => {
    expect(nextFallbackStage('mounted', { kind: 'reveal' })).toBe('mounted')
    expect(nextFallbackStage('offered', { kind: 'reveal' })).toBe('offered')
  })

  it('212_시도가_시작되면_자리가_반드시_내려간다', () => {
    // 이 한 줄이 **만료된 nonce 를 든 버튼이 자리에 남는 것**을 막는다. 다음 실패가 세우는
    // 것은 새로 마운트된(= 새 nonce 를 받은) 버튼이다.
    const stages: FallbackStage[] = ['hidden', 'offered', 'mounted']
    for (const stage of stages) {
      expect(nextFallbackStage(stage, { kind: 'attempt' })).toBe('hidden')
    }
  })
})

describe('fallbackView', () => {
  it('218_실패_전에는_묻고_실패_뒤에는_곧바로_세운다', () => {
    expect(fallbackView('hidden', null)).toBe('none')
    expect(fallbackView('offered', null)).toBe('offer')
    // 실패한 뒤에는 물어볼 것이 없다 — One Tap 왕복이 이미 끝나 덮어쓸 창이 없다 (#181 의 자리).
    expect(fallbackView('hidden', NONCE_INVALID)).toBe('button')
    expect(fallbackView('offered', NONCE_INVALID)).toBe('button')
  })

  it('212_실패에서_다음_시도로_넘어가면_자리가_내려갔다_다시_선다', () => {
    // 401 → 사람이 그 버튼을 누른다 → 자리가 내려간다 → 다시 401 → **새 버튼**이 선다.
    expect(fallbackView('hidden', NONCE_INVALID)).toBe('button')
    const restarted = nextFallbackStage('hidden', { kind: 'attempt' })
    expect(fallbackView(restarted, null)).toBe('none')
    expect(fallbackView(restarted, NONCE_INVALID)).toBe('button')
  })
})

describe('recoveryHint', () => {
  it('F4_서버_문구를_바꾸지_않는다_212', () => {
    const hint = recoveryHint(NONCE_INVALID)
    expect(hint).not.toBeNull()
    // 서버 문장은 화면이 따로 그대로 그린다. 이 줄은 그것을 **되풀이하지도 바꾸지도** 않는다.
    expect(hint).not.toContain(NONCE_INVALID.message)
  })

  it('212_원인을_고르지_않고_할_일만_말한다', () => {
    // 없든 · 안 맞든 · 만료됐든 · 이미 쓰였든 서버가 코드 하나로 답하기로 했다 (S-6).
    // 화면이 그중 하나를 골라 말하면 서버가 하지 않기로 한 구분을 대신 하는 것이 된다.
    for (const guess of ['만료', '시간이 지', '이미 쓰', '차단']) {
      expect(recoveryHint(NONCE_INVALID)).not.toContain(guess)
    }
  })

  it('212_이_코드에만_붙인다', () => {
    expect(recoveryHint(new ApiError(401, 'UNAUTHENTICATED', '로그인이 필요해요.', {}))).toBeNull()
    expect(recoveryHint(new ApiError(400, 'CONSENT_REQUIRED', '동의가 필요해요.', {}))).toBeNull()
    // 서버에 닿기도 전에 끝난 실패(GIS · 설정)에는 붙일 회복 방법이 다르다.
    expect(recoveryHint(new Error('Google 로그인 창이 열리지 않았어요.'))).toBeNull()
    expect(recoveryHint(null)).toBeNull()
  })
})
