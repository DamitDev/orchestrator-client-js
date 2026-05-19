export interface ErrorEvent {
  id: string
  createdAt: string
  severity: string
  source: string
  taskId: string | null
  workflowId: string | null
  errorCode: string | null
  exceptionType: string | null
  message: string
  holderId: string | null
  requestId: string | null
}

export interface ErrorEventDetail extends ErrorEvent {
  traceback: string | null
  context: Record<string, unknown> | null
}

export interface ErrorStatsResult {
  total: number
  bySeverity: Record<string, number>
  bySource: Record<string, number>
  byWorkflowId: Record<string, number>
  byExceptionType: Record<string, number>
  topTaskIds: Record<string, unknown>[]
  topHolderIds: Record<string, unknown>[]
}

export interface ErrorCountResult {
  count: number
}

export interface ErrorPurgeResult {
  deleted: number
}
