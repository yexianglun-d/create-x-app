export interface TaskItem {
  id: string
  title: string
  assignee: string
  status: 'todo' | 'in_progress' | 'review' | 'done'
  priority: 'high' | 'medium' | 'low'
  description: string
  dueAt: string
}

export interface DashboardSummary {
  totalTasks: number
  inProgress: number
  highPriority: number
}

export interface ApiResponse<T> {
  code: number
  data: T
  message: string
}
