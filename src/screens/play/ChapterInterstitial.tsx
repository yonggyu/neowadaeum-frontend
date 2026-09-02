import { useEffect } from 'react'

import type { Turn } from '../../api/endpoints/play'
import { CHAPTER_INTERSTITIAL_MS } from './generating'
import s from './play.module.css'

/**
 * 챕터 전환 — 턴 사이에 끼어드는 별도 상태다 (2c).
 *
 * 서버가 `chapterChanged` 로 알려줄 때만 뜬다. 화면이 `chapterNo` 변화를 스스로 세지 않는다 —
 * 챕터는 **서버가 판정한다** (I-9, I-10).
 *
 * 2.5초 뒤 저절로 넘어가고, 어디를 눌러도 즉시 넘어간다. 다음 이야기가 이미 도착해 있는데
 * 사람을 붙잡아 두는 화면이라 **건너뛸 수 없으면 그냥 방해다.**
 */
export function ChapterInterstitial({ turn, onDone }: { turn: Turn; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, CHAPTER_INTERSTITIAL_MS)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <button type="button" className={s.interstitial} onClick={onDone} autoFocus>
      <span className={s.interstitialNo}>Chapter {String(turn.chapterNo).padStart(2, '0')}</span>
      {turn.chapterTitle === null ? null : (
        <span className={s.interstitialTitle}>{turn.chapterTitle}</span>
      )}
    </button>
  )
}
