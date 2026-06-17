import {
  CheckSquareOutlined,
  DashboardOutlined,
  ProjectOutlined,
} from '@ant-design/icons'
import { lazy } from 'react'
import type { AppRouteDefinition } from '../types'

const DashboardPage = lazy(() => import('../pages/Dashboard'))

export const privateRouteDefinitions = [
  {
    key: 'dashboard',
    path: '/',
    title: '工作台',
    description: '总览项目进展、待办任务和关键指标。',
    icon: <DashboardOutlined />,
    component: DashboardPage,
  },
  {
    key: 'tasks',
    path: '/tasks',
    title: '任务队列',
    description: '按优先级查看和处理待办事项。',
    icon: <CheckSquareOutlined />,
    component: DashboardPage,
  },
  {
    key: 'projects',
    path: '/projects',
    title: '项目管理',
    description: '查看项目阶段、负责人和截止时间。',
    icon: <ProjectOutlined />,
    component: DashboardPage,
  },
] satisfies AppRouteDefinition[]
