# ─────────────────────────────────────────────────────────────
# 프론트 이미지 (#187, S-2)
#
# **이 이미지는 설정을 담지 않는다.** 값은 컨테이너가 뜰 때 온다 (ADR-0012) — 진입점이
# `/config.js` 를 써 내리고 `index.html` 의 OG 표시자를 채운다. 그래서 **이미지 하나가
# 어디서든 돌고**, 스테이징에서 검증한 SHA 를 그대로 운영에 올릴 수 있다.
#
# **`.dockerignore` 가 1차 방어선이다.** 여기서 무엇을 COPY 하든 .env 와 호스트의 dist/ 는
# 컨텍스트에 들어오지 않는다.
#
# ## 계약이 컨텍스트 안에 있어야 한다
#
# API 타입은 계약에서 만든다 (F-2). **계약은 이 레포에 없다** — 워크플로가 백엔드를
# `_contract/` 로 받아 둔다 (.github/workflows/release.yml, ci.yml 과 같은 방식).
# 빌드 스테이지가 직접 받지 않는 이유: 그러면 이미지 빌드가 네트워크와 토큰을 알게 된다.
#
# 로컬에서 이 이미지를 만들려면 계약을 먼저 컨텍스트에 둔다.
#   mkdir -p _contract/docs && cp ../neowadaeum-backend/docs/openapi.yaml _contract/docs/
# ─────────────────────────────────────────────────────────────

# ── 빌드 ─────────────────────────────────────────────────────
# 다이제스트로 고정한다. 이동 가능한 태그를 쓰지 않는 관례(백엔드 B-04-1)를 베이스에도 적용한다.
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build
WORKDIR /workspace

# 의존성을 먼저 넣는다 — 소스가 바뀔 때마다 설치 결과가 버려지지 않게 한다.
# `npm ci` 다. lockfile 과 package.json 이 어긋나면 **실패한다** (ci.yml 과 같은 이유).
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY _contract/docs/openapi.yaml _contract/docs/openapi.yaml
COPY scripts scripts
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts vitest.guard.ts vitest.setup.ts index.html ./
COPY public public
COPY src src

# F-2 — API 타입을 손으로 적지 않는다. 산출물이라 커밋하지 않으므로 여기서 만든다.
ENV OPENAPI_SOURCE=_contract/docs/openapi.yaml
RUN npm run api:types

# **`vite build` 가 아니라 `npm run build` 다.**
#
# 백엔드는 *"테스트를 이미지 빌드에서 돌리지 않는다 — 그것은 CI 의 일이고, 두 곳에 두면 어느
# 쪽이 진실인지가 매번 문제가 된다"* 고 적었고 그 판단은 옳다. 그러나 `build` 에 달린 것은
# 테스트가 아니라 **가드**다: `prebuild` 가 생성 타입의 존재를 보고(#143), `tsc -b` 가 그
# 타입이 실제로 맞는지 본다.
#
# `vite build` 만 부르면 그 둘이 함께 빠진다 — Vite 는 타입을 지우고 변환하므로 **계약 없이도
# 번들이 만들어질 수 있고**, 그러면 계약을 소비하지 못하는 이미지가 조용히 게시된다.
# 몇 초의 중복 타입검사를 치르고 그 자리를 남긴다.
#
# **설정 값을 주지 않는다.** 주면 그것이 번들에 박혀 이미지가 환경에 매인다 (ADR-0012).
# 값 없이 빌드가 성공한다는 것이 곧 번들에 오리진이 없다는 뜻이다.
RUN npm run build

# ── 실행 ─────────────────────────────────────────────────────
# **root 로 돌지 않는다.** unprivileged 변종을 쓴다 — 기본 사용자가 101 이고 8080 을 듣는다.
# 평범한 nginx 이미지를 non-root 로 고쳐 쓰는 것보다 이쪽이 짧고, 고칠 자리가 적으면 틀릴
# 자리도 적다.
FROM nginxinc/nginx-unprivileged:1.29-alpine@sha256:0c79d56aee561a1d81c63f00eee5fb5fe29279560cdc55e91425133104c7fbe6 AS runtime

# 설정 파일과 진입점 스크립트를 넣는 동안만 root 다.
USER root

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-neowadaeum-config.sh /docker-entrypoint.d/40-neowadaeum-config.sh
RUN chmod +x /docker-entrypoint.d/40-neowadaeum-config.sh

# 서빙되는 자리. 진입점이 여기 `index.html` 과 `config.js` 를 **매번 다시 만든다.**
#
# **디렉터리 자체의 소유도 옮긴다.** `COPY --chown` 은 넣는 파일의 소유만 바꾸고, 베이스에
# 이미 있던 이 디렉터리는 root 소유로 남는다 — 그러면 진입점이 `config.js` 를 쓰지 못해
# `Permission denied` 로 죽는다. 실제로 그렇게 한 번 죽였다.
#
# 진입점이 이 자리에 쓰므로 **루트 파일시스템을 읽기 전용으로 띄우려면 여기에 쓸 수 있는
# 마운트가 필요하다.** 그 경우 컨테이너는 조용히 도는 대신 위와 같은 이유로 뜨지 않는다.
RUN chown 101:101 /usr/share/nginx/html
COPY --from=build --chown=101:101 /workspace/dist /usr/share/nginx/html

# **손대지 않은 원본을 따로 둔다.** 진입점이 표시자를 채운 결과를 원본 위에 덮으면 두 번째
# 기동에서 채울 표시자가 없어져, `PUBLIC_ORIGIN` 을 바꾸고 컨테이너를 다시 띄워도 옛 값이
# 남는다. 매번 이 원본에서 만든다.
COPY --from=build --chown=101:101 /workspace/dist/index.html /usr/share/nginx/template/index.html

USER 101

EXPOSE 8080

# HEALTHCHECK 를 이미지에 넣지 않는다 — 프로브는 프록시/오케스트레이터의 책임이고, 두 곳에
# 두면 어느 판정이 재시작을 부르는지가 흐려진다 (백엔드 Dockerfile 과 같은 이유).
#
# ENTRYPOINT 는 베이스의 것을 그대로 쓴다. 그것이 `/docker-entrypoint.d/*.sh` 를 `set -e` 로
# 돌리므로, 위 스크립트가 실패하면 **컨테이너가 뜨지 않는다** — 설정이 없을 때 요구되는 동작이다.
