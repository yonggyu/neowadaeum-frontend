/**
 * Google 이 발급한 ID 토큰을 얻는 자리 (#83, #185, #181).
 *
 * 계약의 `POST /auth/oauth/google` 은 `idToken` 을 요구하고, 그것을 만드는 것은 우리 서버가
 * 아니라 Google 이다. **dev 우회가 없다** — 실제 OAuth 앱(클라이언트 ID · 승인된 오리진)이
 * 있어야 토큰이 나온다. 여기서 하는 일은 그 토큰을 받아 **그대로 돌려주는 것 하나**다.
 * 디코드하지 않고, 어디에도 저장하지 않는다 (F-3).
 *
 * ## 왜 nonce 를 이 파일이 부르는가 — `LoginScreen` 을 건드리지 않은 이유 (#185)
 *
 * 계약이 §13-87 로 **서버가 발급한 nonce** 를 필수로 만들었고, 그 값은 `initialize({ nonce })`
 * 를 거쳐 **ID 토큰의 클레임**으로만 서버에 간다 — `OAuthLoginRequest` 에 그런 필드는 없다.
 * 그래서 부르는 자리를 정하는 물음이 남았고, **이 파일 안으로 정했다.**
 *
 * - **화면이 들고 있어도 쓸 데가 없는 값이다.** `LoginScreen` 이 nonce 를 받아 넘긴다면 그것은
 *   화면을 그저 **지나가기만 하는 값**이 된다 — 화면이 그 값으로 할 수 있는 일이 하나도 없고
 *   (본문에 담는 것을 계약이 금지한다), 대신 GIS 가 왜 그것을 요구하는지를 화면이 알아야 한다.
 * - **취소가 한 신호로 덮인다.** `signal` 하나가 nonce 왕복과 One Tap 을 함께 끊는다. 화면이
 *   나눠 들면 끊는 자리가 둘이 된다.
 * - **발급과 `initialize()` 사이에 아무것도 두지 않는다.** nonce 의 수명이 짧으므로 그 사이는
 *   짧을수록 좋다. 사이에 화면 계층이 끼면 그 창이 늘어난다.
 * - **`#83` 이 그은 경계가 그대로 남는다.** 화면 계약(6b 의 버튼 높이 · F-9 의 네 폭)을 건드리지
 *   않고, `#182`(아무도 `abort()` 하지 않는다)와 같은 파일을 다투지 않는다.
 *
 * **치른 값** — 이 파일이 이제 외부 시스템 **둘**(GIS · 우리 계약)에 닿는다. 화면 계층이
 * `api/` 를 부르는 것은 의존성 방향(바깥 → 안)에 맞지만, "브라우저 SDK 어댑터" 하나였던 책임이
 * "서버가 받아 줄 ID 토큰을 얻는 일" 로 넓어졌다. 그 이름이 이 파일의 실제 책임이다.
 *
 * ## 길이 둘이다 — One Tap 이 먼저이고 렌더 버튼은 뒤에 온다 (#181)
 *
 * GIS 로 ID 토큰을 받는 길은 둘이다.
 *
 * 1. `initialize()` + `prompt()` — 브라우저가 그리는 계정 선택 창(FedCM). **DOM 자리가 필요 없다.**
 * 2. `initialize()` + `renderButton()` — Google 이 그린 버튼을 우리가 준 자리에 그린다.
 *
 * **ADR-0011 이 1번을 고른 근거는 그대로다.** 2번을 *주 수단*으로 삼으면 `LoginScreen` 의
 * "Google로 계속하기" 를 지우게 되고, 그러면 6b 가 정한 버튼 높이(56px)와 네 폭(F-9)이
 * Google 의 렌더러 손에 넘어간다. 그 결정은 **뒤집히지 않았다** — 주 수단은 지금도 1번이다.
 *
 * **그 결정이 미뤄 둔 값을 여기서 치른다.** One Tap 은 Google 이 *보조 수단*으로 설계한
 * 것이라 자체 쿨다운이 있다 — 사용자가 여러 번 닫으면 한동안 창이 뜨지 않는다. 이 앱은
 * 로그인 수단이 이것 하나뿐이고(`provider` enum 이 `[google]`), 랜딩과 로그인을 뺀 전부가
 * `RequireAuth` 뒤에 있어 **그 한 번의 실패가 앱 전체의 실패**였다. 명시적으로 실패하기는
 * 하지만 **빠져나갈 길이 없는** 상태였고, 소유자가 그 자리에 **곁들이는 쪽**을 골랐다
 * (9차 캔버스 `LoginOptionA`).
 *
 * 그래서 이 파일이 내보내는 것이 둘이다.
 *
 * - `requestGoogleIdToken` — **주 수단.** 우리 버튼이 부르고 One Tap 을 띄운다.
 * - `mountGoogleSignInButton` — **빠져나갈 길.** One Tap 이 실패한 뒤에만 화면이 세운다.
 *
 * **둘의 대가가 다르다.** 뒤의 것은 높이 · 반경 · 문구를 Google 이 정한다 — 아트보드가 그
 * 값을 적어 두고 받아들였다. 받아들인 범위는 **보조 자리 하나**이고, 주 버튼은 그대로다.
 *
 * **원인을 말하지 않는다.** 화면이 아는 것은 *"안 떴다"* 까지이고(아래 FedCM 절), 쿨다운인지
 * 차단기인지 알 방법이 없다. 그러므로 "쿨다운입니다" 라고 적지 않는다 — 그것은 추측을
 * 사실처럼 적는 것이다. 이 파일이 하는 일은 **다른 길을 하나 더 두는 것**뿐이다.
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
 * **렌더 버튼 쪽은 끝나는 길이 둘뿐이다** (#181) — 사람이 눌러 콜백이 오거나, 화면이 그
 * 버튼을 걷거나. 감시 타이머를 걸지 않는다: 저기서 타이머가 필요한 이유는 *GIS 가 제가 연
 * 창에 대해 아무 말도 하지 않을 수 있기* 때문인데, 여기서 기다리는 것은 **사람의 클릭**이라
 * 상한을 두면 아직 화면을 보고 있는 사람에게서 버튼을 빼앗는 셈이 된다. 대신 그리는 자리가
 * 사라지면 반드시 걷힌다 — `LoginScreen` 의 effect 정리가 그것을 보장한다.
 *
 * moment 알림의 **표시(display) 계열은 FedCM 전환으로 사라졌다** — `isDisplayed()` ·
 * `getNotDisplayedReason()` 은 더 이상 오지 않고, `isSkippedMoment()` 는 오되 이유가 비며,
 * `isDismissedMoment()` / `getDismissedReason()` 만 그대로다. 그래서 "왜 안 떴는가" 를 물을
 * 수 없고 "안 떴다" 까지만 안다. 감시 타이머가 남아 있는 이유가 이것이다 — GIS 는 우리 코드가
 * 아니고 이 API 는 최근 몇 해 동안 두 번 바뀌었다.
 *
 * ## 하지 않기로 한 것
 *
 * - **nonce 를 지어내지 않는다.** 서버가 발급한 값을 **가공 없이 그대로** 싣는다 (§13-87).
 *   자르거나 · 다시 인코딩하거나 · 해시하면 토큰에 실리는 값이 달라져 서버가 대조하지 못한다.
 *   ADR-0011 이 적어 둔 *"계약에 없는 nonce 를 지어내 보내지 않는다"* 는 **그때 옳았고**, 계약이
 *   열리면서 그 문장의 전제가 바뀐 것이다 — 지금도 지어내지 않으며, 서버에서 받아 온다.
 * - **`LOGIN_NONCE_INVALID` 에 자동으로 다시 시도하지 않는다** (#185). 회복은 *nonce 부터 다시*
 *   이므로 다시 부르는 것은 **서버에 상태를 하나 더 만드는 일**이고, 그 경로에는 인증 경로 셋이
 *   함께 쓰는 IP 기준 한도가 걸려 있다 (백엔드 S-8). `#142` 가 *"다시 부르는 것이 새로 만드는
 *   것인 자리에서는 열지 않는다"* 로 판정한 것과 같은 종류다. 사용자가 로그인을 다시 누르면
 *   이 함수가 처음부터 도므로 **회복 경로는 이미 있다** — 코드가 몰래 한 번 더 태우지 않는다.
 * - **`expiresInSeconds` 를 소비하지 않는다** (#185). 쓸 수 있는 길이 둘인데 둘 다 값보다 비싸다:
 *   남은 시간이 지났다고 **스스로 한 번 더 받으면** 위의 자동 재시도가 되고, 보내기 전에
 *   **미리 실패시키면** 서버가 하지 않은 말을 화면이 짓게 된다. 계약이 준 사실을 버리지 않도록
 *   `AuthNonceResponse` 를 통째로 받아 두고 여기서 `nonce` 만 꺼낸다 — 쓸 이유가 생기면 그때
 *   값이 이미 와 있다.
 * - **`auto_select` 를 켜지 않는다.** 사용자가 버튼을 누른 결과로만 계정이 정해진다.
 * - **토큰을 로그에 남기지 않는다.** 성공·실패 어느 쪽에서도 `console` 을 부르지 않는다.
 *   nonce 도 같다 — 로그에 남기지 않고 어떤 저장소에도 두지 않는다 (F-3).
 */

