/**
 * Google 이 발급한 ID 토큰을 얻는 자리 (#83).
 *
 * 계약의 `POST /auth/oauth/google` 은 `idToken` 을 요구하고, 그것을 만드는 것은 우리 서버가
 * 아니라 Google 이다. **dev 우회가 없다** — 실제 OAuth 앱(클라이언트 ID · 승인된 오리진)이
 * 있어야 토큰이 나온다. 여기서 하는 일은 그 토큰을 받아 **그대로 돌려주는 것 하나**다.
 * 디코드하지 않고, 어디에도 저장하지 않는다 (F-3).
 *
 * ## 왜 One Tap(`prompt`) 인가 — `renderButton` 을 쓰지 않은 이유
 *
 * GIS 로 ID 토큰을 받는 길은 둘이다.
 *
 * 1. `initialize()` + `prompt()` — 브라우저가 그리는 계정 선택 창(FedCM). **DOM 자리가 필요 없다.**
 * 2. `renderButton()` — Google 이 그린 버튼을 우리가 준 `<div>` 안에 그린다.
 *
 * 2번은 **화면을 갈아야 한다.** `LoginScreen` 의 "Google로 계속하기" 버튼을 지우고 그 자리에
 * Google 이 그리는 버튼을 넣어야 하며, 그러면 6b 가 정한 버튼 높이(56px)와 네 폭(F-9)이
 * Google 의 렌더러 손에 넘어간다. 이 이슈는 **`googleIdToken.ts` 하나만 바꾸도록** 경계를
 * 그어 두었고(#83), 그 경계는 화면 계약을 지키기 위한 것이다. 그래서 1번을 골랐다 —
 * `GoogleIdTokenProvider` 의 "부르면 토큰을 준다" 는 모양이 그대로 성립하는 것도 1번뿐이다.
 *
 * **포기한 것을 적어 둔다.** One Tap 은 Google 이 *보조 수단*으로 설계한 것이라 자체 쿨다운이
 * 있다 — 사용자가 여러 번 닫으면 한동안 창이 뜨지 않는다. 이 앱에서는 로그인 수단이 이것
 * 하나뿐이므로 그때 로그인이 막힌다. **그 상태에서도 조용히 멈추지 않고 아래처럼 명시적으로
 * 실패한다**는 것이 지금 보장하는 전부이며, 쿨다운에 걸린 사용자에게 무엇을 줄지는 별도
 * 결정이다(이슈 후보 — `renderButton` 을 곁들이려면 6b 를 다시 그려야 한다).
 *
 * ## 약속이 반드시 끝난다
 *
 * 프론트에서 가장 위험한 실패는 **돌아가는 것처럼 보이는 것**이다. `prompt()` 는 창이 뜨지
 * 않아도 예외를 던지지 않으므로, 아무것도 하지 않으면 로그인 버튼이 "확인 중…" 인 채로 영원히
 * 남는다. 그래서 끝나는 길을 전부 막아 둔다.
 *
 * - `callback` 이 토큰을 준다 → resolve
 * - moment 알림이 skipped(창이 뜨지 않음) 또는 dismissed(사용자가 닫음) 를 알린다 → reject
 * - `AbortSignal` 이 끊긴다 → One Tap 을 걷고 reject
 * - 위 어느 것도 오지 않으면 감시 타이머가 → reject
 *
 * moment 알림의 **표시(display) 계열은 FedCM 전환으로 사라졌다** — `isDisplayed()` ·
 * `getNotDisplayedReason()` 은 더 이상 오지 않고, `isSkippedMoment()` 는 오되 이유가 비며,
 * `isDismissedMoment()` / `getDismissedReason()` 만 그대로다. 그래서 "왜 안 떴는가" 를 물을
 * 수 없고 "안 떴다" 까지만 안다. 감시 타이머가 남아 있는 이유가 이것이다 — GIS 는 우리 코드가
 * 아니고 이 API 는 최근 몇 해 동안 두 번 바뀌었다.
 *
 * ## 하지 않기로 한 것
 *
 * - **`nonce` 를 보내지 않는다.** 계약의 `OAuthLoginRequest` 에 `nonce` 가 없다 — 서버가 검사할
 *   수 없는 값을 토큰에 심으면 재생 공격을 막는 것처럼 보일 뿐 아무것도 막지 못한다.
 * - **`auto_select` 를 켜지 않는다.** 사용자가 버튼을 누른 결과로만 계정이 정해진다.
 * - **토큰을 로그에 남기지 않는다.** 성공·실패 어느 쪽에서도 `console` 을 부르지 않는다.
 */

/** 로그인 수단이 서지 않았다는 사실. 서버 오류가 아니므로 `ApiError` 와 섞지 않는다. */
export class GoogleSignInUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleSignInUnavailableError'
  }
}

