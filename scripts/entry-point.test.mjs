import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { isEntryPoint } from './entry-point.mjs'

const SCRIPTS = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url))
const NODE_BIN = join(REPO_ROOT, 'node_modules', '.bin')

/** 링크가 낀 트리에 복사해 둘 파일. `entry-point.mjs` 는 두 스크립트가 import 한다. */
const COPIED = ['entry-point.mjs', 'api-types.mjs', 'require-generated-types.mjs']

/** 스펙의 내용은 이 검사와 무관하다 — 생성기가 읽을 수 있는 최소 형태면 된다. */
const MINIMAL_CONTRACT = ['openapi: 3.0.3', 'info:', '  title: t', "  version: '1'", 'paths: {}', '']

/**
 * 링크를 만들지 못하면 **건너뛰지 않고 실패시킨다.**
 *
 * `it.skipIf` 로 빠지는 쪽이 흔한 처리지만, 그렇게 두면 이 파일은 링크를 만들 수 없는 자리
 * — 권한이 없는 Windows, 링크를 지원하지 않는 파일시스템 — 에서 **초록인 채로 아무것도
 * 검사하지 않는다.** 그것은 `#148` 이 없애려는 실패와 **정확히 같은 모양**이다: 도는 척하며
 * 아무 일도 하지 않고 `exit 0`. 검사가 빠졌다는 사실은 검사가 실패했다는 사실보다 알아채기
 * 어려우므로, 여기서는 시끄러운 쪽을 고른다.
 *
 * 이 레포가 실제로 도는 자리는 macOS(개발)와 ubuntu-latest(CI) 둘뿐이고 양쪽 다 링크를
 * 만든다. 그래서 이 실패는 *환경이 예상 밖으로 바뀌었다* 는 신호이며, 그때 알아야 한다.
 */
function symlinkOrFail(target, path) {
  try {
    symlinkSync(target, path, 'dir')
  } catch (error) {
    throw new Error(
      '심볼릭 링크를 만들지 못해 진입점 판정을 검사할 수 없었다 (#148).\n' +
        '  **건너뛰지 않고 실패시킨다** — 조용히 빠지는 검사가 이 이슈가 없애려는 실패와 같은 모양이다.\n' +
        `  원인: ${error.message}`,
    )
  }
}

/**
 * 스크립트를 **레포 밖의 임시 트리**에 복사하고, 그 트리를 가리키는 **심볼릭 링크**를 하나
 * 만든다. 검사는 링크 쪽 경로로 스크립트를 부른다.
 *
 * `mkdtempSync(tmpdir())` 자체가 이미 링크인 자리가 있지만(macOS 의 `/var` → `/private/var`)
 * 거기 기대지 않는다 — Linux CI 에서는 링크가 아니어서 같은 검사가 **다른 것을 보게** 된다.
 * 실제 경로로 편 뒤 링크를 직접 세우고, 링크가 정말 굽었는지까지 확인한다.
 */
function makeLinkedTree() {
  const real = realpathSync(mkdtempSync(join(tmpdir(), 'nwd-148-')))
  mkdirSync(join(real, 'scripts'), { recursive: true })
  for (const name of COPIED) copyFileSync(join(SCRIPTS, name), join(real, 'scripts', name))

  const link = join(dirname(real), `${basename(real)}-link`)
  symlinkOrFail(real, link)

  // 링크가 실제로 경로를 굽히지 않으면 이 파일의 모든 검사가 뜻을 잃는다.
  if (link === real || realpathSync(link) !== real) {
    throw new Error(`링크가 경로를 굽히지 않았다 — 이 검사는 성립하지 않는다 (${link})`)
  }

  return { real, link }
}

/** 링크 경유 경로로 스크립트를 실행한다. `node_modules/.bin` 은 `npm run` 이 하듯 붙여 준다. */
function runThroughLink(link, script, { env = {}, cwd = link } = {}) {
  return spawnSync(process.execPath, [join(link, 'scripts', script)], {
    cwd,
    encoding: 'utf8',
    env: { ...withoutContractSource(process.env), ...env, PATH: `${NODE_BIN}:${process.env.PATH}` },
  })
}