import { issueLoginNonce } from '../../api/endpoints/auth'
import { readRuntimeConfig } from '../../runtimeConfig'

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
  /**
   * 클라이언트 ID 가 오지 않았다. 사용자 사정이 아니라 설정 누락이므로 **키 이름을 그대로 말한다.**
   *
   * 그 이름은 이제 컨테이너 환경변수의 이름이다 (#188) — 읽는 사람이 고칠 자리를 그대로 가리켜야
   * 하고, 값은 빌드가 아니라 `/config.js` 로 온다.
   */
  missingClientId:
    'GOOGLE_OAUTH_CLIENT_ID is required — 컨테이너 환경변수로 준다 (dev 는 .env, see .env.example)',
  /**
   * 값은 있는데 Google 클라이언트 ID 의 모양이 아니다 (#184).
   *
   * **`missingClientId` 와 합치지 않는다.** 빠뜨린 것과 잘못 적은 것은 고치는 자리가 같아도
   * 고치는 방법이 다르다 — 앞은 *넣어라*, 뒤는 *넣은 것을 다시 보라* 다. 합치면 값을 넣은
   * 사람이 자기가 넣었다는 사실 때문에 앞의 문구를 읽고 넘어간다.
   *
   * **값을 싣지 않는다.** 시크릿은 아니지만(브라우저에 그대로 실린다) 이 레포는 값이 아니라
   * 키만 다루고, 그 규칙은 로그와 화면에도 선다 (S-11 · 보안 hard-stop).
   */
  malformedClientId:
    'GOOGLE_OAUTH_CLIENT_ID 의 모양이 Google 클라이언트 ID 가 아니다 — ' +
    '<숫자>-<해시>.apps.googleusercontent.com 인지, 값이 잘리지 않았는지 확인한다',
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
 * 틀리므로, 넓게 적지 않고 **부르는 다섯 개**로 좁힌다. 새로 부르는 것이 생기면 그때 넓힌다.
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
        /** 서버가 발급한 값 그대로. GIS 가 이것을 ID 토큰의 `nonce` 클레임에 넣는다 (§13-87). */
        nonce: string
        callback: (response: CredentialResponse) => void
        auto_select: boolean
        cancel_on_tap_outside: boolean
      }): void
      prompt(momentListener: (notification: PromptMomentNotification) => void): void
      /**
       * Google 이 그린 버튼을 `parent` 안에 그린다 (#181).
       *
       * **`width` 를 넘기지 않는다.** GIS 는 이 값을 px 로만 받는데, 그 순간 우리가 네 폭에
       * 걸쳐 버튼 폭을 손으로 세는 셈이 되고 카드(420px, 390 에서는 342px)를 넘는 값이
       * 들어가면 **가로 스크롤이 생긴다** (F-9). 넘기지 않으면 GIS 가 제 글자 폭만큼만
       * 잡으므로 어느 폭에서도 카드 안에 든다 — 아트보드가 그린 것도 그 모양이다.
       */
      renderButton(parent: HTMLElement, options: RenderButtonOptions): void
      cancel(): void
    }
  }
}