/**
 * 실패 문구.
 *
 * **F-4 의 대상이 아니다.** F-4 가 막는 것은 *서버가 준 오류*를 프론트가 제 문장으로 바꿔
 * 쓰는 일이고, 여기 있는 것은 서버에 닿기도 전에 브라우저 쪽에서 끝난 일이다. 서버 오류는
 * `ApiError` 가 `message` 를 그대로 들고 온다.
 *
 * 갈래를 나눠 둔 이유는 **다음 사람이 무엇이 일어났는지 알기 위해서**다. 하나로 합치면
 * "안 됐다" 만 남고, 창이 안 뜬 것인지 사용자가 닫은 것인지 설정이 빠진 것인지 구분할 수 없다.
 */
export const SIGN_IN_FAILURE = {
  /** 빌드에 클라이언트 ID 가 없다. 사용자 사정이 아니라 설정 누락이므로 키 이름을 그대로 말한다. */
  missingClientId: 'VITE_GOOGLE_CLIENT_ID is required — set it in .env (see .env.example)',
  /** 브라우저가 아니다 (SSR · 러너). 스크립트를 꽂을 문서가 없다. */
  noDocument: 'Google 로그인은 브라우저에서만 할 수 있어요.',
  /** GIS 라이브러리를 받지 못했다 — 네트워크 · 차단기 · Google 장애. */
  scriptFailed: 'Google 로그인 스크립트를 받지 못했어요.',
  /** 창이 뜨지 않았다. FedCM 은 이유를 알려 주지 않는다 — 추측해서 적지 않는다. */
  notShown: 'Google 로그인 창이 열리지 않았어요.',
  /** 사용자가 창을 닫았다. */
  dismissed: 'Google 로그인을 취소했어요.',
  /** 토큰 없이 콜백이 왔다. 계약이 요구하는 값이 없으므로 보낼 것이 없다. */
  noCredential: 'Google 이 ID 토큰을 주지 않았어요.',
  /** 화면을 떠났다 (`AbortSignal`). */
  aborted: 'Google 로그인을 중단했어요.',
  /** 아무 소식도 오지 않았다. 이 줄이 "영원히 확인 중" 을 막는다. */
  timedOut: 'Google 로그인 응답이 오지 않았어요.',
} as const

/**
 * 아무 소식도 오지 않을 때 끊는 시간.
 *
 * **넉넉해야 한다.** 사용자가 계정 선택 창을 보고 있는 동안 끊으면, 방금 고른 계정이 있는데도
 * 실패로 보인다. 이 값은 "사람이 창을 다루는 시간" 이 아니라 **"GIS 가 우리에게 아무 말도
 * 하지 않은 채 흐른 시간"** 의 상한이다.
 */
const NO_RESPONSE_TIMEOUT_MS = 120_000

/** GIS 클라이언트 라이브러리. Google 이 정한 주소이며 다른 사본을 두지 않는다. */
const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

/**
 * `window.google` 중 **우리가 실제로 부르는 것만** 적는다.
 *
 * F-2 는 *API 계약* 타입을 손으로 적지 말라는 규칙이고 이것은 브라우저 SDK 라 대상이 다르다 —
 * 계약처럼 생성할 수 있는 원본이 없다. 그래도 손으로 적은 타입은 실제와 어긋나면 조용히
 * 틀리므로, 넓게 적지 않고 **부르는 네 개**로 좁힌다. 새로 부르는 것이 생기면 그때 넓힌다.
 */
type CredentialResponse = { credential?: string }

type PromptMomentNotification = {
  isSkippedMoment(): boolean
  isDismissedMoment(): boolean
  getDismissedReason(): string
}

type IdentityServices = {
  accounts: {
    id: {
      initialize(config: {
        client_id: string
        callback: (response: CredentialResponse) => void
        auto_select: boolean
        cancel_on_tap_outside: boolean
      }): void
      prompt(momentListener: (notification: PromptMomentNotification) => void): void
      cancel(): void
    }
  }
}

/**
 * 전역에서 GIS 를 찾는다.
 *
 * `window` 인터페이스를 `declare global` 로 넓히지 않는다 — 그러면 이 SDK 를 부르지 않는
 * 파일까지 `window.google` 이 있는 것으로 보이고, 손으로 적은 타입이 레포 전체의 사실이 된다.
 * 여기서만 좁게 본다. 브라우저에서 `globalThis` 는 `window` 와 같은 객체다.
 */
function identityServices(): IdentityServices | undefined {
  return (globalThis as { google?: IdentityServices }).google
}

/**
 * 클라이언트 ID.
 *
 * **기본값을 두지 않는다** (`${VAR:기본값}` 금지 — 보안 hard-stop). `src/api/config.ts` 의
 * `required()` 와 같은 규칙이지만 **부르는 시점에 읽는다**: 저기는 API 계층이라 값이 없으면
 * 앱이 뜨면 안 되고, 여기는 화면 계층이라 모듈을 읽는 순간 던지면 `LoginScreen` 의 import 가
 * 통째로 실패해 **빈 화면**이 된다. 빈 화면은 "무엇이 빠졌는가" 를 말하지 않는다 —
 * 버튼을 눌렀을 때 키 이름이 적힌 실패가 뜨는 쪽이 알아채기 쉽다.
 */
