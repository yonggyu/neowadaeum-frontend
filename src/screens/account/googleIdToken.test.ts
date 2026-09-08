import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../api/client'
import { RUNTIME_CONFIG_GLOBAL } from '../../runtimeConfig'

/**
 * Google Identity Services 로 ID 토큰을 받는 자리 (#83, #185).
 *
 * **이 파일이 지키는 것** — 설정이 없으면 실패한다 · 토큰이 어떤 저장소에도 남지 않는다(F-3) ·
 * 콘솔에 남지 않는다(보안 hard-stop) · **서버가 발급한 nonce 를 가공 없이 싣는다**(§13-87) ·
 * **끝나는 길이 반드시 있다.** 마지막 하나가 이 파일의 이유다: 프론트에서 가장 위험한 실패는
 * 돌아가는 것처럼 보이는 것이고, One Tap 이 뜨지 않으면 로그인 버튼이 "확인 중…" 인 채로
 * 영원히 남는다.
 *
 * **이 파일이 지키지 못하는 것** — 진짜 Google 서버는 부르지 않는다. 실제 토큰이 계약의
 * `POST /auth/oauth/google` 을 통과하는지는 실제 계정으로 한 번 돌려 봐야 알 수 있고,
 * 그것은 #83 의 DoD 로 남아 있다. **nonce 가 ID 토큰의 클레임으로 실제로 실리는지도 그 왕복에서만
 * 확인된다** — 여기서 확인하는 것은 *우리가 GIS 에 그 값을 그대로 넘겼는가* 까지다.
 *
 * 러너에 DOM 이 없다(jsdom 미설치). 그래서 `document` 와 GIS 전역을 직접 세워 둔다 — 이
 * 모듈이 브라우저에서 만지는 것이 그 둘뿐이라 그만큼만 있으면 흐름이 그대로 돈다.
 *
 * **발급 경로 자체는 엔드포인트 자리에서 막는다.** `/auth/nonce` 가 무엇을 실어 보내는지(본문
 * 없음 · 쿠키 없음)는 `api/endpoints/auth.test.ts` 가 지킨다. 여기서 묻는 것은 **이 모듈이 그
 * 값을 언제 · 어떻게 다루는가** 하나라, 계약 호출은 세워 두고 흐름만 본다.
 */

/**
 * **실제 클라이언트 ID 의 모양이다** (#184). 이 파일이 쓰던 `test-client-id.…` 은 접미사만
 * 맞고 앞이 Google 의 것이 아니었다 — 픽스처가 실제와 다른 모양이면 모양을 보는 검사가
 * 생기는 순간 픽스처 쪽이 먼저 깨진다. 값은 **명백히 가짜**로 둔다 (S-11).
 */
const CLIENT_ID = '000000000000-testclientidtestclientid00000000.apps.googleusercontent.com'
const ID_TOKEN = 'header.payload.signature'
/** 서버가 준 값. **다듬을 자리가 있는 모양**으로 둔다 — 가공하면 이 값과 달라진다. */
const NONCE = ' server/issued+nonce= '

const { issueLoginNonce } = vi.hoisted(() => ({
  issueLoginNonce:
    vi.fn<(signal?: AbortSignal) => Promise<{ nonce: string; expiresInSeconds: number }>>(),
}))

vi.mock('../../api/endpoints/auth', () => ({ issueLoginNonce }))

type ScriptStub = { src: string; async: boolean; onload: (() => void) | null; onerror: (() => void) | null }

type MomentStub = {
  isSkippedMoment(): boolean
  isDismissedMoment(): boolean
  getDismissedReason(): string
}

type InitializeConfig = {
  client_id: string
  nonce: string
  callback: (response: { credential?: string }) => void
  auto_select: boolean
  cancel_on_tap_outside: boolean
}

/** `document.createElement('script')` 한 줄만 있으면 되는 자리. 그만큼만 세운다. */
function stubDocument(): ScriptStub[] {
  const appended: ScriptStub[] = []
  vi.stubGlobal('document', {
    createElement: (): ScriptStub => ({ src: '', async: false, onload: null, onerror: null }),
    head: {
      appendChild: (script: ScriptStub) => {
        appended.push(script)
      },
    },
  })
  return appended
}

