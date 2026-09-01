/**
 * API 오리진.
 *
 * 기본값을 두지 않는다. 값이 없으면 던진다 — 백엔드의 §7.3 과 같은 규칙이며 이유도 같다:
 * 기본값이 있으면 설정을 빠뜨린 빌드가 **정상 동작하는 것처럼 보이다가** 엉뚱한 곳을 부른다.
 */
function required(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === '') {
    throw new Error(`${name} is required — set it in .env (see .env.example)`)
  }
  return value
}

/** 경로가 붙지 않은 오리진. 끝 슬래시는 지운다 — 붙으면 // 가 생긴다. */
export const API_BASE_URL = required('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL)
  .replace(/\/+$/, '')

/** 계약의 모든 경로가 이 접두어 아래 있다 (docs/openapi.yaml). */
export const API_PREFIX = '/api/v1'
