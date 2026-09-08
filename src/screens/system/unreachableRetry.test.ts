import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const sourceOf = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')
const occurrences = (source: string, needle: string) => source.split(needle).length - 1

/*
 * #142 — **닿지 못한 실패에서 다시 부를 길**.
 *
 * `#122` 가 세운 판(`UnreachableNotice`)은 나가는 문을 그리지 않고 [다시 시도]만 그린다.
 * 그 버튼은 `onRetry` 가 있을 때만 나오므로, **주지 않는 호출자에게는 아무것도 남지 않는다.**
 *
 * 그런데 *다시 부르기*의 값이 자리마다 다르다 — 어떤 것은 조회 하나를 한 번 더 부르는 일이고,
 * 어떤 것은 **없던 것을 하나 더 만드는 일**이다. 그래서 이 파일이 못박는 것은 "모두 열었다"가
 * 아니라 **어디를 열었고 어디를 왜 열지 않았는가** 다.
 *
 * 러너에 DOM 이 없어(jsdom 미설치) 눌린 결과로는 지킬 수 없다. 그리는 **수단이 건네지는가**
 * 까지가 여기서 지킬 수 있는 선이며, `systemNotice.test.ts` 가 같은 방식으로 서 있다.
 */

describe('Resume 은 열었다 — 다시 부르는 것이 조회 하나다 (#142)', () => {
  const screen = sourceOf('../account/ResumeScreen.tsx')
  const hook = sourceOf('../../hooks/useSessionResume.ts')

  it('화면이_실패_자리에_다시_부를_길을_준다', () => {
    expect(screen).toContain('onRetry={reload}')
  })

  it('그_길을_훅이_내준다 — 화면이 스스로 fetch 를 부르지 않는다', () => {
    // 호출의 세부는 훅 안에 남는다 (CLAUDE.md 책임). 화면이 직접 부르기 시작하면 취소와
    // 로딩 상태가 두 곳으로 갈린다.
    expect(hook).toContain('reload')
    expect(screen).not.toContain('getResume')
  })

  it('첫_진입과_다시_부르기가_같은_호출이다 — 두 벌로 두지 않는다', () => {
    // 복사해 두면 한쪽에만 취소나 중복 요청 처리가 붙는 날이 온다.
    expect(occurrences(hook, 'getResume(')).toBe(1)
  })

  it('다시_부르는_것이_무엇도_만들지_않는다 — 세션을 새로 여는 경로가 아니다', () => {
    // `getResume` 은 조회다. 여기에 생성 경로가 섞이면 [다시 시도]가 만드는 버튼이 된다.
    expect(hook).not.toContain('POST')
    expect(hook).not.toContain('startSession')
  })
})

describe('작품 만들기는 열지 않았다 — 다시 부르는 것이 만드는 일이다 (#142)', () => {
  const step = sourceOf('../authoring/StepPreview.tsx')
  const hook = sourceOf('../authoring/usePreviewSession.ts')

  it('제출_실패에_다시_시도를_두지_않는다 — 위의 [제출]이 이미 그 길이다', () => {
    // 실패하면 `submitting` 이 풀려 [제출]이 다시 눌린다. 이 화면은 막다른 곳이 아니며,
    // `submitDraft` 에는 `Idempotency-Key` 가 없어(R6.2 가 턴 생성 하나에만 두었다) 다시
    // 부르는 것은 같은 작품에 버전을 하나 더 얹는 일이 될 수 있다 (R8.8 · §13-40).
    // 건네는 자리를 본다 — 이유를 적은 주석에는 그 이름이 나온다.
    expect(step).not.toContain('onRetry=')
  })

  it('미리보기를_여는_길은_start_하나다 — 그것은 재시도가 아니라 새로 만들기다', () => {
    // 미리보기는 부를 때마다 새 작품을 발행하고 일일 상한이 있다 (§13-37 · R8.12).
    // 자동으로 보이는 [다시 시도]가 그 한 번을 소모하게 두지 않는다 — 누르는 것은 작성자다.
    expect(hook).toContain('start')
    expect(hook).not.toContain('retry')
    expect(occurrences(hook, 'previewDraft(')).toBe(1)
  })

  it('열지_않은_이유가_코드_옆에_남아_있다', () => {
    // 이유 없는 부재는 다음 사람에게 그냥 빠뜨린 것으로 보인다 — 그리고 채워진다.
    expect(hook).toContain('#142')
    expect(step).toContain('#142')
  })
})
