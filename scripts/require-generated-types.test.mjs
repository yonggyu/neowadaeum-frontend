import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GENERATED_TYPES, assertGeneratedTypesExist } from './require-generated-types.mjs'

const SCRIPT = fileURLToPath(new URL('./require-generated-types.mjs', import.meta.url))

/**
 * 스크립트를 **레포 밖의 빈 트리**에 복사해 실행한다.
 *
 * 스크립트가 경로를 자기 위치에서 풀기 때문에(#40 — cwd 에서 풀면 실행 위치마다 다른 곳을
 * 본다) 복사본의 루트는 그 임시 디렉터리가 된다. 그래서 **생성물이 없는 새 워크트리**를
 * 이 레포의 상태를 건드리지 않고 그대로 재현할 수 있다.
 */
function makeTreeWithoutGeneratedTypes() {
  const root = mkdtempSync(join(tmpdir(), 'nwd-143-'))
  mkdirSync(join(root, 'scripts'), { recursive: true })
  copyFileSync(SCRIPT, join(root, 'scripts', 'require-generated-types.mjs'))
  return root
}

describe('생성물 가드 (#143)', () => {
  let root

  beforeEach(() => {
    root = makeTreeWithoutGeneratedTypes()
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('생성물이 없으면 실패한다 — 없다는 사실이 오류 목록에 묻히지 않는다', () => {
    expect(() => assertGeneratedTypesExist(() => false)).toThrow(/schema\.d\.ts/)
  })

  it('실패 메시지가 무엇을 하면 되는지 말한다 — api:types 와 OPENAPI_SOURCE 를 함께 적는다', () => {
    expect(() => assertGeneratedTypesExist(() => false)).toThrow(/npm run api:types/)
    expect(() => assertGeneratedTypesExist(() => false)).toThrow(/OPENAPI_SOURCE/)
  })

  it('찾는 것은 계약에서 생성되는 타입 하나다', () => {
    const asked = []
    assertGeneratedTypesExist((path) => {
      asked.push(path)
      return true
    })
    expect(asked).toEqual([GENERATED_TYPES])
  })

  it('생성물이 있으면 통과한다 — 가드가 정상 흐름을 막지 않는다', () => {
    expect(() => assertGeneratedTypesExist(() => true)).not.toThrow()
  })

  /**
   * 함수만이 아니라 **스크립트가 실제로 멈추는가**를 본다. 경고만 내고 통과시키면 `#113` 이
   * 걷어 낸 것과 같은 실패가 된다 — 초록으로 보이는데 검사는 돌지 않았다.
   */
  it('생성물이 없는 트리에서 스크립트는 0 이 아닌 코드로 끝난다 (#113 — 경고가 아니라 실패다)', () => {
    const result = spawnSync(
      process.execPath,
      [join(root, 'scripts', 'require-generated-types.mjs')],
      { cwd: root, encoding: 'utf8' },
    )

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain(GENERATED_TYPES)
    expect(result.stderr).toContain('npm run api:types')
  })

  it('생성물이 있는 트리에서 스크립트는 조용히 통과한다', () => {
    const generated = join(root, GENERATED_TYPES)
    mkdirSync(dirname(generated), { recursive: true })
    writeFileSync(generated, 'export {}\n')

    const result = spawnSync(
      process.execPath,
      [join(root, 'scripts', 'require-generated-types.mjs')],
      { cwd: root, encoding: 'utf8' },
    )

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
  })
})
