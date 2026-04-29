import axios, { AxiosError } from 'axios'
import { message } from 'antd'
import { useAuthStore } from '../stores/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

client.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

/**
 * 统一收口认证失效和接口错误提示，避免各页面散落重复的异常处理逻辑。
 */
client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearSession()

      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }

    const errorMessage = error.response?.data?.message ?? error.message ?? '请求失败，请稍后重试'

    message.error(errorMessage)
    return Promise.reject(error)
  },
)
