#!/bin/sh
# ─────────────────────────────────────────────────────────────
# 설정을 컨테이너가 뜰 때 넣는다 (#187, #188, ADR-0012)
#
# 하는 일은 둘이다.
#   1. `/config.js` 를 써 내린다 — 앱이 모듈 평가 중에 그 전역을 읽는다
#   2. `index.html` 의 OG 표시자를 `PUBLIC_ORIGIN` 으로 채운다 — 스크레이퍼는 JS 를 돌리지
#      않으므로 이 값만은 마크업에 있어야 한다
#
# **여기서 만드는 것의 정본은 `vite.config.ts` 다.** 개발 서버가 같은 두 가지를 만들고,
# 둘이 갈라지면 증상은 *dev 에서는 되는데 배포에서 안 된다* 로 나온다 — 가장 늦게 발견되는
# 모양이다. 공유하는 계약은 표시자 문자열과 키 이름들뿐이다.
#
# **값이 없으면 뜨지 않는다.** 베이스 이미지의 진입점이 이 디렉터리의 스크립트를 `set -e` 로
# 돌리므로, 아래에서 `exit 1` 하면 컨테이너가 뜨지 않는다. 그것이 요구되는 동작이다 —
# 설정을 빠뜨린 배포가 **정상인 척 뜨는 것**을 막는 자리이며, 백엔드 §7.3 과 같은 규칙이다.
# ─────────────────────────────────────────────────────────────
set -eu

TEMPLATE_HTML=/usr/share/nginx/template/index.html
HTML_DIR=/usr/share/nginx/html
OG_MARKER='<!--__OG_ABSOLUTE__-->'
OG_IMAGE_FILE=og-card.png

fail() {
  echo "[neowadaeum] $1" >&2
  exit 1
}

# ── 필수 값 ──────────────────────────────────────────────────
#
# **`GOOGLE_OAUTH_CLIENT_ID` 도 필수다 — 개발 서버와 다른 점이다.**
# dev 에서 그 값을 요구하지 않는 이유는 *로그인을 쓰지 않는 작업까지 OAuth 앱을 요구하게
# 되기 때문*이었다 (ADR-0011 · ADR-0012). **배포에는 그 이유가 없다** — 로그인이 없는 배포는
# 쓰지 않는 기능이 아니라 결함이고, 그 결함은 사람이 버튼을 누르기 전까지 드러나지 않는다.
[ -n "${API_BASE_URL:-}" ] || fail "API_BASE_URL 이 없다 — 컨테이너 환경변수로 준다. 기본값을 두지 않는다."
[ -n "${GOOGLE_OAUTH_CLIENT_ID:-}" ] || fail "GOOGLE_OAUTH_CLIENT_ID 가 없다 — 이 값이 없으면 로그인이 성립하지 않는다."

# **모양까지 본다** (#184). 있는지만 보면 **잘린 값이 그대로 Google 까지 가고**, 실패는 우리
# 화면이 아니라 남의 도메인의 `401 invalid_client` 페이지로만 드러난다 — 사람이 버튼을 누른
# 뒤에. 여기서 걸러야 **잘못된 값으로 컨테이너가 뜨지 않는다.** 아래에서 `PUBLIC_ORIGIN` 을
# 같은 방식으로 다루는 이유와 같다: 빠뜨린 것과 잘못 적은 것은 다르게 나타나야 한다.
#
# **정본은 `src/screens/account/googleIdToken.ts` 의 `CLIENT_ID_SHAPE` 다.** *어디까지 조이는가*
# 의 근거(왜 해시 길이를 32 로 못 박지 않는가)가 거기 있고, 두 곳이 갈라지면 같은 값이 배포와
# dev 에서 다르게 판정된다.
#
# **값을 싣지 않는다 — `PUBLIC_ORIGIN` 과 다른 점이다.** 클라이언트 ID 는 계정 체계에 속하므로
# 이 레포는 값이 아니라 키만 다룬다 (S-11).
printf '%s' "$GOOGLE_OAUTH_CLIENT_ID" \
  | grep -Eq '^[0-9]+-[a-zA-Z0-9]{20,}\.apps\.googleusercontent\.com$' \
  || fail "GOOGLE_OAUTH_CLIENT_ID 의 모양이 Google 클라이언트 ID 가 아니다 — <숫자>-<해시>.apps.googleusercontent.com 인지, 값이 잘리지 않았는지 확인한다."

