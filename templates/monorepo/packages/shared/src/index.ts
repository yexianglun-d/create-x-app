export interface User {
  id: string
  name: string
  email: string
}

export interface ApiResponse<T> {
  code: number
  data: T
  message: string
}
