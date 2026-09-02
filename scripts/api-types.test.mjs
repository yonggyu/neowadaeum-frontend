import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { requireContractSource } from './api-types.mjs'

const SCRIPT = fileURLToPath(new URL('./api-types.mjs', import.meta.url))

describe('api:types 의 계약 경로', () => {
  it('보안_계약_경로가_없으면_실패한다 — 기본값을 두면 엉뚱한 계약으로 조용히 넘어간다', () => {
    expect(() => requireContractSource({})).toThrow(/OPENAPI_SOURCE/)
  })

  it('빈 값도 없는 것으로 본다 — 공백만 남은 설정이 통과하면 실패가 한 단계 뒤로 밀린다', () => {
    expect(() => requireContractSource({ OPENAPI_SOURCE: '   ' })).toThrow(/OPENAPI_SOURCE/)
  })

  it('실패 메시지가 무엇을 설정해야 하는지 말한다', () => {
    expect(() => requireContractSource({})).toThrow(/npm run api:types/)
  })

  it('값이 있으면 그대로 쓴다 — 경로를 프론트가 추측하지 않는다', () => {
    expect(requireContractSource({ OPENAPI_SOURCE: '/abs/docs/openapi.yaml' })).toBe(
      '/abs/docs/openapi.yaml',
    )
  })

  /**
   * 함수만이 아니라 **스크립트가 실제로 멈추는가**를 본다. 진입점 판정이 어긋나면 위의
   * 단위 테스트는 초록인 채로 `npm run api:types` 만 조용히 통과한다.
   */
  it('스크립트를 OPENAPI_SOURCE 없이 실행하면 0 이 아닌 코드로 끝난다', () => {
    const env = { ...process.env }
    delete env.OPENAPI_SOURCE
    const result = spawnSync(process.execPath, [SCRIPT], { env, encoding: 'utf8' })

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('OPENAPI_SOURCE')
  })
})