# ── /config.js ───────────────────────────────────────────────
#
# JSON 문자열로 넣기 전에 역슬래시와 따옴표를 막는다. 값이 그대로 JS 안으로 들어가므로,
# 막지 않으면 잘못 적힌 값 하나가 **문법 오류**가 되어 앱 전체가 뜨지 않는다.
json_string() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | tr -d '\n\r'
}

cat > "$HTML_DIR/config.js" <<CONFIG
window.__NEOWADAEUM_CONFIG__ = {"API_BASE_URL":"$(json_string "$API_BASE_URL")","GOOGLE_OAUTH_CLIENT_ID":"$(json_string "$GOOGLE_OAUTH_CLIENT_ID")"}
CONFIG

# ── index.html 의 OG 표시자 ──────────────────────────────────
#
# **매번 손대지 않은 원본에서 만든다.** 채운 결과 위에 다시 채우려 하면 표시자가 없어
# `PUBLIC_ORIGIN` 을 바꿔도 옛 값이 남는다.
if [ -z "${PUBLIC_ORIGIN:-}" ]; then
  # 값이 없으면 **표시자를 그대로 둔다.** 두 태그는 나가지 않고 나머지 OG 태그는 그대로다.
  # 기본값을 지어내지 않는 이유는 `vite.config.ts` 에 적혀 있다 — 없는 주소를 가리키는
  # og:image 는 카드가 깨진 채로 남고, 그 상태는 태그가 아예 없는 것보다 알아채기 어렵다.
  cp "$TEMPLATE_HTML" "$HTML_DIR/index.html"
  echo "[neowadaeum] PUBLIC_ORIGIN 이 없다 — og:url · og:image 를 내지 않는다."
  exit 0
fi

# 끝 슬래시 하나는 허용한다 — 개발 서버의 `URL` 파싱이 그것을 오리진으로 받아들이므로
# 여기서만 거절하면 같은 값이 두 곳에서 다르게 판정된다.
origin=${PUBLIC_ORIGIN%/}

case "$origin" in
  http://*|https://*) ;;
  *) fail "PUBLIC_ORIGIN 은 http 또는 https 여야 한다: $PUBLIC_ORIGIN" ;;
esac

# 오리진까지만 적는다. 경로 · 질의 · 조각이 붙으면 오리진이 아니다 —
# 잘못 적힌 오리진은 조용히 넘어가면 모든 공유 링크를 남의 도메인으로 보낸다.
host=${origin#*://}
case "$host" in
  '') fail "PUBLIC_ORIGIN 에 호스트가 없다: $PUBLIC_ORIGIN" ;;
  */*|*\?*|*'#'*) fail "PUBLIC_ORIGIN 에 경로를 붙이지 않는다 — 오리진까지만 적는다: $PUBLIC_ORIGIN" ;;
esac

# `vite.config.ts` 의 `absoluteOpenGraphMarkup` 과 **같은 여섯 태그**다.
# 줄 사이의 들여쓰기 넷은 표시자가 놓인 자리의 것과 맞춘다.
OG_MARKUP="<meta property=\"og:url\" content=\"$origin/\" />
    <meta property=\"og:image\" content=\"$origin/$OG_IMAGE_FILE\" />
    <meta property=\"og:image:width\" content=\"1200\" />
    <meta property=\"og:image:height\" content=\"630\" />
    <meta property=\"og:image:alt\" content=\"너와다음\" />
    <meta name=\"twitter:card\" content=\"summary_large_image\" />"
export OG_MARKUP

# **정규식을 쓰지 않는다.** 표시자와 마크업에 `/` 와 `&` 가 들어 있어 `sed` 의 치환으로는
# 매번 이스케이프를 신경 써야 하고, 한 번 틀리면 조용히 어긋난 마크업이 나간다.
# 자리를 찾아 잘라 붙인다.
awk -v marker="$OG_MARKER" '
  {
    at = index($0, marker)
    if (at > 0) {
      print substr($0, 1, at - 1) ENVIRON["OG_MARKUP"] substr($0, at + length(marker))
    } else {
      print
    }
  }
' "$TEMPLATE_HTML" > "$HTML_DIR/index.html"

grep -q 'property="og:url"' "$HTML_DIR/index.html" ||
  fail "표시자를 찾지 못했다 — index.html 과 이 스크립트가 갈라졌다 ($OG_MARKER)."

echo "[neowadaeum] 설정을 넣었다."
