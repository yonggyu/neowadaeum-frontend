import { API_BASE_URL } from './api/config'

/**
 * 스캐폴드의 자리 표시자.
 *
 * 화면은 디자인(개발 순서 ⑨) 이후에 만든다. 지금 여기 있는 것은 **빌드가 서고 계약 설정이
 * 읽힌다**는 사실 하나뿐이며, 그럴듯한 목업을 미리 넣지 않는다 — 디자인 없이 만든 화면은
 * 디자인이 나오면 전부 다시 만들게 되고, 그 사이에 누군가는 그것을 확정된 것으로 읽는다.
 */
export function App() {
  return (
    <main>
      <h1>너와다음</h1>
      <p>프론트엔드 스캐폴드입니다. 화면은 디자인 이후에 붙습니다.</p>
      <dl>
        <dt>API</dt>
        <dd>
          <code>{API_BASE_URL}</code>
        </dd>
      </dl>
    </main>
  )
}
