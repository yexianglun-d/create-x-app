import {
  DashboardOutlined,
  NotificationOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { lazy } from 'react'
import type { AppRouteDefinition } from '../types'

const DashboardPage = lazy(() => import('../pages/Dashboard'))

export const privateRouteDefinitions = [
  {
    key: 'dashboard',
    path: '/',
    title: '仪表盘',
    description: '总览运营关键指标、接口状态和待办提醒。',
    icon: <DashboardOutlined />,
    component: DashboardPage,
  },
  {
    key: 'operations',
    path: '/operations',
    title: '运营看板',
    description: '示例菜单，用于扩展订单、内容和活动模块。',
    icon: <NotificationOutlined />,
    component: DashboardPage,
  },
  {
    key: 'team',
    path: '/team',
    title: '团队权限',
    description: '示例菜单，用于扩展角色、组织和权限矩阵。',
    icon: <TeamOutlined />,
    component: DashboardPage,
  },
] satisfies AppRouteDefinition[]
