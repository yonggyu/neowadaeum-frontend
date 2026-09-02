import { describe, expect, it } from 'vitest'

import type { ResumeResponse, SessionState } from '../../api/endpoints/resume'
import { canContinue, resumeNotice, SESSION_STATE_ORDER } from './resumeNotice'

/**
 * 목업을 세우지 않는다 — 여기서 검증하는 것은 호출이 아니라 **다섯 상태의 매핑**이다.
 * 계약 호출의 검증은 백엔드와 붙는 시점의 통합 테스트가 한다.
 */
function resumeOf(sessionState: SessionState, canViewHistory = true): ResumeResponse {
  return {
    sessionId: '11111111-1111-1111-1111-111111111111',
    storyId: '22222222-2222-2222-2222-222222222222',
    title: '봄이 오기 전에',
    chapterNo: 4,
    chapterTitle: '학생식당',
    totalChapters: 6,
    turnNo: 12,
    updatedAt: '2026-08-30T12:00:00Z',
    lastSceneVisual: null,
    lastSceneSummary: '유나와 학생식당에서 이야기하는 중이었다.',
    lastChoiceText: '무슨 일인데?',
    sessionState,
    canViewHistory,
  }
}

describe('sessionState 다섯 — 판정 순서 (백엔드 §13-26)', () => {
  it('순서는 deleted → expired → story_suspended → version_changed → valid 다', () => {
    expect(SESSION_STATE_ORDER).toEqual([
      'deleted',
      'expired',
      'story_suspended',
      'version_changed',
      'valid',
    ])
  })

  it('다섯이 전부다 — 계약의 SessionState 에 값이 늘면 여기가 먼저 실패한다', () => {
    expect(new Set(SESSION_STATE_ORDER).size).toBe(5)
    for (const state of SESSION_STATE_ORDER) {
      expect(resumeNotice(resumeOf(state)).title).not.toBe('')
    }
  })

  it('할 수 있는 일이 가장 적은 쪽부터다 — deleted 는 이어하기도 기록도 주지 않는다', () => {
    const actions = resumeNotice(resumeOf('deleted')).actions
    expect(actions).not.toContain('continue')
    expect(actions).toEqual(['restart', 'library'])
  })

  it('expired 는 이어갈 수 없고 기록만 본다', () => {
    expect(resumeNotice(resumeOf('expired')).actions).toEqual(['restart', 'history'])
  })

  it('story_suspended 는 새로 이어갈 수 없다 — 다시 시작도 주지 않는다', () => {
    const actions = resumeNotice(resumeOf('story_suspended')).actions
    expect(actions).toEqual(['history', 'library'])
    expect(actions).not.toContain('restart')
  })

  it('version_changed 는 새 버전으로 시작하거나 지난 기록을 읽는다', () => {
    expect(resumeNotice(resumeOf('version_changed')).actions).toEqual(['restart', 'history'])
  })

  it('valid 만 이어하기가 가능하다 — 완주 세션도 valid 다 (completed 는 없는 값)', () => {
    expect(resumeNotice(resumeOf('valid')).actions).toEqual(['continue', 'history'])
    for (const state of SESSION_STATE_ORDER) {
      expect(canContinue(state)).toBe(state === 'valid')
    }
  })

  it('canViewHistory 가 false 면 기록 행동을 뺀다 — 서버가 볼 것이 없다고 답했다', () => {
    expect(resumeNotice(resumeOf('valid', false)).actions).toEqual(['continue'])
    expect(resumeNotice(resumeOf('story_suspended', false)).actions).toEqual(['library'])
  })

  it('deleted 와 story_suspended 를 프론트가 합치거나 나누지 않는다 — 서버가 답한 값을 그린다', () => {
    // 사라진 작품을 서버가 이미 story_suspended 로 답한다 (§13-26). 클라이언트에는
    // "없는 작품"과 "정지된 작품"을 나눌 입력 자체가 오지 않는다.
    expect(resumeNotice(resumeOf('deleted')).title).not.toBe(
      resumeNotice(resumeOf('story_suspended')).title,
    )
  })
})
