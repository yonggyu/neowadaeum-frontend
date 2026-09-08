/**
 * `otpauthUri` 를 **이 오리진 안에서** QR 격자로 바꾼다.
 *
 * **외부 QR 이미지 서비스는 후보가 아니다.** `https://…/qr?data=<otpauthUri>` 는 편하지만,
 * 그 URL 을 만드는 순간 **공유 시크릿이 제3자 서버의 접근 로그에 남는다** — 2FA 가 지키려던
 * 것이 QR 을 그리는 대가로 사라진다. 그래서 인코딩을 브라우저 안에서 하고, 결과를 SVG 로
 * 직접 그린다. 값이 나가는 네트워크 호출은 이 파일에 하나도 없다.
 *
 * **`uqr` 의 `renderSVG` 를 쓰지 않는다.** 그것은 SVG 문자열을 돌려주므로 화면이
 * `dangerouslySetInnerHTML` 로 심어야 하는데, 시크릿을 담은 문자열을 innerHTML 로 넣는 것은
 * 이 화면에서 만들고 싶지 않은 습관이다. `encode` 가 주는 **격자**만 받아 `<path>` 하나로
 * 그린다 — 그리는 쪽을 우리가 들고 있으면 무엇이 DOM 에 들어가는지가 눈에 보인다.
 *
 * 두 함수 모두 순수하다. DOM 없이 판정할 수 있어야 이 파일이 테스트로 검증된다 —
 * 검증할 수 없는 QR 은 그리지 않는 것만 못하다.
 */

import { encode } from 'uqr'

/**
 * 규격이 요구하는 여백. ISO/IEC 18004 는 심볼 사방에 **4 모듈**의 밝은 띠를 요구한다.
 * 좁히면 배경과 심볼의 경계를 리더가 찾지 못한다.
 */
export const QUIET_ZONE = 4

/**
 * 오류 정정 수준. 인증기 앱들이 만드는 QR 과 같은 `M`(15% 복원)이다.
 * 높이면 심볼이 커지고 176px 칸 안에서 모듈이 더 작아진다.
 */
const ERROR_CORRECTION = 'M'

/** 어두운 모듈의 격자. 사방의 여백을 **포함한** 크기다. */
export interface QrSymbol {
  /** 한 변의 모듈 수. 그대로 SVG `viewBox` 의 한 변이 된다 */
  size: number
  /** `[y][x]`, `true` 가 어두운 모듈 */
  modules: readonly (readonly boolean[])[]
}

/**
 * 격자를 만든다. 만들 수 없으면 `null` 이다.
 *
 * **실패를 삼키되 로그로 흘리지 않는다.** 오류 객체에 입력이 실려 있을 수 있고, 그 입력이
 * 곧 시크릿이다 (보안 hard-stop). 화면은 `null` 을 받으면 QR 칸을 비우고 아래의 값만
 * 남긴다 — 8차가 그 경우를 그림으로 정해 두었다.
 */
export function encodeQrSymbol(text: string): QrSymbol | null {
  if (text === '') {
    return null
  }
  try {
    const result = encode(text, { ecc: ERROR_CORRECTION, border: QUIET_ZONE })
    return { size: result.size, modules: result.data }
  } catch {
    // 오류를 그대로 두고 넘어간다. `console` 로 보내면 시크릿이 콘솔에 남는다.
    return null
  }
}

/**
 * 격자를 `<path d>` 하나로 바꾼다.
 *
 * 모듈마다 `<rect>` 를 두면 노드가 수천 개가 된다. 가로로 이어진 어두운 모듈을 한 번에
 * 묶어 `M x y h n v1 h-n z` 로 적으면 노드가 하나이고, 채우기 규칙에 의존하지 않으므로
 * 리더가 읽는 흑백 대비가 브라우저마다 달라지지 않는다.
 */
export function qrPathData(symbol: QrSymbol): string {
  const parts: string[] = []
  for (let y = 0; y < symbol.size; y += 1) {
    const row = symbol.modules[y]
    if (row === undefined) {
      continue
    }
    let x = 0
    while (x < symbol.size) {
      if (row[x] !== true) {
        x += 1
        continue
      }
      let run = 1
      while (row[x + run] === true) {
        run += 1
      }
      parts.push(`M${x} ${y}h${run}v1h-${run}z`)
      x += run
    }
  }
  return parts.join('')
}
