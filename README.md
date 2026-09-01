# 너와다음 — Frontend

사용자가 선택지로 이야기를 이끄는 **AI 인터랙티브 스토리 플랫폼**의 프론트엔드다.
백엔드는 별도 레포다 — [`neowadaeum-backend`](https://github.com/yonggyu/neowadaeum-backend).

**Vite + React + TypeScript (SPA).**

## 왜 SPA 인가

백엔드가 **쿠키를 쓰지 않고 Bearer 토큰만** 돌려준다. 토큰이 브라우저에만 있으므로 **서버가
사용자별 데이터를 그릴 수 없다** — SSR 을 택하면 인증이 걸린 화면마다 클라이언트 렌더로
빠지고, 그러면 SSR 이 얻는 것이 거의 없다. 대가는 공개 작품 페이지의 SEO 이며, 그것이 실제로
필요해질 때 다시 본다.

## 로컬 실행

```bash
cp .env.example .env      # 값은 .env 에만 둔다. 커밋하지 않는다
npm install
npm run dev               # http://localhost:5173
```

**포트는 5173 에 고정돼 있다.** 백엔드의 `app.cors.allowed-origins` 가 이 오리진을 알고 있어야
하며, 포트가 매번 바뀌면 그 목록이 맞을 수 없다.

### 백엔드를 함께 띄우려면

백엔드 레포에서 `dev` 프로파일로 띄운다. **AI 키 없이 돈다** — `FixedStoryProvider` 가 정해진
응답을 돌려주므로 턴 파이프라인이 그대로 동작한다. `.env` 의 `CORS_ALLOWED_ORIGINS` 에
`http://localhost:5173` 이 있어야 한다.

> **로그인은 실제 Google OAuth 를 지난다.** dev 인증 우회는 백엔드에서 제거됐고 그 제거를
> 지키는 테스트가 있다. 인증이 걸린 화면을 진행하려면 **localhost 리디렉션이 등록된 Google
> OAuth 앱**이 먼저 있어야 한다.

## 계약이 진실의 원천이다

API 타입을 손으로 적지 않는다. 백엔드의 `docs/openapi.yaml` 에서 만든다.

```bash
npm run api:types         # → src/api/schema.d.ts (커밋하지 않는다 — 산출물이다)
```

기본 경로는 `../neowadaeum-backend/docs/openapi.yaml` 이다. 두 레포를 나란히 클론했다면 그대로
쓰면 되고, 아니면 `.env` 의 `OPENAPI_SOURCE` 를 고친다.

**계약과 화면이 어긋나면 계약이 이긴다.** 계약이 틀렸다고 판단되면 프론트에서 우회하지 말고
백엔드 레포에 이슈를 연다 — 우회는 두 곳에 서로 다른 진실을 만든다.

## 명령

```bash
npm run dev         # 개발 서버
npm run build       # 타입 검사 + 번들
npm run typecheck   # 타입만
npm run lint        # ESLint
npm test            # Vitest
npm run api:types   # 계약 → 타입
```

## 브랜치

백엔드와 **같은 구조**다.

```
feat/* → frontend → dev → main → (태그가 릴리스다)
```

- `frontend` — 작업 머지 대상. **직접 푸시하지 않는다**
- `dev` — 두 레포의 통합 지점
- `main` — 릴리스 후보. 공개가 아니다
- 브랜치 이름: `<타입>/#<이슈번호>-<영문-소문자-슬러그>`

CI 잡 이름 셋(`build` · `test` · `gitleaks`)은 **브랜치 보호의 필수 status check 이름**이다.
백엔드와 같은 이름을 쓰므로 두 레포의 보호 설정을 한 규칙으로 읽을 수 있다. **이름을 바꾸면
보호가 조용히 헐거워진다.**

## 아직 없는 것

- **디자인.** 화면은 디자인 이후에 만든다. `src/App.tsx` 는 자리 표시자이며 그럴듯한 목업을
  미리 넣지 않았다 — 디자인 없이 만든 화면은 디자인이 나오면 전부 다시 만들게 되고, 그
  사이에 누군가는 그것을 확정된 것으로 읽는다
- **lockfile.** 첫 로컬 `npm install` 에서 생성해 커밋한다. 그 뒤 CI 의 `npm install` 을
  `npm ci` 로 바꾼다 — **그것이 진짜 고정이다**

## 보안

- **시크릿을 소스에 커밋하지 않는다.** 실제 값은 `.env` 에만. 이미 푸시된 자격 증명은
  삭제가 아니라 **로테이션**이다
- **`${VAR:기본값}` 패턴을 쓰지 않는다.** 값이 없으면 실패시킨다 (`src/api/config.ts`)
- **토큰을 `localStorage` 에 두지 않는다.** 지금은 메모리에만 있다 — XSS 하나로 토큰이 나가는
  경로를 기본값으로 만들지 않는다
- **이 레포는 공개다.** 커밋·이슈·PR·주석이 즉시 세계에 읽힌다. 운영 도메인·계정 체계·
  세이프티 우회 방법을 적지 않는다
