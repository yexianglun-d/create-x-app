import type {
  ComponentType,
  LazyExoticComponent,
  ReactNode,
} from 'react'

export interface UserProfile {
  id: string
  name: string
  email: string
  role: string
}

export interface ApiResponse<T> {
  code: number
  data: T
  message: string
}

export interface RequestState<T> {
  loading: boolean
  data: T | null
  error: string | null
}

export interface LoginFormValues {
  username: string
  password: string
}

export interface NavRouteDefinition {
  key: string
  path: string
  title: string
  description: string
  icon: ReactNode
}

export type LazyPageComponent = LazyExoticComponent<ComponentType>

export interface AppRouteDefinition extends NavRouteDefinition {
  component: LazyPageComponent
}