function requiredClientId(): string {
  const configured = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (typeof configured !== 'string' || configured.trim() === '') {
    throw new GoogleSignInUnavailableError(SIGN_IN_FAILURE.missingClientId)
  }
  return configured.trim()
}

/**
 * 받는 중인 스크립트. 두 번 누르면 두 번 받지 않게 붙잡아 둔다.
 *
 * **실패는 붙잡지 않는다** — 한 번의 네트워크 실패를 캐시하면 그 탭에서는 새로고침 전까지
 * 영영 로그인할 수 없다.
 */
let loadingIdentityServices: Promise<IdentityServices> | null = null

/**
 * GIS 를 필요할 때 받는다.
 *
 * `index.html` 에 `<script>` 로 박지 않은 이유 — 로그인하지 않는 사람(랜딩 · 공유 링크로 들어온
 * 사람)까지 매번 Google 에 요청을 하나 더 보내게 되고, 첫 화면이 우리 것이 아닌 CDN 에 매인다.
 * 대신 **실패 경로가 하나 는다**. 그 값은 치른다 — 아래에서 명시적으로 실패시킨다.
 */
function loadIdentityServices(): Promise<IdentityServices> {
  const loaded = identityServices()
  if (loaded !== undefined) return Promise.resolve(loaded)
  if (loadingIdentityServices !== null) return loadingIdentityServices

  const pending = new Promise<IdentityServices>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new GoogleSignInUnavailableError(SIGN_IN_FAILURE.noDocument))
      return
    }

    const script = document.createElement('script')
    script.src = GSI_SCRIPT_SRC
    script.async = true
    script.onload = () => {
      const ready = identityServices()
      if (ready === undefined) {
        // 200 이 왔는데 전역이 없다 — 받은 것이 GIS 가 아니다(캡티브 포털 · 프록시가 끼운 문서).
        reject(new GoogleSignInUnavailableError(SIGN_IN_FAILURE.scriptFailed))
        return
      }
      resolve(ready)
    }
    script.onerror = () => reject(new GoogleSignInUnavailableError(SIGN_IN_FAILURE.scriptFailed))
    document.head.appendChild(script)
  })

  loadingIdentityServices = pending
  void pending.catch(() => {
    if (loadingIdentityServices === pending) loadingIdentityServices = null
  })
  return pending
}

/** 부르면 ID 토큰 하나를 준다. 화면은 이 모양만 안다. */
export type GoogleIdTokenProvider = (signal: AbortSignal) => Promise<string>

/**
 * One Tap 을 띄우고 ID 토큰을 받아 그대로 돌려준다.
 *
 * **토큰은 반환값으로만 흐른다** — `localStorage` · `sessionStorage` · 쿠키 · 모듈 변수 어디에도
 * 쓰지 않고, `LoginScreen` 의 메모리에서 끝난다 (F-3).
 */
export const requestGoogleIdToken: GoogleIdTokenProvider = async (signal) => {
  const clientId = requiredClientId()
  const google = await loadIdentityServices()

  return new Promise<string>((resolve, reject) => {
    if (signal.aborted) {
      reject(new GoogleSignInUnavailableError(SIGN_IN_FAILURE.aborted))
      return
    }

    let settled = false
    /* 창을 띄우기 *전에* 건다 — `initialize()` 나 `prompt()` 안에서 멈춰도 상한이 있어야 한다. */
    const noResponseTimer = setTimeout(() => fail(SIGN_IN_FAILURE.timedOut), NO_RESPONSE_TIMEOUT_MS)

    /** 끝나는 길이 여럿이므로 먼저 온 하나만 유효하다. 나머지는 여기서 막힌다. */
    function settle(outcome: () => void): void {
      if (settled) return
      settled = true
      clearTimeout(noResponseTimer)
      signal.removeEventListener('abort', abandon)
      outcome()
    }

    function fail(message: string): void {
      settle(() => {
        // 실패한 채로 창을 남기지 않는다. `cancel()` 이 다시 moment 알림을 부르지만 `settled` 가 막는다.
        google.accounts.id.cancel()
        reject(new GoogleSignInUnavailableError(message))
      })
    }

    function abandon(): void {
      fail(SIGN_IN_FAILURE.aborted)
    }

    signal.addEventListener('abort', abandon)

    google.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response) => {
        const credential = response.credential
        if (typeof credential !== 'string' || credential === '') {
          fail(SIGN_IN_FAILURE.noCredential)
          return
        }
        settle(() => resolve(credential))
      },
    })

    google.accounts.id.prompt((notification) => {
      if (notification.isSkippedMoment()) {
        fail(SIGN_IN_FAILURE.notShown)
        return
      }
      // 성공도 dismissed 로 한 번 더 온다(`credential_returned`). 그것은 실패가 아니다.
      if (notification.isDismissedMoment() && notification.getDismissedReason() !== 'credential_returned') {
        fail(SIGN_IN_FAILURE.dismissed)
      }
    })
  })
}
