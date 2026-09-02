import type { ResumeResponse, SessionState } from '../../api/endpoints/resume'

/**
 * `sessionState` 다섯을 화면 하나로 옮기는 순수 함수.
 *
 * **판정은 서버가 한다.** 여러 조건이 동시에 참일 때 무엇을 돌려줄지는 백엔드의 고정 순서가
 * 정하며(§13-26), 프론트가 다시 계산하면 두 곳에 서로 다른 진실이 생긴다. 여기서 하는 일은
 * 받은 값 하나를 **무엇을 보여 주고 무엇을 할 수 있는가**로 바꾸는 것뿐이다.
 */

/**
 * 서버의 판정 순서. **할 수 있는 일이 가장 적은 쪽부터**다.
 *
 * 화면이 이 순서로 분기하지는 않는다 — 값이 이미 하나로 정해져 왔기 때문이다. 그럼에도
 * 여기 적어 두는 것은 테스트가 **다섯이 전부이며 순서가 이것**임을 붙잡기 위해서다.
 * 계약에 값이 하나 늘면 이 배열과 `NOTICES` 가 함께 실패한다.
 */
export const SESSION_STATE_ORDER: readonly SessionState[] = [
  'deleted',
  'expired',
  'story_suspended',
  'version_changed',
  'valid',
]

/** 요약 화면이 낼 수 있는 행동. 화면이 링크로 옮긴다. */
export type ResumeAction = 'continue' | 'restart' | 'history' | 'library'

/**
 * 제목 아래 한 줄에 무엇을 적는가.
 *
 * `progress` 는 챕터·턴(2e 의 메타 줄), `lastProgress` 는 마지막 진행 시점(4b ②) 이다.
 * 상태마다 다르므로 화면이 조건을 세우지 않게 여기서 정한다.
 */
export type ResumeMeta = 'progress' | 'lastProgress' | 'none'

export interface ResumeNotice {
  /** 와이어프레임 4b 의 제목. 서버 오류가 아니라 정상 응답이므로 문구는 디자인의 것이다. */
  readonly title: string
  readonly body: string
  readonly meta: ResumeMeta
  readonly actions: readonly ResumeAction[]
}

/**
 * 와이어프레임 4b 의 다섯 카드.
 *
 * `deleted` 와 `story_suspended` 의 문구가 다른 것은 **구분해 알리는 것이 아니다** — 사라진
 * 작품을 서버가 이미 `story_suspended` 로 답하기 때문이다 (§13-26). 클라이언트는 둘을 나누는
 * 판단을 하지 않는다.
 */
const NOTICES: Record<SessionState, ResumeNotice> = {
  deleted: {
    title: '삭제된 이야기예요.',
    body: '진행 기록이 남아 있지 않습니다.',
    meta: 'none',
    actions: ['restart', 'library'],
  },
  expired: {
    title: '오래되어 이어갈 수 없는 이야기예요.',
    body: '',
    meta: 'lastProgress',
    actions: ['restart', 'history'],
  },
  story_suspended: {
    title: '이 작품은 현재 공개가 중지되었어요.',
    body: '지금까지의 이야기는 읽을 수 있지만 새로 이어갈 수는 없습니다.',
    meta: 'none',
    actions: ['history', 'library'],
  },
  version_changed: {
    title: '작품이 수정되어 이어갈 수 없어요.',
    body: '작가가 이야기를 고쳤습니다. 지난 기록은 그대로 남아 있습니다.',
    meta: 'none',
    actions: ['restart', 'history'],
  },
  valid: {
    title: '지난 이야기',
    body: '',
    meta: 'progress',
    actions: ['continue', 'history'],
  },
}

/**
 * 이 응답으로 그릴 안내와 행동.
 *
 * `canViewHistory` 가 `false` 면 기록 행동을 뺀다 — 서버가 "볼 것이 없다"고 답했는데 버튼을
 * 남기면 누르는 순간 빈 화면이 된다. 완주한 세션도 `valid` 다 (`completed` 는 없는 값).
 */
export function resumeNotice(resume: ResumeResponse): ResumeNotice {
  const notice = NOTICES[resume.sessionState]
  if (resume.canViewHistory) {
    return notice
  }
  return { ...notice, actions: notice.actions.filter((action) => action !== 'history') }
}

/** `valid` 만 이어하기가 가능하다. 화면이 진행 요약(챕터 · 턴)을 그리는 조건이기도 하다. */
export function canContinue(state: SessionState): boolean {
  return state === 'valid'
}

/** `Chapter 4 / 전체 6장 · Turn 12` — 2e 의 메타 줄. */
export function progressLabel(resume: ResumeResponse): string {
  return `Chapter ${resume.chapterNo} / 전체 ${resume.totalChapters}장 · Turn ${resume.turnNo}`
}
