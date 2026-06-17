export interface CustomerAction {
  id: string
  customerName: string
  owner: string
  stage: 'new' | 'contacted' | 'proposal' | 'contract'
  priority: 'high' | 'medium' | 'low'
  nextAction: string
  dueAt: string
}

export interface WorkspaceSummary {
  openActions: number
  highPriorityActions: number
  serviceTickets: number
}

export interface ApiResponse<T> {
  code: number
  data: T
  message: string
}
