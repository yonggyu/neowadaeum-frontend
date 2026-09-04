import { describe, expect, it } from 'vitest'

import { encodeQrSymbol, QUIET_ZONE, qrPathData, type QrSymbol } from './qrCode'

/**
 * **명백한 가짜다.** `AAAABBBBCCCCDDDD` 는 Base32 알파벳이기만 할 뿐 어떤 계정에도 붙지
 * 않는다. 실제 등록 응답의 값을 테스트에 적으면 그 시크릿이 레포에 영구히 남는다 (S-11).
 */
const FAKE_OTPAUTH_URI =
  'otpauth://totp/neowadaeum:admin@example.test?secret=AAAABBBBCCCCDDDD&issuer=neowadaeum'

function dark(symbol: QrSymbol, x: number, y: number): boolean {
  return symbol.modules[y]?.[x] === true
}

/** 이 파일이 만든 격자를 규격(ISO/IEC 18004)이 정한 자리들과 대조한다. */
describe('encodeQrSymbol — 알려진 입력이 규격이 정한 격자를 만든다', () => {
  const symbol = encodeQrSymbol(FAKE_OTPAUTH_URI)

  it('한_변이_4×version+17_에_사방_여백을_더한_크기다', () => {
    expect(symbol).not.toBeNull()
    const size = symbol?.size ?? 0
    const modules = size - QUIET_ZONE * 2

    // version 1 = 21, 이후 4씩 커진다. 그 격자에서 벗어나면 심볼이 아니다.
    expect(modules).toBeGreaterThanOrEqual(21)
    expect((modules - 21) % 4).toBe(0)
    expect(symbol?.modules.length).toBe(size)
    expect(symbol?.modules.every((row) => row.length === size)).toBe(true)
  })

  it('사방_여백이_비어_있다 — 4 모듈보다 좁으면 리더가 심볼의 경계를 찾지 못한다', () => {
    const size = symbol?.size ?? 0
    for (let i = 0; i < size; i += 1) {
      for (let q = 0; q < QUIET_ZONE; q += 1) {
        expect(dark(symbol as QrSymbol, i, q)).toBe(false)
        expect(dark(symbol as QrSymbol, i, size - 1 - q)).toBe(false)
        expect(dark(symbol as QrSymbol, q, i)).toBe(false)
        expect(dark(symbol as QrSymbol, size - 1 - q, i)).toBe(false)
      }
    }
  })

  it('세_모서리에_7×7_위치_검출_패턴이_있다', () => {
    const size = symbol?.size ?? 0
    const corners = [
      { x: QUIET_ZONE, y: QUIET_ZONE },
      { x: size - QUIET_ZONE - 7, y: QUIET_ZONE },
      { x: QUIET_ZONE, y: size - QUIET_ZONE - 7 },
    ]

    for (const corner of corners) {
      for (let dy = 0; dy < 7; dy += 1) {
        for (let dx = 0; dx < 7; dx += 1) {
          // 바깥 테두리는 어둡고, 그 안 한 겹은 밝고, 가운데 3×3 이 다시 어둡다.
          const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3))
          const expected = ring !== 2
          expect(dark(symbol as QrSymbol, corner.x + dx, corner.y + dy)).toBe(expected)
        }
      }
    }
  })

  it('타이밍_패턴이_한_칸씩_번갈아_간다', () => {
    const size = symbol?.size ?? 0
    for (let x = QUIET_ZONE + 8; x < size - QUIET_ZONE - 8; x += 1) {
      const expected = (x - QUIET_ZONE) % 2 === 0
      expect(dark(symbol as QrSymbol, x, QUIET_ZONE + 6)).toBe(expected)
      expect(dark(symbol as QrSymbol, QUIET_ZONE + 6, x)).toBe(expected)
    }
  })

  it('같은_입력은_같은_격자를_만든다 — 화면이 다시 그려도 QR 이 흔들리지 않는다', () => {
    expect(encodeQrSymbol(FAKE_OTPAUTH_URI)).toEqual(encodeQrSymbol(FAKE_OTPAUTH_URI))
  })

  it('다른_입력은_다른_격자를_만든다 — 담긴 것이 실제로 그 문자열이다', () => {
    const other = encodeQrSymbol(`${FAKE_OTPAUTH_URI}&digits=6`)

    expect(other).not.toEqual(symbol)
  })
})

describe('encodeQrSymbol — 그릴 수 없으면 null 이다', () => {
  it('빈_문자열은_그리지_않는다', () => {
    expect(encodeQrSymbol('')).toBeNull()
  })

  it('담을_수_없이_긴_값은_예외로_끊지_않고_null_이다', () => {
    // 40 버전이 담는 한계를 넘긴다. 화면은 QR 칸을 비우고 아래의 값만 남긴다.
    expect(encodeQrSymbol('x'.repeat(3000))).toBeNull()
  })
})

describe('qrPathData — 어두운 모듈만, 가로로 이어 붙여 그린다', () => {
  it('한_줄의_이어진_모듈이_한_조각이_된다', () => {
    const symbol: QrSymbol = {
      size: 3,
      modules: [
        [true, true, false],
        [false, false, false],
        [true, false, true],
      ],
    }

    expect(qrPathData(symbol)).toBe('M0 0h2v1h-2zM0 2h1v1h-1zM2 2h1v1h-1z')
  })

  it('어두운_모듈이_없으면_빈_문자열이다', () => {
    const symbol: QrSymbol = { size: 2, modules: [[false, false], [false, false]] }

    expect(qrPathData(symbol)).toBe('')
  })

  it('조각들의_길이_합이_어두운_모듈의_수와_같다 — 빠뜨리지도 덧그리지도 않는다', () => {
    const symbol = encodeQrSymbol(FAKE_OTPAUTH_URI)
    const darkCount = (symbol?.modules ?? []).reduce(
      (sum, row) => sum + row.filter((module) => module).length,
      0,
    )
    const drawn = [...qrPathData(symbol as QrSymbol).matchAll(/h(\d+)v1/g)].reduce(
      (sum, match) => sum + Number(match[1]),
      0,
    )

    expect(darkCount).toBeGreaterThan(0)
    expect(drawn).toBe(darkCount)
  })
})
