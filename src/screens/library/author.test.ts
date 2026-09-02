import { describe, expect, it } from 'vitest'

import { authorHandle, storyByline, storyCardMeta } from './author'

/**
 * 작성자 표기의 규칙은 **계약이 정한다** (백엔드 #258).
 *
 * `authorDisplayName` 은 required 지만 nullable 이고, `authorType` 이 `official` 이거나 작성자
 * 프로필이 없으면 `null` 이다. 그래서 여기서 지키는 것은 하나다 — **없는 이름을 만들지 않는다.**
 */
describe('authorHandle — 백엔드258_이름은_있을_때만_그린다', () => {
  it('백엔드258_UGC_는_닉네임을_그대로_쓴다 (3g `@yeonwoo`)', () => {
    expect(authorHandle({ authorType: 'user', authorDisplayName: 'yeonwoo' })).toBe('@yeonwoo')
  })

  it('F6_공식_작품은_작성자가_없다 — authorDisplayName 이 null 이다', () => {
    expect(authorHandle({ authorType: 'official', authorDisplayName: null })).toBeNull()
  })

  it('백엔드258_UGC_라도_프로필이_없으면_그리지_않는다 — authorType 으로 이름을 추측하지 않는다', () => {
    expect(authorHandle({ authorType: 'user', authorDisplayName: null })).toBeNull()
  })

  it('빈 닉네임은 없는 것으로 다룬다 — `@` 하나만 남기지 않는다', () => {
    expect(authorHandle({ authorType: 'user', authorDisplayName: '   ' })).toBeNull()
  })

  it('공식 작품에 이름이 실려 와도 카드에 쓰지 않는다 — 섞이는 것은 R13.1 이 막는다', () => {
    expect(authorHandle({ authorType: 'official', authorDisplayName: 'yeonwoo' })).toBeNull()
  })
})

describe('storyCardMeta — 카드 한 줄 (3g · 4d)', () => {
  it('백엔드258_커뮤니티_카드는_작성자와_장르를_함께_적는다', () => {
    expect(
      storyCardMeta({ authorType: 'user', authorDisplayName: 'yeonwoo', genres: ['판타지'] }),
    ).toBe('@yeonwoo · 판타지')
  })

  it('공식 카드는 장르만이다 — 자리 채우기를 두지 않는다', () => {
    expect(
      storyCardMeta({ authorType: 'official', authorDisplayName: null, genres: ['로맨스', '청춘'] }),
    ).toBe('로맨스 · 청춘')
  })

  it('이름도 장르도 없으면 빈 문자열이고 화면이 줄 자체를 숨긴다', () => {
    expect(storyCardMeta({ authorType: 'user', authorDisplayName: null, genres: [] })).toBe('')
  })
})

describe('storyByline — 상세의 작성자 줄 (4d)', () => {
  it('백엔드258_상세는_닉네임과_종류를_함께_적는다', () => {
    expect(storyByline({ authorType: 'user', authorDisplayName: 'yeonwoo' })).toBe(
      '@yeonwoo · 사용자 작품',
    )
  })

  it('닉네임이 없는 UGC 는 종류만 남는다 — 종류는 계약이 준 사실이다', () => {
    expect(storyByline({ authorType: 'user', authorDisplayName: null })).toBe('사용자 작품')
  })

  it('공식 작품은 줄이 없다', () => {
    expect(storyByline({ authorType: 'official', authorDisplayName: null })).toBe('')
  })
})
