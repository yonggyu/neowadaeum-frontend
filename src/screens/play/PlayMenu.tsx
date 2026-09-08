import { useRef } from 'react'
import { Link } from 'react-router-dom'

import type { Turn } from '../../api/endpoints/play'
import { useDialogChrome } from '../../hooks/useDialogChrome'
import { historyPath, storyDetailPath } from '../../routes/routes'
import sheet from '../../styles/sheet.module.css'
import s from './play.module.css'
import { savedLabel } from './saveState'

interface PlayMenuProps {
  turn: Turn
  sessionId: string
  onReport: () => void
  onLeave: () => void
  onClose: () => void
}

/**
 * Play Menu — 와이어프레임 3c.
 *
 * 다섯 줄과 AI 고지다. **갈 곳이 없는 줄은 그리지 않는다:**
 * - 기록 보기 — `canViewHistory` 가 참일 때만. 서버가 "볼 것이 없다"고 답했는데 길을 열면
 *   그 길 끝은 빈 화면이다 (EndingPanel 과 같은 판단이다)
 * - 저장 상태 — `savedAt` 이 있을 때만. 저장됐다는 말을 화면이 지어내지 않는다
 * - 작품 정보 — `turn.storyId` 다 (백엔드 #259 가 이 값을 열었다). 플레이 URL 에는 작품이 없다
 *
 * 3c 는 시트 하나만 그렸고 2f 도 768 에서 "Menu 는 오버레이 시트로" 까지만 정했다. 그 위
 * 폭의 모양은 디자인에 없으므로 **같은 화면 계열이 이미 정한 규칙을 그대로 쓴다** — 6c 의
 * 중앙 400px 이고, 그래서 껍데기가 신고 시트와 같은 파일에서 온다 (F-9).
 */
export function PlayMenu({ turn, sessionId, onReport, onLeave, onClose }: PlayMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  useDialogChrome(menuRef, onClose)

  const saved = savedLabel(turn.savedAt, Date.now())

  return (
    <div
      className={sheet.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={menuRef}
        className={sheet.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
        tabIndex={-1}
      >
        <span className={sheet.grip} aria-hidden="true" />

        {turn.canViewHistory === true ? (
          <Link className={s.menuRow} to={historyPath(sessionId)}>
            기록 보기
          </Link>
        ) : null}

        {saved === null ? null : (
          <p className={s.menuRow}>
            저장 상태<span className={s.menuValue}>{saved}</span>
          </p>
        )}

        <Link className={s.menuRow} to={storyDetailPath(turn.storyId)}>
          작품 정보
        </Link>

        {/* 신고는 이 메뉴가 세이프티 L3 로 이어지는 유일한 자리다 (계약 `createReport`) */}
        <button type="button" className={`${s.menuRow} ${s.menuDanger}`} onClick={onReport}>
          신고하기
        </button>

        {/*
         * "신고 접수됨" 배지를 여기 두지 않는다 (5d). 무엇을 이미 신고했는지 물어볼 경로가
         * 계약에 없다 — 중복은 눌러 봐야 `409` 로 안다. 조회 없이 표시하려면 화면이 기억해야
         * 하고, 그 기억은 기기를 바꾸는 순간 틀린다.
         */}
        <button type="button" className={s.menuRow} onClick={onLeave}>
          나가기
        </button>

        {/* 고지문은 이 턴의 응답에서 온다 (R11.1 · 백엔드 #281) — 하드코딩하지 않는다 */}
        <p className={s.menuNotice}>{turn.noticeText}</p>
      </div>
    </div>
  )
}
