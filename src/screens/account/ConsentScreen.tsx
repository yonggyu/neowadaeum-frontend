/**
 * 최초 로그인의 추가 정보 — 생년월일 · 약관 동의 4종.
 *
 * **라우트가 아니다.** 와이어프레임 6b 가 "같은 화면 교체 — 별 라우트를 만들지 않는다"로
 * 정했다. `LoginScreen` 이 Google 로그인 결과에 따라 이 단계로 바꿔 그린다. 페이지를
 * 나누면 새로고침에 `idToken` 이 사라진다 — 토큰을 메모리에만 두기 때문이다 (F-3).
 *
 * 자리 표시자다. C 슬라이스가 채운다 — 와이어프레임 5a · 6b (닉네임 칸은 없다).
 */
export function ConsentScreen() {
  return <section data-screen="ConsentScreen" />
}
