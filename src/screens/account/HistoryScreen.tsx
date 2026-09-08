import { Link, useParams } from 'react-router-dom'

import { getHistory, type HistoryItem } from '../../api/endpoints/resume'
import { usePagedApi } from '../../hooks/usePagedApi'
import { resumePath } from '../../routes/routes'
import { AiNoticeFooter } from '../library/parts'
import shared from './account.module.css'
import { ErrorNotice } from './ErrorNotice'
import styles from './HistoryScreen.module.css'

/**
 * 지난 이야기 (와이어프레임 2e).
 *
 * **읽기 전용이다.** 지난 Choice 는 ✓ 로만 표시하고 다시 고를 수 없다 — `HistoryItem` 에
 * `choiceId` 가 오지 않으므로 버튼을 만들 방법 자체가 없다 (I-1). 계약이 화면의 규칙을
 * 타입으로 세운 자리다.
 */
export function HistoryScreen() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const id = sessionId ?? ''
  const page = usePagedApi<HistoryItem>(
    (cursor, signal) => getHistory(id, { cursor, signal }),
    id,
  )

  // 커서는 최신→과거 순으로 준다. 읽는 순서는 그 반대이므로 뒤집어 그린다.
  const turns = [...page.items].reverse()

  return (
    <main className={`${shared.page} ${shared.reading}`} data-screen="HistoryScreen">
      <h1 className={shared.pageTitle}>기록</h1>

      {page.status === 'loading' ? <p className={shared.status}>불러오는 중…</p> : null}
      {page.status === 'error' && page.items.length === 0 ? (
        <ErrorNotice error={page.error} onRetry={page.reload} />
      ) : null}

      {page.hasMore ? (
        <div className={styles.older}>
          <button
            type="button"
            className={shared.button}
            onClick={page.loadMore}
            disabled={page.loadingMore}
          >
            {page.loadingMore ? '불러오는 중…' : '위로 더 읽기'}
          </button>
        </div>
      ) : null}
      {/* 다음 쪽만 실패한 경우. 이미 읽은 기록은 지우지 않는다 */}
      {page.error !== null && page.items.length > 0 ? (
        <p className={shared.meta} role="alert">
          {page.error instanceof Error ? page.error.message : String(page.error)}
        </p>
      ) : null}

      {turns.map((turn, index) => (
        <Turn key={turn.turnNo} turn={turn} previous={turns[index - 1] ?? null} />
      ))}

      {page.status === 'ready' && turns.length === 0 ? (
        <p className={shared.empty}>아직 남은 기록이 없어요.</p>
      ) : null}

      <div className={shared.actions}>
        <Link className={shared.button} to={resumePath(id)}>
          이어하기로 돌아가기
        </Link>
      </div>

      {/*
       * 고지문은 **`HistoryResponse` 가 실어 온 것**이다 (백엔드 #281). Library 가 쓰는
       * `AiNoticeFooter` 를 그대로 쓴다 — 두 번째 Footer 를 만들지 않는다. `/landing` 을 따로
       * 부르면 같은 화면에서 다른 시점의 문구가 보인다 (#257 이 지운 우회).
       */}
      {page.noticeText === null ? null : <AiNoticeFooter text={page.noticeText} />}
    </main>
  )
}

/**
 * 턴 하나.
 *
 * 챕터 머리글은 **앞 턴과 챕터가 달라질 때만** 낸다 — 매 턴에 붙이면 같은 챕터가 열 번
 * 반복되고, 어디서 장이 바뀌었는지가 오히려 보이지 않는다.
 */
function Turn({ turn, previous }: { turn: HistoryItem; previous: HistoryItem | null }) {
  const startsChapter = previous === null || previous.chapterNo !== turn.chapterNo

  return (
    <>
      {startsChapter ? (
        <h2 className={styles.chapter}>
          {`CHAPTER ${String(turn.chapterNo).padStart(2, '0')}`}
          {turn.chapterTitle === null ? '' : ` · ${turn.chapterTitle}`}
        </h2>
      ) : null}
      <article className={styles.turn}>
        <p className={styles.turnNo}>{`t${turn.turnNo}`}</p>
        {turn.paragraphs.map((paragraph, index) => (
          // 문단에는 안정된 식별자가 없다. 목록이 다시 정렬되거나 끼어들지 않으므로
          // (읽기 전용 · append 만) 순서를 키로 쓰는 것이 여기서는 안전하다.
          <p key={index} className={styles.paragraph}>
            {paragraph.speakerName === null ? null : (
              <span className={styles.speaker}>{paragraph.speakerName}</span>
            )}
            {paragraph.text}
          </p>
        ))}
        {turn.isPending ? (
          <p className={styles.pending}>선택 대기 중</p>
        ) : turn.chosenChoiceText === null ? null : (
          <p className={styles.chosen}>
            <span aria-hidden="true">✓</span>
            <span>{turn.chosenChoiceText}</span>
          </p>
        )}
      </article>
    </>
  )
}