/**
 * 그려 달라고 부탁하는 모양 (#181).
 *
 * 다섯 다 아트보드가 그린 버튼의 값이다 — 흰 바탕 · 4px 반경 · 40px 높이 · "계속하기" 문구.
 * **부탁일 뿐이고 결과를 우리가 정하지 못한다**: 실제 높이 · 반경 · 문구는 GIS 가 정하며,
 * 문구의 언어는 브라우저 로캘을 따른다. 그것이 이 자리에서 받아들이기로 한 대가다.
 *
 * `theme` 은 다크에서도 `outline`(흰 바탕)이다. 시스템 다크에 맞춰 `filled_black` 으로
 * 바꾸면 `--bg`(거의 검정) 위에 검은 버튼이 놓여 사라진다 — 어두운 바탕에서 눈에 남는 쪽을
 * 고른다. 토글을 만들지 않는 것은 `E-4` 와 같다.
 */
type RenderButtonOptions = {
  type: 'standard'
  theme: 'outline'
  size: 'large'
  text: 'continue_with'
  shape: 'rectangular'
}

const RENDER_BUTTON_OPTIONS: RenderButtonOptions = {
  type: 'standard',
  theme: 'outline',
  size: 'large',
  text: 'continue_with',
  shape: 'rectangular',
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
 * Google 클라이언트 ID 로 **쓸 수 있는 모양** (#184).
 *
 * **완전한 검증이 아니다.** 이 검사가 잡으려는 것은 하나 — **잘리거나 빠뜨린 값**이다.
 * 값이 있는지만 보면 그런 값이 그대로 Google 까지 가고, 실패는 **우리 코드에서 가장 먼 곳**
 * — 남의 도메인의 `401 invalid_client` 페이지 — 에서 나타난다. 그 페이지의 문구는 우리가
 * 고칠 수 없고 `F-4` 의 대상도 아니다(서버가 준 오류가 아니다). 여기서는 부르기 전에 판정한다.
 *
 * **어디까지 조이는지가 이 상수의 실제 판단이다.**
 *
 * - **접미사만 보지 않는다.** 실제로 걸린 값은 `.apps.googleusercontent.com` 으로 끝나고 있었다.
 *   눈으로 한 판정이 정확히 그것이었고, 그래서 통과했다.
 * - **해시 길이를 32 로 못 박지 않는다.** 관측된 값은 32자지만, 그 수를 적으면 Google 이
 *   형식을 바꾸는 날 **멀쩡한 값이 거절된다** — 그 실패는 이번 것보다 나쁘다. 우리 코드가
 *   맞다고 믿는 쪽이 틀린 경우이고, 증상은 *로그인 전체가 막히는 것*이다.
 * - **그래서 하한만 둔다.** `20` 은 관측값(32)과 걸린 값(8) 사이에서 고른 수이며 정확한 수가
 *   아니다 — 형식이 다소 바뀌어도 살아남고 잘린 값은 잡는 자리를 노린 것이다. 조이는 것이
 *   목적이 아니므로 대문자도 받는다.
 *
 * **`docker/40-neowadaeum-config.sh` 가 같은 판정을 한 번 더 한다.** 배포는 컨테이너가 뜰 때
 * 걸러야 사람이 버튼을 누르기 전에 드러나고, dev 는 진입점을 지나지 않으므로 이 자리가 필요하다.
 * **정본은 여기다** — 두 곳이 갈라지면 같은 값이 배포와 dev 에서 다르게 판정된다
 * (`PUBLIC_ORIGIN` 이 같은 이유로 두 곳에 있고, 진입점이 그 사실을 주석에 적어 두었다).
 */
const CLIENT_ID_SHAPE = /^\d+-[a-zA-Z0-9]{20,}\.apps\.googleusercontent\.com$/

/**
 * 클라이언트 ID.
 *
 * **기본값을 두지 않는다** (`${VAR:기본값}` 금지 — 보안 hard-stop). `src/api/config.ts` 의
 * `required()` 와 같은 규칙이지만 **부르는 시점에 읽는다**: 저기는 API 계층이라 값이 없으면
 * 앱이 뜨면 안 되고, 여기는 화면 계층이라 모듈을 읽는 순간 던지면 `LoginScreen` 의 import 가
 * 통째로 실패해 **빈 화면**이 된다. 빈 화면은 "무엇이 빠졌는가" 를 말하지 않는다 —
 * 버튼을 눌렀을 때 키 이름이 적힌 실패가 뜨는 쪽이 알아채기 쉽다.
 *
 * **읽는 곳이 빌드 시점의 `import.meta.env` 에서 런타임 설정으로 옮겨졌다 (#188, ADR-0012).**
 * 바뀐 것은 값의 **출처**뿐이다 — *늦게 던진다* 는 위의 판단은 그대로다.
 */
function requiredClientId(): string {
  const configured = readRuntimeConfig('GOOGLE_OAUTH_CLIENT_ID')
  if (configured === undefined) {
    throw new GoogleSignInUnavailableError(SIGN_IN_FAILURE.missingClientId)
  }
  // **빠뜨린 것과 잘못 적은 것을 나눈다** (#184). 잘못 적은 것이 *적기는 한 것* 으로
  // 취급되면, 그 값은 우리 코드를 그대로 지나 남의 도메인에서 실패한다.
  if (!CLIENT_ID_SHAPE.test(configured)) {
    throw new GoogleSignInUnavailableError(SIGN_IN_FAILURE.malformedClientId)
  }
  return configured
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

/**
 * 서버가 발급한 로그인 nonce 하나 (§13-87).
 *
 * **값을 가공하지 않는다** — `AuthNonceResponse.nonce` 를 그대로 꺼내 그대로 `initialize` 로
 * 넘긴다. 여기서 손대면 ID 토큰에 실리는 값이 달라져 서버가 대조하지 못한다.
 *
 * **서버가 답한 실패는 그대로 올린다** (F-4). `ApiError` 가 `message` 를 들고 있으므로
 * `LoginScreen` 이 서버의 문장을 그대로 보여 준다 — 이 모듈이 대신 문구를 짓지 않는다.
 * 옮기는 것은 **취소 하나**뿐이다: `AbortSignal` 이 끊은 요청은 브라우저의 영어 `AbortError`
 * 로 거절되는데, 그것은 아무의 말도 아닌 문장이라 화면에 그대로 둘 수 없다. 이 모듈이 다른
 * 자리에서 이미 쓰는 말로 바꾼다.
 */
async function requestLoginNonce(signal: AbortSignal): Promise<string> {
  // 이미 끊긴 신호로 서버에 상태를 만들지 않는다 — 쓰이지 않을 nonce 는 IP 한도만 태운다 (S-8).
  if (signal.aborted) {
    throw new GoogleSignInUnavailableError(SIGN_IN_FAILURE.aborted)
  }
  try {
    return (await issueLoginNonce(signal)).nonce
  } catch (error) {
    if (signal.aborted) {
      throw new GoogleSignInUnavailableError(SIGN_IN_FAILURE.aborted)
    }
    throw error
  }
}

/**
 * 두 길이 함께 쓰는 준비 — 설정 · GIS · **서버가 발급한 nonce** (§13-87).
 *
 * **한 자리에 둔 이유가 nonce 다** (#181). 빠져나갈 길이 이 준비를 지나지 않으면 그것은
 * *nonce 없이 로그인하는 경로*가 되고, 계약이 필수로 만든 대조가 그 길에서만 빠진다.
 * 여기를 지나는 한 두 길이 **같은 방식으로 같은 서버 값을 싣는다** — 각자 자기 값을 받으므로
 * 값을 돌려쓰지도 않는다(한 번 통과하면 끝나는 값이다).
 *
 * **GIS 를 먼저 받고 nonce 를 나중에 받는다.** 순서가 뒤바뀌면 스크립트를 받지 못한 왕복마다
 * 서버에 쓰이지 않을 nonce 가 하나씩 남고, 인증 경로 셋이 함께 쓰는 IP 한도를 그만큼 태운다
 * (백엔드 S-8). 이 순서면 실패는 Google 쪽에서 끝난다.
 */
async function prepareSignIn(
  signal: AbortSignal,
): Promise<{ google: IdentityServices; clientId: string; nonce: string }> {
  const clientId = requiredClientId()
  const google = await loadIdentityServices()
  const nonce = await requestLoginNonce(signal)
  return { google, clientId, nonce }
}

/** 부르면 ID 토큰 하나를 준다. 화면은 이 모양만 안다. */
export type GoogleIdTokenProvider = (signal: AbortSignal) => Promise<string>

/**
 * One Tap 을 띄우고 ID 토큰을 받아 그대로 돌려준다. **주 수단이다** — 6b 의 56px 버튼이 부른다.
 *
 * **토큰은 반환값으로만 흐른다** — `localStorage` · `sessionStorage` · 쿠키 · 모듈 변수 어디에도
 * 쓰지 않고, `LoginScreen` 의 메모리에서 끝난다 (F-3).
 */
export const requestGoogleIdToken: GoogleIdTokenProvider = async (signal) => {
  const { google, clientId, nonce } = await prepareSignIn(signal)

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
      // 받은 값을 **그대로** 싣는다 (§13-87). 이 한 줄이 ID 토큰의 `nonce` 클레임이 된다.
      nonce,
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

/**
 * `parent` 안에 Google 이 그린 버튼을 세우고, 그것을 눌러 받은 ID 토큰 하나를 준다.
 *
 * 화면은 이 모양만 안다 — **`GoogleIdTokenProvider` 와 다른 타입인 것이 사실 그대로다.**
 * 저쪽은 *부르면 토큰을 준다* 이고 이쪽은 *자리를 주면 언젠가 사람이 누른다* 라, 호출 지점과
 * 결과 지점이 갈린다. 하나로 합치면 `signal` 뒤에 숨은 DOM 자리를 부르는 쪽이 알아야 한다.
 */
export type GoogleSignInButtonMounter = (parent: HTMLElement, signal: AbortSignal) => Promise<string>

/**
 * 빠져나갈 길 (#181, 9차 캔버스 `LoginOptionA`).
 *
 * **One Tap 이 실패한 뒤에만 화면이 부른다.** 부르는 자리를 그렇게 좁혀 둔 이유는 두 가지다 —
 * 로그인 진입점이 늘 둘이면 6b 가 정한 주 버튼이 흐려지고, `initialize()` 앞에 붙는 nonce
 * 발급이 로그인 화면을 여는 것만으로 서버에 상태를 하나 만들기 때문이다 (S-8).
 *
 * **nonce 는 여기서도 서버 값이다** (§13-87). `prepareSignIn` 을 지나므로 One Tap 과 같은
 * 방식으로 받아 **가공 없이** `initialize({ nonce })` 로 간다. 지어내지도, 저 위에서 쓰던
 * 값을 물려받지도 않는다 — 이 함수 한 번이 nonce 한 번이다.
 *
 * **`prompt()` 를 부르지 않는다.** 여기서 초대장을 한 번 더 띄우면 방금 뜨지 않은 그 창을
 * 다시 부르는 것이고, 사용자가 그것을 또 닫으면 쿨다운만 깊어진다.
 *
 * **다시 누를 수 있는 상태로 두지 않는다.** 한 번 그린 버튼은 nonce 하나에 묶여 있고 nonce
 * 는 수명이 짧다(계약이 `expiresInSeconds` 로 말한다). 그래서 화면은 실패할 때마다 이 자리를
 * 걷었다가 다시 세운다 — 그 왕복 하나하나가 **사용자가 누른 결과**이며, 코드가 스스로 다시
 * 받는 자리는 여기에도 없다 (#185 · #142 와 같은 판정).
 */
export const mountGoogleSignInButton: GoogleSignInButtonMounter = async (parent, signal) => {
  const { google, clientId, nonce } = await prepareSignIn(signal)

  return new Promise<string>((resolve, reject) => {
    if (signal.aborted) {
      reject(new GoogleSignInUnavailableError(SIGN_IN_FAILURE.aborted))
      return
    }

    let settled = false

    /** 끝나는 길이 둘이므로 먼저 온 하나만 유효하다. */
    function settle(outcome: () => void): void {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', abandon)
      outcome()
    }

    function abandon(): void {
      settle(() => {
        // **우리가 그리게 한 것을 우리가 걷는다.** `cancel()` 은 부르지 않는다 — 그것은 One Tap
        // 창을 닫는 일이고 이 길에는 열린 창이 없다. 부르면 같은 순간 주 버튼이 띄운 창을 닫는다.
        parent.replaceChildren()
        reject(new GoogleSignInUnavailableError(SIGN_IN_FAILURE.aborted))
      })
    }

    signal.addEventListener('abort', abandon)

    google.accounts.id.initialize({
      client_id: clientId,
      // 받은 값을 **그대로** 싣는다 (§13-87). 이 한 줄이 ID 토큰의 `nonce` 클레임이 된다.
      nonce,
      auto_select: false,
      cancel_on_tap_outside: true,
      callback: (response) => {
        const credential = response.credential
        if (typeof credential !== 'string' || credential === '') {
          settle(() => reject(new GoogleSignInUnavailableError(SIGN_IN_FAILURE.noCredential)))
          return
        }
        settle(() => resolve(credential))
      },
    })

    try {
      google.accounts.id.renderButton(parent, RENDER_BUTTON_OPTIONS)
    } catch {
      // 그리지 못했다 — 자리를 비워 둔 채 성공한 척하지 않는다. 빈 자리는 돌아가는 것처럼 보인다.
      settle(() => reject(new GoogleSignInUnavailableError(SIGN_IN_FAILURE.scriptFailed)))
    }
  })
}
