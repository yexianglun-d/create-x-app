import {
  CheckSquareOutlined,
  DashboardOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { lazy } from 'react'
import type { AppRouteDefinition } from '../types'

const DashboardPage = lazy(() => import('../pages/Dashboard'))

export const privateRouteDefinitions = [
  {
    key: 'dashboard',
    path: '/',
    title: '工作台',
    description: '总览客户跟进、服务工单和审批任务。',
    icon: <DashboardOutlined />,
    component: DashboardPage,
  },
  {
    key: 'tasks',
    path: '/tasks',
    title: '任务队列',
    description: '按优先级处理待办和审批。',
    icon: <CheckSquareOutlined />,
    component: DashboardPage,
  },
  {
    key: 'customers',
    path: '/customers',
    title: '客户跟进',
    description: '维护客户阶段、负责人和下一步动作。',
    icon: <TeamOutlined />,
    component: DashboardPage,
  },
] satisfies AppRouteDefinition[]
