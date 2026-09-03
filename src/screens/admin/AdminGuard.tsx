import { Navigate, Outlet } from 'react-router-dom'

import { hasAdminStepUp } from '../../api/endpoints/admin'
import { ROUTES } from '../../routes/routes'

/**
 * 관리자 구역의 진입 가드.
 *
 * **승격이 없으면 관리자 화면을 그리지 않는다.** 서버는 이미 세 조건을 AND 로 거는데
 * (backend S-4) 화면을 먼저 그려 두면 관리자 레이아웃이 열린 뒤 모든 요청이 `403` 으로
 * 떨어지고, 사용자는 무엇이 잘못됐는지 알 수 없다. 문을 여기서 한 번 닫는 편이 낫다.
 *
 * **관리자 여부를 화면이 추측하지 않는다.** 여기서 묻는 것은 *역할이 무엇인가* 가 아니라
 * *지금 보낼 승격을 들고 있는가* 하나다 — 그 값은 서버의 `verify` · `confirm` 만이 발급한다.
 * 계약에 관리자 여부를 알려 주는 경로가 없으므로, 없는 사실을 만들어 내지 않는다.
 */
export function AdminGuard() {
  if (!hasAdminStepUp()) {
    return <Navigate to={ROUTES.adminAuth} replace />
  }
  return <Outlet />
}
