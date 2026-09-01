import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * 개발 서버 설정.
 *
 * 프록시를 두지 않는다. 백엔드가 CORS 를 정식으로 열었으므로(backend #248) 브라우저가 직접
 * 부르고, 그것이 운영에서 일어나는 일과 같다. 프록시로 덮으면 dev 에서만 통하고 배포에서
 * 터진다 — 그 문제를 배포까지 미루지 않는다.
 *
 * 포트를 5173 에 고정한다. 백엔드의 app.cors.allowed-origins 가 이 오리진을 알고 있어야 하며,
 * 포트가 매번 바뀌면 그 목록이 맞을 수 없다.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
})
