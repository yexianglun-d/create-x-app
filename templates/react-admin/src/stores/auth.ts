import { create } from 'zustand'
import type { UserProfile } from '../types'

export const AUTH_STORAGE_KEY = 'react-admin-auth'

interface AuthState {
  token: string | null
  user: UserProfile | null
  setSession: (token: string, user: UserProfile) => void
  clearSession: () => void
}

interface PersistedSession {
  token: string
  user: UserProfile
}

function readPersistedSession(): PersistedSession | null {
  if (typeof window === 'undefined') {
    return null
  }

  const cachedSession = window.localStorage.getItem(AUTH_STORAGE_KEY)

  if (!cachedSession) {
    return null
  }

  try {
    return JSON.parse(cachedSession) as PersistedSession
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

function persistSession(session: PersistedSession | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

/**
 * 统一维护登录态，保证路由守卫、请求拦截器和页面展示共享同一份 session 数据。
 */
export const useAuthStore = create<AuthState>((set) => {
  const initialSession = readPersistedSession()

  return {
    token: initialSession?.token ?? null,
    user: initialSession?.user ?? null,
    setSession(token, user) {
      persistSession({ token, user })
      set({ token, user })
    },
    clearSession() {
      persistSession(null)
      set({ token: null, user: null })
    },
  }
})
