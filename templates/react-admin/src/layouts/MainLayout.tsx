import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Button,
  Grid,
  Layout,
  Menu,
} from 'antd'
import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAppCopy } from '../hooks/useAppCopy'
import { privateRouteDefinitions } from '../router/routes'
import { useAuthStore } from '../stores/auth'

const { Content, Header, Sider } = Layout

function resolveSelectedMenuKey(pathname: string) {
  const matchedRoute = [...privateRouteDefinitions]
    .sort((left, right) => right.path.length - left.path.length)
    .find((routeDefinition) => routeDefinition.path === '/'
      ? pathname === '/'
      : pathname.startsWith(routeDefinition.path))

  return matchedRoute?.path ?? '/'
}

export default function MainLayout() {
  const screens = Grid.useBreakpoint()
  const navigate = useNavigate()
  const location = useLocation()
  const { copy } = useAppCopy()
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(!screens.lg)
  }, [screens.lg])

  return (
    <Layout className="admin-shell">
      <Sider
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={280}
        collapsedWidth={88}
        className="admin-sider"
      >
        <div className="admin-brand">
          <div className="admin-brand-mark">OP</div>
          {!collapsed ? (
            <div className="admin-brand-text">
              <p className="admin-brand-title">{copy('brand.name')}</p>
              <p className="admin-brand-desc">{copy('brand.desc')}</p>
            </div>
          ) : null}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[resolveSelectedMenuKey(location.pathname)]}
          className="admin-menu"
          items={privateRouteDefinitions.map((routeDefinition) => ({
            key: routeDefinition.path,
            icon: routeDefinition.icon,
            label: routeDefinition.title,
            onClick() {
              navigate(routeDefinition.path)
            },
          }))}
        />
      </Sider>

      <Layout className="admin-content-layout">
        <Header className="admin-header">
          <div className="admin-header-card">
            <div className="admin-header-copy">
              <h1 className="admin-header-title">{copy('shell.title')}</h1>
              <p className="admin-header-desc">{copy('shell.desc')}</p>
            </div>

            <div className="admin-user-panel">
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed((previousState) => !previousState)}
              />
              <Avatar size={44} style={{ background: '#2563eb' }}>
                {user?.name.slice(0, 1) ?? 'A'}
              </Avatar>
              <div className="admin-user-meta">
                <p className="admin-user-name">{user?.name ?? '运营负责人'}</p>
                <p className="admin-user-role">{user?.role ?? '运营负责人'}</p>
              </div>
              <Button
                icon={<LogoutOutlined />}
                onClick={() => {
                  clearSession()
                  navigate('/login', { replace: true })
                }}
              >
                退出
              </Button>
            </div>
          </div>
        </Header>

        <Content className="admin-content">
          <div className="admin-content-inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
