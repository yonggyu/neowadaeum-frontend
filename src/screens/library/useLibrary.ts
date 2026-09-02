import { useCallback, useEffect, useState } from 'react'

import type { ApiError } from '../../api/client'
import {
  getLibrary,
  getLibrarySection,
  type ContinueSession,
  type Genre,
  type LibrarySection,
} from '../../api/endpoints/library'
import { appendPage, canLoadMore, genreSectionKey, orderSections } from './sections'
import { toApiError, useResource, type Resource } from './useResource'

/** 섹션 하나가 첫 응답 뒤에 겪는 일 — 다음 쪽 · 실패 · 재시도. 화면 전체가 아니라 섹션 단위다. */
export interface SectionState {
  section: LibrarySection | null
  error: ApiError | null
  pending: boolean
}

/**
 * 아직 아무 일도 일어나지 않은 섹션. `pending` 이 **거짓**인 것이 중요하다 — 이 값이 참이면
 * "가져오는 중"과 "아직 안 가져옴"이 구분되지 않고, 재시도가 두 번 나간다.
 */
const EMPTY: SectionState = { section: null, error: null, pending: false }

export interface LibraryView {
  /** 첫 응답. 실패하면 화면 전체가 실패다 — 장르 칩도 이어하기도 여기서 온다 */
  resource: Resource<{ genres: Genre[]; continueSessions: ContinueSession[] }>
  reload: () => void
  /** 지금 보여 줄 섹션들. 장르를 고르면 그 섹션 하나뿐이다 */
  visible: { key: string; state: SectionState }[]
  genreId: string | null
  selectGenre: (genreId: string | null) => void
  loadMore: (sectionKey: string) => void
  retrySection: (sectionKey: string) => void
}

/**
 * Library 화면의 데이터.
 *
 * 섹션을 **독립적으로** 다룬다 — 와이어프레임 1f 의 "Error — 섹션 단위 재시도" 가 요구하는
 * 모양이다. 한 섹션이 실패했다고 화면 전체를 오류로 덮으면 나머지가 멀쩡한데도 못 읽는다.
 */
export function useLibrary(): LibraryView {
  const [genreId, setGenreId] = useState<string | null>(null)
  const [order, setOrder] = useState<string[]>([])
  const [states, setStates] = useState<Record<string, SectionState>>({})

  const patch = useCallback((key: string, next: Partial<SectionState>) => {
    setStates((prev) => ({ ...prev, [key]: { ...(prev[key] ?? EMPTY), ...next } }))
  }, [])

  const load = useCallback(async (signal: AbortSignal) => {
    const body = await getLibrary(signal)
    const sections = orderSections(body.sections)
    setOrder(sections.map((s) => s.sectionKey))
    setStates(
      Object.fromEntries(
        sections.map((s) => [s.sectionKey, { section: s, error: null, pending: false }]),
      ),
    )
    return { genres: body.genres, continueSessions: body.continueSessions }
  }, [])

  const { resource, reload } = useResource(load)

  /**
   * 섹션 한 쪽을 가져온다. `cursor` 가 있으면 이어 붙이고, 없으면 그 섹션을 다시 세운다.
   * 커서 페이지네이션이므로 누적이며, 재시도는 첫 쪽부터다.
   */
  const fetchPage = useCallback(
    (sectionKey: string, cursor: string | null) => {
      patch(sectionKey, { pending: true, error: null })
      getLibrarySection(sectionKey, cursor).then(
        (page) => {
          setStates((prev) => {
            const current = prev[sectionKey]?.section
            const merged = cursor !== null && current ? appendPage(current, page) : page
            return { ...prev, [sectionKey]: { section: merged, error: null, pending: false } }
          })
        },
        (cause: unknown) => {
          patch(sectionKey, { pending: false, error: toApiError(cause) })
        },
      )
    },
    [patch],
  )

  // 장르를 처음 고른 순간에만 그 섹션을 가져온다. 이미 받아 둔 장르로 돌아오면 다시 부르지 않는다.
  useEffect(() => {
    if (genreId === null) return
    const key = genreSectionKey(genreId)
    setStates((prev) => (key in prev ? prev : { ...prev, [key]: EMPTY }))
  }, [genreId])

  const genreKey = genreId === null ? null : genreSectionKey(genreId)
  const genreState = genreKey === null ? undefined : states[genreKey]
  // 세 조건이 다 필요하다. `pending` 을 빼면 재시도가 오류를 지우는 순간 이 효과가 다시 돌아
  // **같은 요청이 두 번 나간다** — 화면에는 보이지 않고 서버 로그에만 남는 종류의 버그다.
  const needsGenreFetch =
    genreState !== undefined &&
    genreState.section === null &&
    genreState.error === null &&
    !genreState.pending

  useEffect(() => {
    if (genreKey !== null && needsGenreFetch) fetchPage(genreKey, null)
  }, [genreKey, needsGenreFetch, fetchPage])

  const visible =
    genreKey === null
      ? order.map((key) => ({ key, state: states[key] ?? EMPTY }))
      : [{ key: genreKey, state: states[genreKey] ?? EMPTY }]

  return {
    resource,
    reload,
    visible,
    genreId,
    selectGenre: setGenreId,
    loadMore: useCallback(
      (sectionKey: string) => {
        const current = states[sectionKey]?.section
        if (current && canLoadMore(current)) fetchPage(sectionKey, current.nextCursor ?? null)
      },
      [states, fetchPage],
    ),
    retrySection: useCallback(
      (sectionKey: string) => {
        fetchPage(sectionKey, null)
      },
      [fetchPage],
    ),
  }
}