function withoutContractSource(env) {
  const copy = { ...env }
  delete copy.OPENAPI_SOURCE
  return copy
}

describe('진입점 판정 (#148)', () => {
  let tree

  beforeEach(() => {
    tree = makeLinkedTree()
  })

  afterEach(() => {
    rmSync(tree.link, { force: true })
    rmSync(tree.real, { recursive: true, force: true })
  })

  describe('isEntryPoint', () => {
    it('링크가 낀 경로로 실행돼도 자기 자신을 알아본다 — 이것이 #148 이 놓쳤던 자리다', () => {
      const linked = join(tree.link, 'scripts', 'entry-point.mjs')
      const moduleUrl = pathToFileURL(join(tree.real, 'scripts', 'entry-point.mjs')).href

      // 링크를 펴지 않고 문자열만 비교하면 여기서 false 가 된다.
      expect(pathToFileURL(linked).href).not.toBe(moduleUrl)
      expect(isEntryPoint(moduleUrl, linked)).toBe(true)
    })

    it('링크 없는 보통 경로도 그대로 알아본다 — 고치면서 정상 경로를 잃지 않는다', () => {
      const real = join(tree.real, 'scripts', 'entry-point.mjs')
      expect(isEntryPoint(pathToFileURL(real).href, real)).toBe(true)
    })

    it('다른 파일이 진입점이면 false 다 — import 된 모듈이 제멋대로 돌지 않는다', () => {
      const moduleUrl = pathToFileURL(join(tree.real, 'scripts', 'entry-point.mjs')).href
      expect(isEntryPoint(moduleUrl, join(tree.link, 'scripts', 'api-types.mjs'))).toBe(false)
    })

    it('진입점이 없으면(REPL · import 만) false 다', () => {
      expect(isEntryPoint(import.meta.url, undefined)).toBe(false)
    })

    it('없는 경로가 들어와도 던지지 않고 false 다 — 판정이 스크립트를 깨뜨리지 않는다', () => {
      expect(isEntryPoint(import.meta.url, join(tree.real, 'scripts', 'nowhere.mjs'))).toBe(false)
    })
  })

  /**
   * 함수만이 아니라 **스크립트가 링크 경유로 실제로 일을 하는가**를 본다.
   *
   * `exit 0` 만 보면 이 버그를 그대로 통과시킨다 — 고장 난 판정의 증상이 바로 조용한
   * `exit 0` 이기 때문이다. 그래서 두 방향을 다 본다: 설정이 없으면 **시끄럽게 실패하고**,
   * 설정이 있으면 **파일이 실제로 생긴다.**
   */
  describe('api-types.mjs 를 링크 경유로 실행한다', () => {
    it('설정이 없으면 0 이 아닌 코드로 끝난다 — 조용한 exit 0 이 아니다 (#40 회귀)', () => {
      const result = runThroughLink(tree.link, 'api-types.mjs')

      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('OPENAPI_SOURCE')
    })

    it('설정이 있으면 타입을 정말로 만든다 — 도는 척하지 않는다', () => {
      if (!existsSync(join(NODE_BIN, 'openapi-typescript'))) {
        throw new Error(
          'openapi-typescript 가 node_modules/.bin 에 없어 생성을 확인할 수 없었다 (#148).\n' +
            '  건너뛰지 않고 실패시킨다 — 이 검사가 빠지면 조용한 성공을 다시 놓친다.\n' +
            '  `npm ci` 로 의존성을 설치한 뒤 다시 돌린다.',
        )
      }

      const contract = join(tree.real, 'contract.yaml')
      writeFileSync(contract, MINIMAL_CONTRACT.join('\n'))

      const result = runThroughLink(tree.link, 'api-types.mjs', {
        env: { OPENAPI_SOURCE: contract },
      })

      expect(result.status).toBe(0)
      expect(existsSync(join(tree.real, 'src', 'api', 'schema.d.ts'))).toBe(true)
    })
  })

  it('require-generated-types.mjs 도 링크 경유로 실제로 검사한다 (#143 이 세운 가드)', () => {
    const result = runThroughLink(tree.link, 'require-generated-types.mjs')

    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('schema.d.ts')
  })
})
