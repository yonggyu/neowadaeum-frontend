import { Link } from 'react-router-dom'

import { ApiError } from '../../api/client'
import { retryAfterSeconds, THROTTLED } from '../../api/errors'
import { ROUTES } from '../../routes/routes'
import styles from './account.module.css'

/**
 * 오류 한 덩어리.
 *
 * **문구를 프론트가 짓지 않는다 (F-4).** 서버가 준 `message` 를 그대로 내고, `error` 코드는
 * *무엇을 할 수 있는가*를 정하는 데만 쓴다 — 로그인이 필요한가, 다시 시도할 수 있는가.
 * 코드마다 다른 문구를 여기 적어 두면 서버와 화면이 서로 다른 말을 하기 시작한다.
 */
export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const api = error instanceof ApiError ? error : null

  return (
    <div className={styles.status} role="alert">
      <p className={styles.body}>{messageOf(error)}</p>
      {api !== null && THROTTLED.some((code) => code === api.errorCode) ? cooldownOf(api) : null}
      <div className={styles.actions}>
        {api?.errorCode === 'UNAUTHENTICATED' ? (
          <Link className={`${styles.button} ${styles.primary}`} to={ROUTES.login}>
            로그인
          </Link>
        ) : null}
        {onRetry !== undefined && api?.errorCode !== 'UNAUTHENTICATED' ? (
          <button type="button" className={styles.button} onClick={onRetry}>
            다시 시도
          </button>
        ) : null}
        <Link className={styles.button} to={ROUTES.library}>
          작품 둘러보기
        </Link>
      </div>
    </div>
  )
}

/**
 * 무엇을 보여 줄 것인가.
 *
 * 계약 형태의 응답이면 서버의 문구가 그대로 온다. 계약 밖(네트워크 단절 · 프록시)이면
 * `client.ts` 가 이미 안전한 폴백 문구를 붙여 두었다 — 여기서 또 짓지 않는다.
 */
function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

/**
 * 429 는 세 코드로 나뉘고 셋 다 `retryAfterSeconds` 를 준다.
 * **초를 하드코딩하지 않는다** — 서버가 준 값만 보여 준다.
 */
function cooldownOf(api: ApiError) {
  const seconds = retryAfterSeconds(api.details)
  if (seconds === null) {
    return null
  }
  return <p className={styles.meta}>{seconds}초 후에 다시 시도할 수 있어요.</p>
}
