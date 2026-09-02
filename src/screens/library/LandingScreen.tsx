import { useCallback } from 'react'
import { Link } from 'react-router-dom'

import { getLanding } from '../../api/endpoints/library'
import { ROUTES } from '../../routes/routes'
import css from './discovery.module.css'
import own from './story.module.css'
import { ErrorBlock } from './parts'
import { useResource } from './useResource'

/** 경험 설명 3단 (1i). 서비스가 무엇인지에 대한 설명이며 서버 데이터가 아니다. */
const STEPS = [
  { name: '읽는다', text: '한 장면씩 읽어 나갑니다.' },
  { name: '고른다', text: '장면 끝의 선택지가 다음을 정합니다.' },
  { name: '이어진다', text: '고른 것이 쌓여 당신만의 이야기가 됩니다.' },
]

/**
 * Landing — 와이어프레임 1i.
 *
 * 인증 없이 열리는 유일한 화면이다 (`getLanding` 의 `security: []`). 그래서 여기서 실패하면
 * 되돌릴 곳이 없다 — 재시도만 준다.
 *
 * 두 CTA 는 **비로그인 체험이 없다**는 사실 위에 있다 (1i). `/library` 도 `/stories/{id}` 도
 * 401 이므로 "이야기 시작하기"는 로그인으로 보낸다. "작품 둘러보기"만 `/library` 로 두는데,
 * 토큰이 있으면 그대로 열리고 없으면 그 화면이 서버의 401 문구와 함께 로그인을 안내한다 —
 * 로그인한 사용자에게서 라이브러리로 가는 길을 뺏지 않기 위해서다.
 */
export function LandingScreen() {
  const { resource, reload } = useResource(
    useCallback((signal: AbortSignal) => getLanding(signal), []),
  )

  return (
    <main className={`${css.page} ${own.landing}`} data-screen="LandingScreen">
      <section>
        <div className={`${own.hero} ${css.skeleton}`} />
        <h1 className={css.headline}>당신의 선택이 다음 이야기를 만든다.</h1>
        <p className={own.lede}>읽고, 고르고, 이어지는 인터랙티브 스토리.</p>
        <div className={own.ctaRow}>
          <Link className={`${css.button} ${css.buttonPrimary}`} to={ROUTES.login}>
            이야기 시작하기
          </Link>
          <Link className={css.button} to={ROUTES.library}>
            작품 둘러보기
          </Link>
        </div>
      </section>

      {resource.status === 'failed' && <ErrorBlock error={resource.error} onRetry={reload} />}

      {resource.status === 'ready' && resource.data.featuredStories.length > 0 && (
        <section>
          <h2 className={css.sectionTitle}>대표 작품</h2>
          <div className={css.grid}>
            {resource.data.featuredStories.map((story) => (
              /* 랜딩의 작품은 상세로 보내지 않는다 — 상세가 401 이다. 미리보기까지가 전부다 */
              <div className={css.card} key={story.storyId}>
                <div className={css.cover}>
                  {story.coverImage !== null && (
                    <img className={css.coverImage} src={story.coverImage} alt="" />
                  )}
                </div>
                <p className={`${css.cardTitle} ${css.clamp2}`}>{story.title}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <ul className={own.steps}>
        {STEPS.map((step) => (
          <li className={own.step} key={step.name}>
            <h2 className={own.stepName}>{step.name}</h2>
            <p className={css.cardDesc}>{step.text}</p>
          </li>
        ))}
      </ul>

      {/* AI 고지. 문구는 서버가 준다 (R11.1) — 설정이 비면 `/landing` 이 500 이고, 그것이 의도다 */}
      {resource.status === 'ready' && (
        <footer className={css.footer}>{resource.data.noticeText}</footer>
      )}
    </main>
  )
}
