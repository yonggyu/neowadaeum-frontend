import { describe, expect, it } from 'vitest'

import type { AdminSessionDebug } from '../../api/endpoints/admin'
import {
  callLabel,
  COST_NOTE,
  currentTurn,
  DEBUG_PANELS,
  DEFAULT_PANEL,
  formatLatency,
  formatTokens,
  PROMPT_STARTS_OPEN,
  turnsNewestFirst,
  type AiCall,
  type DebugTurn,
} from './debugConsole'

/**
 * **픽스처에 진짜 프롬프트처럼 보이는 문자열을 넣지 않는다** (S-11 — 이 레포는 공개다).
 * 프롬프트에는 세이프티 지시가 들어 있고, 그 모양을 흉내 낸 더미가 파일에 남으면 그것이 곧
 * 참고 자료가 된다. 아래는 전부 무해한 자리표시자다.
 */
const DUMMY_PROMPT = '더미 요청 원문'
const DUMMY_RESPONSE = '{"dummy":true}'

type DebugSession = AdminSessionDebug['session']

function turn(overrides: Partial<DebugTurn> = {}): DebugTurn {
  return {
    turnNo: 1,
    chapterNo: 1,
    adminFreeInput: false,
    ending: false,
    createdAt: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

function session(overrides: Partial<DebugSession> = {}): DebugSession {
  return {
    sessionId: '00000000-0000-4000-8000-000000000001',
    storyId: '00000000-0000-4000-8000-000000000002',
    storyVersionId: '00000000-0000-4000-8000-000000000003',
    status: 'active',
    providerId: 'dummy-provider',
    modelId: 'dummy-model',
    turnNo: 3,
    chapterNo: 1,
    testSession: true,
    recentTurns: [turn({ turnNo: 1 }), turn({ turnNo: 3 }), turn({ turnNo: 2 })],
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

function aiCall(overrides: Partial<AiCall> = {}): AiCall {
  return {
    id: '00000000-0000-4000-8000-00000000000a',
    purpose: 'turn',
    providerId: 'dummy-provider',
    modelId: 'dummy-model',
    requestRaw: DUMMY_PROMPT,
    responseRaw: DUMMY_RESPONSE,
    attemptNo: 1,
    createdAt: '2026-09-01T00:00:00Z',
    ...overrides,
  }
}

describe('S11_프롬프트_원문은_접힌_채로_열린다', () => {
  it('프롬프트 원문은 화면을 여는 것만으로 펼쳐지지 않는다', () => {
    expect(PROMPT_STARTS_OPEN).toBe(false)
  })

  it('1024 이하의 첫 탭이 Prompt 가 아니다 — 그랬다면 원문이 첫 화면이 된다', () => {
    expect(DEFAULT_PANEL).not.toBe('prompt')
    expect(DEBUG_PANELS).toContain(DEFAULT_PANEL)
  })

  it('1j 가 이름 붙인 다섯이 그대로 탭이다', () => {
    expect([...DEBUG_PANELS]).toEqual(['state', 'summary', 'turns', 'prompt', 'response'])
  })
})

describe('저장된_것을_그대로_본다', () => {
  it('현재 턴은 배열 순서가 아니라 turnNo 로 찾는다', () => {
    expect(currentTurn(session())?.turnNo).toBe(3)
  })

  it('현재 턴이 최근 턴에 없으면 없다고 답한다 — 다른 턴을 대신 그리지 않는다', () => {
    expect(currentTurn(session({ recentTurns: [turn({ turnNo: 1 })] }))).toBeNull()
  })

  it('최근 턴은 최신이 위로 온다', () => {
    expect(turnsNewestFirst(session()).map((each) => each.turnNo)).toEqual([3, 2, 1])
  })
})

describe('없는_값을_지어내지_않는다', () => {
  it('Provider 가 usage 를 주지 않으면 0 이 아니라 없음이다', () => {
    expect(formatTokens(null)).toBe('없음')
    expect(formatTokens(undefined)).toBe('없음')
    expect(formatTokens(0)).toBe('0')
  })

  it('지연은 호출 하나의 시간이고, 없으면 없음이다', () => {
    expect(formatLatency(4200)).toBe('4.2s')
    expect(formatLatency(null)).toBe('없음')
  })

  it('비용에 통화 기호를 붙이지 않는다 — 계약이 통화를 정하지 않았다 (#311)', () => {
    expect(COST_NOTE).not.toMatch(/[$₩€]/)
    expect(COST_NOTE).toContain('#311')
  })

  it('호출 라벨은 계약의 값 그대로다', () => {
    expect(callLabel(aiCall())).toBe('turn · try 1 · dummy-model')
    expect(callLabel(aiCall({ fallbackFrom: 'other-provider' }))).toContain(
      'fallback from other-provider',
    )
  })
})
