import { useEffect, useState } from 'react'
import type { RequestState } from '../types'

interface UseRequestOptions {
  immediate?: boolean
}

/**
 * 以最小心智负担封装 loading / data / error 状态，便于页面快速接入异步请求。
 */
export function useRequest<T>(
  requester: () => Promise<T>,
  options: UseRequestOptions = {},
) {
  const [state, setState] = useState<RequestState<T>>({
    loading: false,
    data: null,
    error: null,
  })

  async function execute() {
    setState((previousState) => ({
      ...previousState,
      loading: true,
      error: null,
    }))

    try {
      const data = await requester()

      setState({
        loading: false,
        data,
        error: null,
      })

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '请求失败'

      setState({
        loading: false,
        data: null,
        error: errorMessage,
      })

      throw error
    }
  }

  useEffect(() => {
    if (!options.immediate) {
      return
    }

    void execute()
  }, [])

  return {
    ...state,
    execute,
  }
}
