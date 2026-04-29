import { Spin } from 'antd'
import { Suspense, lazy } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import { useAuthStore } from '../stores/auth'
import type { LazyPageComponent } from '../types'
import { privateRouteDefinitions } from './routes'

const LoginPage = lazy(() => import('../pages/Login'))
const NotFoundPage = lazy(() => import('../pages/NotFound'))

function PageFallback() {
  return (
    <div className="admin-app" style={{ display: 'grid', minHeight: '100vh', placeItems: 'center' }}>
      <Spin size="large" />
    </div>
  )
}

function renderLazyPage(PageComponent: LazyPageComponent) {
  return (
    <Suspense fallback={<PageFallback />}>
      <PageComponent />
    </Suspense>
  )
}

/**
 * 所有后台页面统一经过登录态校验，未登录时只允许进入 `/login`。
 */
function RequireAuth() {
  const token = useAuthStore((state) => state.token)

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={renderLazyPage(LoginPage)} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<MainLayout />}>
          {privateRouteDefinitions.map((routeDefinition) => {
            const normalizedPath = routeDefinition.path === '/'
              ? ''
              : routeDefinition.path.replace(/^\//, '')

            return normalizedPath === ''
              ? (
                  <Route
                    key={routeDefinition.key}
                    index
                    element={renderLazyPage(routeDefinition.component)}
                  />
                )
              : (
                  <Route
                    key={routeDefinition.key}
                    path={normalizedPath}
                    element={renderLazyPage(routeDefinition.component)}
                  />
                )
          })}
        </Route>
      </Route>
      <Route path="*" element={renderLazyPage(NotFoundPage)} />
    </Routes>
  )
}
