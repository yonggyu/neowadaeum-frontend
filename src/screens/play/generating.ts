/**
 * 턴 생성은 모델을 기다린다 — 서버 예산 25초 · 동기 28초. **로딩이 이 화면의 기본값이다.**
 */

/** 이 시간을 넘기면 문구를 바꾼다 (와이어프레임 1e · 2c). */
export const LONG_WAIT_MS = 10_000

/** 2.5초 뒤 자동 진행. 탭·클릭으로 건너뛴다 (2c). */
export const CHAPTER_INTERSTITIAL_MS = 2_500

/**
 * 기다리는 동안 보여 줄 문구.
 *
 * 스피너를 쓰지 않는다 (1e) — 25초를 도는 스피너는 멈춘 것과 구분되지 않는다. 대신 10초에
 * 문구를 바꿔 **아직 살아 있다**는 것을 말로 알린다. 남은 시간을 세어 보여 주지 않는다:
 * 모델이 언제 끝날지는 서버도 모른다.
 */
export function loadingMessage(elapsedMs: number): string {
  return elapsedMs >= LONG_WAIT_MS ? '조금만 더 기다려 주세요' : '다음 이야기를 만들어가고 있어요'
}
