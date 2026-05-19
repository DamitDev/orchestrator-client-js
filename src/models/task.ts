/** Pagination metadata returned by paginated list endpoints. */
export interface Pagination {
  currentPage: number
  perPage: number
  totalItems: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

/** Core task summary — returned in list endpoints. */
export interface TaskSummary {
  id: string
  status: string
  workflowId: string
  iteration: number
  maxIterations: number
  goalPrompt: string
  result: string
  resultLocalized: string | null
  approvalReason: string
  ticketId: string | null
  availableTools: string[] | null
  insight: string | null
  insightLocalized: string | null
  createdAt: string
  updatedAt: string
  pendingTranslationsForLocales?: string[] | null
}

/** Per-task feature toggles set at creation time. */
export interface TaskOptions {
  disableSummaries: boolean
  disableTranslation: boolean
}

/** Full task status including fields returned by GET /task/status. */
export interface TaskDetail extends TaskSummary {
  subtaskIds: string[]
  workflowData: Record<string, unknown> | null
  options: Record<string, unknown> | null
}

export interface TaskListResult {
  tasks: TaskSummary[]
  pagination: Pagination
}

export interface TaskCreateResponse {
  taskId: string
  status: string
}

export interface TaskCancelResponse {
  taskId: string
  killed: boolean
}

export interface VSATaskCreateResponse extends TaskCreateResponse {}

export interface TaskDeleteResult {
  deletedTasks: string[]
  failedTasks: string[]
  totalDeleted: number
  totalFailed: number
}
