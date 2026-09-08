import { describe, expect, it } from 'vitest'

import type { MeResponse } from '../api/endpoints/me'
import { guardDecision } from './guard'
import type { AnonymousReason } from './session'

const ACCOUNT: MeResponse = { displayName: null, role: 'user', status: 'active' }

const anonymous = (reason: AnonymousReason) => ({ kind: 'anonymous', reason }) as const

describe('guardDecision', () => {
  it('복원_중에는_로그인으로_보내지_않는다 — 새고침마다 로그인 화면이 스치면 로그인이 풀린 것으로 보인다', () => {
    expect(guardDecision({ kind: 'restoring' })).toBe('wait')
  })

  it('로그인됐으면 통과시킨다', () => {
    expect(guardDecision({ kind: 'authenticated', account: ACCOUNT })).toBe('render')
  })

  it('토큰이 없으면 로그인으로 보낸다 — 401 을 받고 실패 화면을 보여 주는 것이 이 이슈였다', () => {
    expect(guardDecision(anonymous('no_token'))).toBe('signIn')
  })

  it('거절당했으면 로그인으로 보낸다', () => {
    expect(guardDecision(anonymous('rejected'))).toBe('signIn')
  })

  it('unreachable_은_로그아웃과_같지_않다 — 로그인 여부를 아직 모르므로 로그인하라고 말할 수 없다', () => {
    expect(guardDecision(anonymous('unreachable'))).toBe('unreachable')
  })

  it('서버가 답하지 못한 것과 거절한 것이 다른 결정으로 갈린다 — #24 의 구분을 뭉개지 않는다', () => {
    expect(guardDecision(anonymous('unreachable'))).not.toBe(guardDecision(anonymous('rejected')))
  })
})
