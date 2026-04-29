import { ref } from 'vue'

/**
 * 统一封装移动端页面最常见的 loading / data / error 状态，避免每个视图重复写异步样板代码。
 */
export function useRequest<T>(requester: () => Promise<T>) {
  const loading = ref(false)
  const data = ref<T | null>(null)
  const error = ref('')

  async function run() {
    loading.value = true
    error.value = ''

    try {
      data.value = await requester()
      return data.value
    } catch (requestError) {
      error.value = requestError instanceof Error ? requestError.message : '请求失败'
      throw requestError
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    data,
    error,
    run,
  }
}