/** GIS 가 이미 실려 있는 상태. 라이브러리를 받는 길은 따로 시험한다. */
function stubIdentityServices() {
  const state: { config: InitializeConfig | null; moment: ((n: MomentStub) => void) | null; cancelled: number } = {
    config: null,
    moment: null,
    cancelled: 0,
  }
  vi.stubGlobal('google', {
    accounts: {
      id: {
        initialize: (config: InitializeConfig) => {
          state.config = config
        },
        prompt: (momentListener: (n: MomentStub) => void) => {
          state.moment = momentListener
        },
        cancel: () => {
          state.cancelled += 1
        },
      },
    },
  })
  return state
}

/** 토큰이 흘러갈 수 있는 두 저장소. 쓰이면 잡힌다 (F-3). */
function stubStorages() {
  const writes: string[] = []
  const storage = {
    getItem: () => null,
    setItem: (key: string, value: string) => {
      writes.push(`${key}=${value}`)
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  }
  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('sessionStorage', storage)
  return writes
}

const SKIPPED: MomentStub = {
  isSkippedMoment: () => true,
  isDismissedMoment: () => false,
  getDismissedReason: () => '',
}

function dismissedWith(reason: string): MomentStub {
  return {
    isSkippedMoment: () => false,
    isDismissedMoment: () => true,
    getDismissedReason: () => reason,
  }
}

async function loadModule() {
  // 모듈이 "받는 중인 스크립트" 를 붙잡아 두므로 테스트마다 새로 읽는다 (config.test.ts 와 같은 이유).
  vi.resetModules()
  return import('./googleIdToken')
}

/**
 * `requestGoogleIdToken` 이 GIS 를 얻고 nonce 를 받아 `prompt()` 까지 가는 데 필요한 만큼
 * 마이크로태스크를 흘린다.
 *
 * **정확한 횟수를 세지 않는다.** 세어 두면 `await` 이 하나 늘 때마다 이 파일 전체가 깨지고,
 * 그때 깨진 것은 흐름이 아니라 이 숫자다. 넉넉히 흘리는 것은 흐름을 바꾸지 않는다 —
 * 스크립트 적재처럼 우리가 손으로 밀어야 하는 단계는 그대로 멈춰 있다.
 */
async function untilPrompted(): Promise<void> {
  for (let flush = 0; flush < 20; flush += 1) {
    await Promise.resolve()
  }
}

/**
 * 진입점이 `/config.js` 로 놓는 자리를 테스트가 대신 놓는다 (#188).
 *
 * **이미 놓인 것 위에 얹는다** — `vitest.setup.ts` 의 픽스처(API 오리진)를 여기서 다시 적으면
 * 같은 가짜 값이 두 곳이 되고, 그중 하나만 고쳐도 통과한다.
 */
function stubRuntimeConfig(values: Record<string, string | undefined>): void {
  const placed = (globalThis as Record<string, unknown>)[RUNTIME_CONFIG_GLOBAL]
  vi.stubGlobal(RUNTIME_CONFIG_GLOBAL, { ...(placed as object), ...values })
}

beforeEach(() => {
  // 감시 타이머가 진짜로 흐르면 테스트가 2분을 기다린다. 시간은 우리가 넘긴다.
  vi.useFakeTimers()
  stubRuntimeConfig({ GOOGLE_OAUTH_CLIENT_ID: CLIENT_ID })
  issueLoginNonce.mockReset()
  issueLoginNonce.mockResolvedValue({ nonce: NONCE, expiresInSeconds: 120 })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('설정 — 기본값을 두지 않는다 (${VAR:기본값} 금지)', () => {
  it('클라이언트_ID_가_없으면_실패한다__빠뜨린_설정으로_로그인이_도는_것처럼_보이지_않는다', async () => {
    stubRuntimeConfig({ GOOGLE_OAUTH_CLIENT_ID: undefined })
    const appended = stubDocument()
    stubIdentityServices()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    await expect(requestGoogleIdToken(new AbortController().signal)).rejects.toThrowError(
      SIGN_IN_FAILURE.missingClientId,
    )
    // 설정이 없으면 Google 을 부르러 가지도 않는다.
    expect(appended).toHaveLength(0)
  })

  it('공백뿐이면_설정된_것이_아니다', async () => {
    stubRuntimeConfig({ GOOGLE_OAUTH_CLIENT_ID: '   ' })
    stubDocument()
    stubIdentityServices()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    await expect(requestGoogleIdToken(new AbortController().signal)).rejects.toThrowError(
      SIGN_IN_FAILURE.missingClientId,
    )
  })

  it('모양이_아니면_실패한다__잘린_값이_Google_까지_가서_남의_401_로_드러나지_않는다_184', async () => {
    // 실제로 걸린 값과 같은 모양이다 — 접미사는 맞고 **해시만 잘렸다**. 눈으로 한 판정이
    // 정확히 접미사였고, 그래서 통과했다.
    stubRuntimeConfig({
      GOOGLE_OAUTH_CLIENT_ID: '000000000000-abcdefgh.apps.googleusercontent.com',
    })
    const appended = stubDocument()
    stubIdentityServices()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    await expect(requestGoogleIdToken(new AbortController().signal)).rejects.toThrowError(
      SIGN_IN_FAILURE.malformedClientId,
    )
    // 부르기 전에 판정한다 — GIS 를 받으러 가지도 않는다.
    expect(appended).toHaveLength(0)
  })

  it('빠뜨린_것과_잘못_적은_것을_나눈다__넣은_사람이_무엇을_잘못했는지_안다_184', async () => {
    stubRuntimeConfig({ GOOGLE_OAUTH_CLIENT_ID: '내가 넣은 값' })
    stubDocument()
    stubIdentityServices()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    const failure = await requestGoogleIdToken(new AbortController().signal).catch(
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toBe(SIGN_IN_FAILURE.malformedClientId)
    expect((failure as Error).message).not.toBe(SIGN_IN_FAILURE.missingClientId)
  })

  it('실패_문구에_값을_싣지_않는다__이_레포는_값이_아니라_키만_다룬다_S11', async () => {
    const wrong = '000000000000-abcdefgh.apps.googleusercontent.com'
    stubRuntimeConfig({ GOOGLE_OAUTH_CLIENT_ID: wrong })
    stubDocument()
    stubIdentityServices()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    const failure = await requestGoogleIdToken(new AbortController().signal).catch(
      (error: unknown) => error,
    )
    expect((failure as Error).message).not.toContain(wrong)
    expect((failure as Error).message).not.toContain('abcdefgh')
    expect(SIGN_IN_FAILURE.malformedClientId).not.toContain(wrong)
  })

  it('모양을_32자로_못박지_않는다__Google_이_형식을_바꾸는_날_멀쩡한_값이_거절되지_않는다_184', async () => {
    // 하한만 둔다. 관측값(32)보다 짧지만 잘린 값(8)보다 충분히 긴 해시는 통과해야 한다 —
    // 여기서 조이면 그 실패는 *로그인 전체가 막히는 것* 이고, 이번 결함보다 나쁘다.
    stubRuntimeConfig({
      GOOGLE_OAUTH_CLIENT_ID: '1-abcdefghijklmnopqrstuvwx.apps.googleusercontent.com',
    })
    stubDocument()
    const gis = stubIdentityServices()
    const { requestGoogleIdToken } = await loadModule()

    void requestGoogleIdToken(new AbortController().signal).catch(() => {})
    await untilPrompted()

    expect(gis.config?.client_id).toBe('1-abcdefghijklmnopqrstuvwx.apps.googleusercontent.com')
  })

  it('설정한_클라이언트_ID_를_그대로_넘긴다__그리고_auto_select_를_켜지_않는다', async () => {
    stubDocument()
    const gis = stubIdentityServices()
    const { requestGoogleIdToken } = await loadModule()

    void requestGoogleIdToken(new AbortController().signal).catch(() => {})
    await untilPrompted()

    expect(gis.config?.client_id).toBe(CLIENT_ID)
    // 누른 결과로만 계정이 정해진다 — 화면을 여는 것만으로 로그인되지 않는다.
    expect(gis.config?.auto_select).toBe(false)
  })

})

/**
 * **서버가 발급한 nonce 를 싣는다** (§13-87 · #185).
 *
 * ADR-0011 은 *"계약에 없는 nonce 를 지어내 보내지 않는다"* 를 지켰고 그때 옳았다. 계약이
 * 발급 오퍼레이션을 열면서 그 문장의 전제가 바뀌었다 — 지금도 **지어내지 않으며**, 서버에서
 * 받아 그대로 싣는다.
 */
describe('로그인 nonce — 받은 값을 그대로 싣는다 (§13-87)', () => {
  it('발급받은_값을_가공하지_않고_initialize_에_싣는다__가공하면_서버가_대조하지_못한다', async () => {
    stubDocument()
    const gis = stubIdentityServices()
    const { requestGoogleIdToken } = await loadModule()

    void requestGoogleIdToken(new AbortController().signal).catch(() => {})
    await untilPrompted()

    // 다듬지도 · 다시 인코딩하지도 · 해시하지도 않는다. 이 값이 ID 토큰의 클레임이 된다.
    expect(gis.config?.nonce).toBe(NONCE)
  })

  it('로그인_한_번에_한_번만_받는다__부를_때마다_서버에_상태가_하나_생긴다_S8', async () => {
    stubDocument()
    stubIdentityServices()
    const { requestGoogleIdToken } = await loadModule()

    void requestGoogleIdToken(new AbortController().signal).catch(() => {})
    await untilPrompted()

    expect(issueLoginNonce).toHaveBeenCalledTimes(1)
  })

  it('발급이_실패하면_서버가_준_오류를_그대로_올린다__문구를_짓지_않는다_F4', async () => {
    stubDocument()
    stubIdentityServices()
    issueLoginNonce.mockRejectedValue(
      new ApiError(429, 'RATE_LIMITED', '잠시 후 다시 시도해 주세요.', {}),
    )
    const { requestGoogleIdToken } = await loadModule()

    const failure = await requestGoogleIdToken(new AbortController().signal).catch(
      (thrown: unknown) => thrown,
    )

    // `ApiError` 그대로다 — 이 모듈의 실패로 감싸면 서버의 `message` 와 `errorCode` 가 사라진다.
    expect(failure).toBeInstanceOf(ApiError)
    expect((failure as ApiError).message).toBe('잠시 후 다시 시도해 주세요.')
  })

  it('발급이_실패하면_창을_띄우지_않는다__통과할_수_없는_토큰을_받아_오지_않는다', async () => {
    stubDocument()
    const gis = stubIdentityServices()
    issueLoginNonce.mockRejectedValue(
      new ApiError(429, 'RATE_LIMITED', '잠시 후 다시 시도해 주세요.', {}),
    )
    const { requestGoogleIdToken } = await loadModule()

    await requestGoogleIdToken(new AbortController().signal).catch(() => {})

    expect(gis.config).toBeNull()
  })

  it('실패해도_스스로_다시_받지_않는다__다시_부르는_것이_새로_만드는_일이다_142', async () => {
    stubDocument()
    stubIdentityServices()
    issueLoginNonce.mockRejectedValue(
      new ApiError(429, 'RATE_LIMITED', '잠시 후 다시 시도해 주세요.', {}),
    )
    const { requestGoogleIdToken } = await loadModule()

    await requestGoogleIdToken(new AbortController().signal).catch(() => {})

    // 회복은 사용자가 로그인을 다시 누르는 것이다. 코드가 몰래 IP 한도를 한 번 더 태우지 않는다.
    expect(issueLoginNonce).toHaveBeenCalledTimes(1)
  })

  it('F3_nonce_를_어떤_저장소에도_두지_않는다__로그인_한_번_안에서만_산다', async () => {
    stubDocument()
    const writes = stubStorages()
    const gis = stubIdentityServices()
    const { requestGoogleIdToken } = await loadModule()

    const pending = requestGoogleIdToken(new AbortController().signal)
    await untilPrompted()
    gis.config?.callback({ credential: ID_TOKEN })
    await expect(pending).resolves.toBe(ID_TOKEN)

    expect(writes).toEqual([])
  })
})

describe('토큰이 흐르는 길 (F-3 · 보안 hard-stop)', () => {
  it('받은_토큰을_그대로_돌려준다__해석하지_않는다', async () => {
    stubDocument()
    const gis = stubIdentityServices()
    const { requestGoogleIdToken } = await loadModule()

    const pending = requestGoogleIdToken(new AbortController().signal)
    await untilPrompted()
    gis.config?.callback({ credential: ID_TOKEN })

    await expect(pending).resolves.toBe(ID_TOKEN)
  })

  it('F3_토큰을_어떤_저장소에도_두지_않는다__반환값으로만_흐른다', async () => {
    stubDocument()
    const writes = stubStorages()
    const gis = stubIdentityServices()
    const { requestGoogleIdToken } = await loadModule()

    const pending = requestGoogleIdToken(new AbortController().signal)
    await untilPrompted()
    gis.config?.callback({ credential: ID_TOKEN })
    await expect(pending).resolves.toBe(ID_TOKEN)

    expect(writes).toEqual([])
    // 쿠키도 아니다 — 이 모듈은 `document.cookie` 를 만지지 않는다.
    expect((globalThis as { document?: { cookie?: unknown } }).document?.cookie).toBeUndefined()
  })

  it('토큰을_콘솔에_남기지_않는다__성공한_경로에서도_남기지_않는다', async () => {
    stubDocument()
    const gis = stubIdentityServices()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { requestGoogleIdToken } = await loadModule()

    const pending = requestGoogleIdToken(new AbortController().signal)
    await untilPrompted()
    gis.config?.callback({ credential: ID_TOKEN })
    await expect(pending).resolves.toBe(ID_TOKEN)

    expect(log).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('토큰_없이_콜백이_오면_실패한다__계약이_요구하는_값이_없으므로_보낼_것이_없다', async () => {
    stubDocument()
    const gis = stubIdentityServices()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    const pending = requestGoogleIdToken(new AbortController().signal)
    await untilPrompted()
    gis.config?.callback({})

    await expect(pending).rejects.toThrowError(SIGN_IN_FAILURE.noCredential)
  })
})

describe('끝나는 길 — 조용히 무한 대기하지 않는다', () => {
  it('창이_뜨지_않으면_명시적으로_실패한다__FedCM_은_이유를_알려_주지_않는다', async () => {
    stubDocument()
    const gis = stubIdentityServices()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    const pending = requestGoogleIdToken(new AbortController().signal)
    await untilPrompted()
    gis.moment?.(SKIPPED)

    await expect(pending).rejects.toThrowError(SIGN_IN_FAILURE.notShown)
    // 실패한 채로 창을 남기지 않는다.
    expect(gis.cancelled).toBe(1)
  })

  it('사용자가_창을_닫으면_실패한다', async () => {
    stubDocument()
    const gis = stubIdentityServices()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    const pending = requestGoogleIdToken(new AbortController().signal)
    await untilPrompted()
    gis.moment?.(dismissedWith('cancel_called'))

    await expect(pending).rejects.toThrowError(SIGN_IN_FAILURE.dismissed)
  })

  it('성공_뒤에_오는_dismissed_는_실패가_아니다__credential_returned_는_토큰을_받았다는_뜻이다', async () => {
    stubDocument()
    const gis = stubIdentityServices()
    const { requestGoogleIdToken } = await loadModule()

    const pending = requestGoogleIdToken(new AbortController().signal)
    await untilPrompted()
    gis.config?.callback({ credential: ID_TOKEN })
    gis.moment?.(dismissedWith('credential_returned'))

    await expect(pending).resolves.toBe(ID_TOKEN)
  })

  it('아무_소식도_오지_않으면_감시_타이머가_끊는다__확인_중인_채로_남지_않는다', async () => {
    stubDocument()
    stubIdentityServices()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    const pending = requestGoogleIdToken(new AbortController().signal)
    await untilPrompted()
    // 시간을 넘기기 전에 받는 쪽을 붙인다 — 붙이기 전에 깨지면 처리되지 않은 거부가 된다.
    const settled = expect(pending).rejects.toThrowError(SIGN_IN_FAILURE.timedOut)

    // GIS 가 콜백도 moment 알림도 주지 않는 상태. 상한을 넘기면 실패로 끝난다.
    // (정확한 상한값을 여기서 못박지 않는다 — 못박으면 값을 조정할 때마다 이 테스트가 깨진다.)
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)

    await settled
  })

  it('화면을_떠나면_One_Tap_을_걷고_실패한다', async () => {
    stubDocument()
    const gis = stubIdentityServices()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    const controller = new AbortController()
    const pending = requestGoogleIdToken(controller.signal)
    await untilPrompted()
    controller.abort()

    await expect(pending).rejects.toThrowError(SIGN_IN_FAILURE.aborted)
    expect(gis.cancelled).toBe(1)
  })

  it('이미_끊긴_signal_이면_창을_띄우지_않는다', async () => {
    stubDocument()
    const gis = stubIdentityServices()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    const controller = new AbortController()
    controller.abort()

    await expect(requestGoogleIdToken(controller.signal)).rejects.toThrowError(SIGN_IN_FAILURE.aborted)
    expect(gis.config).toBeNull()
    // 쓰이지 않을 nonce 를 만들지 않는다 — 부르는 것만으로 서버에 상태가 하나 생긴다 (S-8).
    expect(issueLoginNonce).not.toHaveBeenCalled()
  })

  it('nonce_를_받는_중에_떠나면_이_모듈의_말로_실패한다__브라우저의_영어_문장을_화면에_두지_않는다', async () => {
    stubDocument()
    stubIdentityServices()
    const controller = new AbortController()
    // 취소된 요청은 `ApiError` 가 아니라 브라우저의 `AbortError` 로 거절된다 (api/client 의 약속).
    issueLoginNonce.mockRejectedValue(new DOMException('signal is aborted', 'AbortError'))
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    const pending = requestGoogleIdToken(controller.signal)
    controller.abort()

    await expect(pending).rejects.toThrowError(SIGN_IN_FAILURE.aborted)
  })
})

describe('GIS 라이브러리를 받는 길', () => {
  it('필요할_때_받는다__로그인하지_않는_사람은_받지_않는다', async () => {
    const appended = stubDocument()
    const { requestGoogleIdToken } = await loadModule()

    // 모듈을 읽는 것만으로는 아무것도 받지 않는다.
    expect(appended).toHaveLength(0)

    void requestGoogleIdToken(new AbortController().signal).catch(() => {})
    await untilPrompted()

    expect(appended).toHaveLength(1)
    expect(appended[0]?.src).toBe('https://accounts.google.com/gsi/client')
  })

  it('스크립트를_먼저_받고_nonce_를_나중에_받는다__받지_못한_왕복이_IP_한도를_태우지_않는다_S8', async () => {
    const appended = stubDocument()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    const pending = requestGoogleIdToken(new AbortController().signal)
    await untilPrompted()

    // 스크립트가 아직 오지 않은 동안에는 서버를 부르지 않았다.
    expect(issueLoginNonce).not.toHaveBeenCalled()

    appended[0]?.onerror?.()
    await expect(pending).rejects.toThrowError(SIGN_IN_FAILURE.scriptFailed)

    // 실패가 Google 쪽에서 끝났으므로 쓰이지 않을 nonce 도 남지 않는다.
    expect(issueLoginNonce).not.toHaveBeenCalled()
  })

  it('두_번_눌러도_한_번만_받는다', async () => {
    const appended = stubDocument()
    const { requestGoogleIdToken } = await loadModule()

    void requestGoogleIdToken(new AbortController().signal).catch(() => {})
    void requestGoogleIdToken(new AbortController().signal).catch(() => {})
    await untilPrompted()

    expect(appended).toHaveLength(1)
  })

  it('받지_못하면_실패한다__그리고_다시_시도할_수_있다__한_번의_네트워크_실패를_캐시하지_않는다', async () => {
    const appended = stubDocument()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    const first = requestGoogleIdToken(new AbortController().signal)
    await untilPrompted()
    appended[0]?.onerror?.()
    await expect(first).rejects.toThrowError(SIGN_IN_FAILURE.scriptFailed)

    const second = requestGoogleIdToken(new AbortController().signal)
    await untilPrompted()
    expect(appended).toHaveLength(2)
    appended[1]?.onerror?.()
    await expect(second).rejects.toThrowError(SIGN_IN_FAILURE.scriptFailed)
  })

  it('실렸는데_전역이_없으면_실패한다__받은_것이_GIS_가_아니다', async () => {
    const appended = stubDocument()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    const pending = requestGoogleIdToken(new AbortController().signal)
    await untilPrompted()
    appended[0]?.onload?.()

    await expect(pending).rejects.toThrowError(SIGN_IN_FAILURE.scriptFailed)
  })

  it('브라우저가_아니면_실패한다__스크립트를_꽂을_문서가_없다', async () => {
    vi.stubGlobal('document', undefined)
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    await expect(requestGoogleIdToken(new AbortController().signal)).rejects.toThrowError(
      SIGN_IN_FAILURE.noDocument,
    )
  })
})
