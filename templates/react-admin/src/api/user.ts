import type { ApiResponse, UserProfile } from '../types'
import { client } from './client'

export async function fetchCurrentUser() {
  const response = await client.get<ApiResponse<UserProfile>>('/user/me')
  return response.data.data
}
