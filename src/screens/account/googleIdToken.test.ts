import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Google Identity Services 로 ID 토큰을 받는 자리 (#83).
 *
 * **이 파일이 지키는 것** — 설정이 없으면 실패한다 · 토큰이 어떤 저장소에도 남지 않는다(F-3) ·
 * 콘솔에 남지 않는다(보안 hard-stop) · **끝나는 길이 반드시 있다.** 마지막 하나가 이 파일의
 * 이유다: 프론트에서 가장 위험한 실패는 돌아가는 것처럼 보이는 것이고, One Tap 이 뜨지 않으면
 * 로그인 버튼이 "확인 중…" 인 채로 영원히 남는다.
 *
 * **이 파일이 지키지 못하는 것** — 진짜 Google 서버는 부르지 않는다. 실제 토큰이 계약의
 * `POST /auth/oauth/google` 을 통과하는지는 실제 계정으로 한 번 돌려 봐야 알 수 있고,
 * 그것은 #83 의 DoD 로 남아 있다. 여기서 대신하는 것은 **우리 쪽 흐름**뿐이다.
 *
 * 러너에 DOM 이 없다(jsdom 미설치). 그래서 `document` 와 GIS 전역을 직접 세워 둔다 — 이
 * 모듈이 브라우저에서 만지는 것이 그 둘뿐이라 그만큼만 있으면 흐름이 그대로 돈다.
 */

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com'
const ID_TOKEN = 'header.payload.signature'

type ScriptStub = { src: string; async: boolean; onload: (() => void) | null; onerror: (() => void) | null }

type MomentStub = {
  isSkippedMoment(): boolean
  isDismissedMoment(): boolean
  getDismissedReason(): string
}

type InitializeConfig = {
  client_id: string
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

/** `await` 두 번이면 `requestGoogleIdToken` 이 GIS 를 얻고 `prompt()` 까지 간다. */
async function untilPrompted(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  // 감시 타이머가 진짜로 흐르면 테스트가 2분을 기다린다. 시간은 우리가 넘긴다.
  vi.useFakeTimers()
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', CLIENT_ID)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('설정 — 기본값을 두지 않는다 (${VAR:기본값} 금지)', () => {
  it('클라이언트_ID_가_없으면_실패한다__빠뜨린_설정으로_로그인이_도는_것처럼_보이지_않는다', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', undefined)
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
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '   ')
    stubDocument()
    stubIdentityServices()
    const { requestGoogleIdToken, SIGN_IN_FAILURE } = await loadModule()

    await expect(requestGoogleIdToken(new AbortController().signal)).rejects.toThrowError(
      SIGN_IN_FAILURE.missingClientId,
    )
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

  it('계약에_없는_nonce_를_지어내_보내지_않는다', async () => {
    // `OAuthLoginRequest` 에 `nonce` 가 없다. 서버가 검사할 수 없는 값을 심으면 막는 것처럼
    // 보일 뿐 아무것도 막지 못한다 — 계약이 화면을 이긴다.
    stubDocument()
    const gis = stubIdentityServices()
    const { requestGoogleIdToken } = await loadModule()

    void requestGoogleIdToken(new AbortController().signal).catch(() => {})
    await untilPrompted()

    expect(gis.config).not.toBeNull()
    expect(Object.keys(gis.config ?? {})).not.toContain('nonce')
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
