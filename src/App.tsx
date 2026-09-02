import { BrowserRouter } from 'react-router-dom'

import { AppRoutes } from './routes/router'

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
