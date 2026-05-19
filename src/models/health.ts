export interface HealthStatus {
  status: string
  message: string
  version: string
}

export interface ComponentHealth {
  connected: boolean | null
  running: boolean | null
  latencyMs: number | null
}

export interface HealthDetail extends HealthStatus {
  components: Record<string, ComponentHealth>
}

export interface ReadinessCheck {
  ok: boolean
  detail: string | null
}

export interface ReadinessResult {
  ready: boolean
  reason: string | null
  isStartupComplete: boolean
  isShuttingDown: boolean
  checks: Record<string, ReadinessCheck>
}

export interface LockStatus {
  name: string
  isLeader: boolean
  isRunning: boolean
  ttlSeconds: number
  token: string | null
}

export interface LeaderStatus {
  holderId: string
  locks: LockStatus[]
}

export interface MetricSnapshot {
  uptimeSeconds: number | null
  activeTasks: number | null
  openTasks: number | null
  llmGeneratedTokens: number | null
  llmAvgResponseTimeSec: number | null
  llmRequestsPerMinute: number | null
  avgTaskSolutionTimeSec: number | null
}
