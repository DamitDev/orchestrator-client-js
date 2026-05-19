/**
 * OrchestratorAsync — async REST API wrapper for the DAMIT AIOps Orchestrator.
 *
 * Provides a complete mapping of the orchestrator's HTTP endpoints using
 * native fetch with automatic retry (exponential backoff), typed responses,
 * and configurable auth via bearer token or callback.
 *
 * Usage:
 *
 *   const client = new OrchestratorAsync({ baseUrl: "http://localhost:8080" });
 *   const tasks = await client.listTasks({ workflowId: "proactive" });
 *   for (const t of tasks.tasks) {
 *     console.log(t.id, t.status);
 *   }
 *   await client.close();
 */

import type {
  AuthConfig,
  AttachmentUploadResponse,
  CompactionEvent,
  ConfigurationStatus,
  ConversationResult,
  ErrorCountResult,
  ErrorEventDetail,
  ErrorPurgeResult,
  ErrorStatsResult,
  HealthDetail,
  HealthStatus,
  LeaderStatus,
  MatrixConversationResult,
  Message,
  MessageTranslation,
  MessageTranslationsResult,
  MetricSnapshot,
  MioContext,
  Pagination,
  ReadinessResult,
  SlotsStatus,
  SuccessResponse,
  SummaryWorkerStatus,
  SystemStatus,
  TaskCreateResponse,
  TaskDeleteResult,
  TaskDetail,
  TaskHandlerStatus,
  TaskHandlerStatusLocal,
  TaskJournal,
  TaskListResult,
  TaskSummary,
  TokenWorkerStatus,
  ToolInfo,
  ToolsListResult,
  VSATaskCreateResponse,
  WebSocketStatus,
  WorkflowStates,
} from "./models/index.js"
import {
  OrchestratorAPIError,
  OrchestratorAuthError,
  OrchestratorConnectionError,
  OrchestratorNotFoundError,
} from "./errors.js"

const RETRY_BACKOFF_BASE = 500
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_RETRIES = 3

// ---------------------------------------------------------------------------
// Internal helpers — build typed objects from raw API response data
// ---------------------------------------------------------------------------

function buildPagination(data: Record<string, unknown>): Pagination {
  const p = (data.pagination ?? {}) as Record<string, unknown>
  return {
    currentPage: (p.currentPage ?? 1) as number,
    perPage: (p.perPage ?? 25) as number,
    totalItems: (p.totalItems ?? 0) as number,
    totalPages: (p.totalPages ?? 1) as number,
    hasNext: (p.hasNext ?? false) as boolean,
    hasPrev: (p.hasPrev ?? false) as boolean,
  }
}

function buildTaskSummary(t: Record<string, unknown>): TaskSummary {
  return {
    id: (t.id ?? "") as string,
    status: (t.status ?? "") as string,
    workflowId: (t.workflowId ?? t.workflow_id ?? "") as string,
    iteration: (t.iteration ?? 0) as number,
    maxIterations: (t.maxIterations ?? t.max_iterations ?? 0) as number,
    goalPrompt: (t.goalPrompt ?? t.goal_prompt ?? "") as string,
    result: (t.result ?? "") as string,
    resultLocalized: (t.resultLocalized ?? t.result_localized ?? null) as string | null,
    approvalReason: (t.approvalReason ?? t.approval_reason ?? "") as string,
    ticketId: (t.ticketId ?? t.ticket_id ?? null) as string | null,
    availableTools: (t.availableTools ?? t.available_tools ?? null) as string[] | null,
    insight: (t.insight ?? null) as string | null,
    insightLocalized: (t.insightLocalized ?? t.insight_localized ?? null) as string | null,
    createdAt: (t.createdAt ?? t.created_at ?? "") as string,
    updatedAt: (t.updatedAt ?? t.updated_at ?? "") as string,
    pendingTranslationsForLocales: (t.pendingTranslationsForLocales ?? t.pending_translations_for_locales ?? null) as string[] | null | undefined,
  }
}

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export interface OrchestratorClientOptions {
  /** Base URL of the orchestrator (e.g. "http://localhost:8080"). */
  baseUrl?: string
  /** Optional static bearer token. */
  apiKey?: string
  /** Async function that returns a bearer token (called on each request). */
  getToken?: () => string | Promise<string>
  /** Request timeout in milliseconds (default: 30000). */
  timeoutMs?: number
  /** Max retry attempts on transient failures (default: 3). */
  maxRetries?: number
  /**
   * Custom fetch implementation override.
   *
   * Use this to inject a fetch that ignores SSL errors (self-signed certs):
   *
   *   new Orchestrator({
   *     fetch: await createInsecureFetch(),
   *   })
   *
   * When not provided, `globalThis.fetch` is used.
   */
  fetch?: typeof globalThis.fetch
  /**
   * Allow self-signed / invalid SSL certificates.
   *
   * When true and no custom `fetch` is provided, creates an internal fetch
   * that uses Node.js `https.Agent` with `rejectUnauthorized: false`.
   * Only works in Node.js; ignored in browsers.
   */
  insecure?: boolean
}

// ---------------------------------------------------------------------------
// OrchestratorAsync
// ---------------------------------------------------------------------------

export class OrchestratorAsync {
  protected _baseUrl: string
  protected _apiKey: string | undefined
  protected _getToken: (() => string | Promise<string>) | undefined
  protected _timeoutMs: number
  protected _maxRetries: number
  protected _fetch: typeof globalThis.fetch
  protected _abortController: AbortController | null = null

  constructor(opts: OrchestratorClientOptions = {}) {
    this._baseUrl = (opts.baseUrl ?? "http://localhost:8080").replace(/\/+$/, "")
    this._apiKey = opts.apiKey
    this._getToken = opts.getToken
    this._timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this._maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES
    this._fetch = opts.fetch ?? globalThis.fetch
    if (opts.insecure && !opts.fetch && typeof process !== "undefined" && process.versions?.node) {
      // Lazy-init insecure fetch — requires async import of Node.js modules
      // The actual switch happens at request time since we can't await here
      this._insecure = true
    }
  }

  protected _insecure = false

  async close(): Promise<void> {
    this._abortController?.abort()
  }

  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  protected _makeUrl(path: string): string {
    return `${this._baseUrl}${path}`
  }

  protected async _resolveHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {}
    if (this._apiKey) {
      headers["Authorization"] = `Bearer ${this._apiKey}`
    } else if (this._getToken) {
      const token = await this._getToken()
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }
    }
    return headers
  }

  protected async _request(
    method: string,
    path: string,
    opts?: {
      jsonBody?: unknown
      params?: Record<string, string | number | boolean | undefined>
      headers?: Record<string, string>
      rawResponse?: boolean
      signal?: AbortSignal
    },
  ): Promise<Response | unknown> {
    const url = new URL(this._makeUrl(path))
    if (opts?.params) {
      for (const [key, value] of Object.entries(opts.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    const extraHeaders = await this._resolveHeaders()
    const mergedHeaders: Record<string, string> = {
      ...extraHeaders,
      ...(opts?.headers ?? {}),
    }
    if (opts?.jsonBody !== undefined && !mergedHeaders["Content-Type"]) {
      mergedHeaders["Content-Type"] = "application/json"
    }

    for (let attempt = 1; attempt <= this._maxRetries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this._timeoutMs)
        const signal = opts?.signal
          ? combineSignals(opts.signal, controller.signal)
          : controller.signal

        const response = await this._fetch(url.toString(), {
          method,
          headers: mergedHeaders,
          body: opts?.jsonBody !== undefined ? JSON.stringify(opts.jsonBody) : undefined,
          signal,
        })

        clearTimeout(timeoutId)

        if (response.status === 401) {
          throw new OrchestratorAuthError(
            `Authentication failed for ${method} ${path}`,
            401,
          )
        }
        if (response.status === 403) {
          throw new OrchestratorAuthError(
            `Access denied for ${method} ${path}`,
            403,
          )
        }
        if (response.status === 404) {
          throw new OrchestratorNotFoundError(
            "resource",
            path,
            `Endpoint returned 404: ${method} ${path}`,
          )
        }

        if (response.status >= 500) {
          if (attempt === this._maxRetries) {
            // Fall through to error handling below
          } else {
            const delay = RETRY_BACKOFF_BASE * 2 ** (attempt - 1)
            console.warn(
              `Server error ${response.status} (attempt ${attempt}/${this._maxRetries}), retrying in ${delay}ms`,
            )
            await sleep(delay)
            continue
          }
        }

        if (opts?.rawResponse) {
          return response
        }

        if (response.ok) {
          const contentType = response.headers.get("content-type") ?? ""
          if (contentType.includes("application/json")) {
            return response.json() as Promise<unknown>
          }
          return { _text: await response.text() }
        }

        // Error handling
        let errorMessage: string
        let errorCode: string | null = null
        let errorDetails: Record<string, unknown> | null = null
        try {
          const body = (await response.json()) as Record<string, unknown>
          const error = (body.error ?? body) as Record<string, unknown>
          errorCode = (error.code as string) ?? null
          errorMessage = (error.message as string) ?? (await response.text())
          errorDetails = (error.details as Record<string, unknown>) ?? null
        } catch {
          errorMessage = await response.text()
        }

        throw new OrchestratorAPIError(
          errorMessage,
          response.status,
          errorCode,
          errorDetails ?? undefined,
        )
      } catch (err) {
        if (err instanceof OrchestratorAPIError || err instanceof OrchestratorAuthError || err instanceof OrchestratorNotFoundError) {
          throw err
        }
        if (err instanceof OrchestratorConnectionError) {
          throw err
        }
        if (err instanceof DOMException && err.name === "AbortError") {
          if (attempt === this._maxRetries) {
            throw new OrchestratorConnectionError(
              `Request timed out after ${this._timeoutMs}ms (${this._maxRetries} attempts): ${method} ${path}`,
            )
          }
          const delay = RETRY_BACKOFF_BASE * 2 ** (attempt - 1)
          console.warn(
            `Request timed out (attempt ${attempt}/${this._maxRetries}), retrying in ${delay}ms`,
          )
          await sleep(delay)
          continue
        }
        if (err instanceof TypeError) {
          // fetch network errors are TypeErrors
          if (attempt === this._maxRetries) {
            throw new OrchestratorConnectionError(
              `Orchestrator unreachable after ${this._maxRetries} attempts: ${(err as Error).message}`,
            )
          }
          const delay = RETRY_BACKOFF_BASE * 2 ** (attempt - 1)
          console.warn(
            `Request failed (attempt ${attempt}/${this._maxRetries}), retrying in ${delay}ms: ${(err as Error).message}`,
          )
          await sleep(delay)
          continue
        }
        throw err
      }
    }

    throw new OrchestratorConnectionError(
      `Request failed after ${this._maxRetries} attempts: ${method} ${path}`,
    )
  }

  protected async _get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return (await this._request("GET", path, { params })) as T
  }

  protected async _post<T>(path: string, body?: unknown): Promise<T> {
    return (await this._request("POST", path, { jsonBody: body })) as T
  }

  protected async _put<T>(path: string, body?: unknown): Promise<T> {
    return (await this._request("PUT", path, { jsonBody: body })) as T
  }

  protected async _delete<T>(path: string): Promise<T> {
    return (await this._request("DELETE", path)) as T
  }

  // ------------------------------------------------------------------
  // Tasks
  // ------------------------------------------------------------------

  async listTasks(params?: {
    workflowId?: string
    status?: string
    limit?: number
    offset?: number
    sortBy?: string
    sortOrder?: string
  }): Promise<TaskListResult> {
    const data = await this._get<Record<string, unknown>>("/tasks", {
      workflow_id: params?.workflowId,
      status: params?.status,
      limit: params?.limit,
      offset: params?.offset,
      sort_by: params?.sortBy,
      sort_order: params?.sortOrder,
    })
    const tasks = ((data.tasks ?? []) as Record<string, unknown>[]).map(buildTaskSummary)
    return { tasks, pagination: buildPagination(data) }
  }

  async createTask(params: {
    workflowId: string
    goalPrompt: string
    maxIterations?: number
    options?: Record<string, boolean>
    ticketId?: string
    title?: string
    modelId?: string
  }): Promise<TaskCreateResponse> {
    const data = await this._post<Record<string, unknown>>("/tasks", {
      workflow_id: params.workflowId,
      goal_prompt: params.goalPrompt,
      max_iterations: params.maxIterations,
      options: params.options,
      ticket_id: params.ticketId,
      title: params.title,
      model_id: params.modelId,
    })
    return {
      taskId: (data.taskId ?? data.task_id ?? "") as string,
      status: (data.status ?? "") as string,
    }
  }

  async getTaskStatus(taskId: string): Promise<TaskDetail> {
    const data = await this._get<Record<string, unknown>>(`/tasks/${taskId}`)
    return {
      ...buildTaskSummary(data),
      subtaskIds: (data.subtaskIds ?? data.subtask_ids ?? []) as string[],
      workflowData: (data.workflowData ?? data.workflow_data ?? null) as Record<string, unknown> | null,
      options: (data.options ?? null) as Record<string, unknown> | null,
    }
  }

  async getTaskConversation(taskId: string): Promise<ConversationResult> {
    const data = await this._get<Record<string, unknown>>(`/tasks/${taskId}/conversation`)
    return {
      taskId: (data.taskId ?? data.task_id ?? taskId) as string,
      conversation: ((data.conversation ?? []) as Record<string, unknown>[]).map(
        (m) => m as unknown as Message,
      ),
    }
  }

  async getArchivedMessageContent(taskId: string, messageId: number): Promise<Record<string, unknown>> {
    return this._get<Record<string, unknown>>(
      `/tasks/${taskId}/conversation/messages/${messageId}/archived`,
    )
  }

  async getTaskCompactions(taskId: string): Promise<CompactionEvent[]> {
    const data = await this._get<Record<string, unknown>>(`/tasks/${taskId}/compactions`)
    return (data.compactions ?? []) as CompactionEvent[]
  }

  async getTaskJournal(taskId: string): Promise<TaskJournal> {
    const data = await this._get<Record<string, unknown>>(`/tasks/${taskId}/journal`)
    return {
      taskId: (data.taskId ?? data.task_id ?? taskId) as string,
      exists: (data.exists ?? false) as boolean,
      content: (data.content ?? null) as string | null,
      updatedAt: (data.updated_at ?? data.updatedAt ?? null) as string | null,
      version: (data.version ?? null) as number | null,
      sectionsOverBudget: (data.sections_over_budget ?? data.sectionsOverBudget ?? null) as Record<string, number> | null,
    }
  }

  async cancelTask(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/cancel`)
    return { message: (data.message ?? "") as string }
  }

  async deleteTask(taskId: string): Promise<TaskDeleteResult> {
    const data = await this._delete<Record<string, unknown>>(`/tasks/${taskId}`)
    return {
      deletedTasks: (data.deletedTasks ?? data.deleted_tasks ?? []) as string[],
      failedTasks: (data.failedTasks ?? data.failed_tasks ?? []) as string[],
      totalDeleted: (data.totalDeleted ?? data.total_deleted ?? 0) as number,
      totalFailed: (data.totalFailed ?? data.total_failed ?? 0) as number,
    }
  }

  async deleteTasks(taskIds: string[]): Promise<TaskDeleteResult> {
    const data = await this._post<Record<string, unknown>>("/tasks/delete", { task_ids: taskIds })
    return {
      deletedTasks: (data.deletedTasks ?? data.deleted_tasks ?? []) as string[],
      failedTasks: (data.failedTasks ?? data.failed_tasks ?? []) as string[],
      totalDeleted: (data.totalDeleted ?? data.total_deleted ?? 0) as number,
      totalFailed: (data.totalFailed ?? data.total_failed ?? 0) as number,
    }
  }

  // ------------------------------------------------------------------
  // Attachments
  // ------------------------------------------------------------------

  async uploadAttachment(
    taskId: string,
    file: File | Blob,
    filename?: string,
  ): Promise<AttachmentUploadResponse> {
    const formData = new FormData()
    formData.append("file", file, filename)
    const headers = await this._resolveHeaders()
    // Don't set Content-Type for FormData — browser sets it with boundary
    const response = await this._fetch(this._makeUrl(`/tasks/${taskId}/attachments`), {
      method: "POST",
      headers: { ...headers },
      body: formData,
    })
    if (!response.ok) {
      throw new OrchestratorAPIError(
        `Attachment upload failed: ${response.statusText}`,
        response.status,
      )
    }
    const data = (await response.json()) as Record<string, unknown>
    return {
      id: (data.id ?? "") as string,
      filename: (data.filename ?? "") as string,
      mimeType: (data.mimeType ?? data.mime_type ?? "") as string,
      size: (data.size ?? 0) as number,
      width: (data.width ?? null) as number | null,
      height: (data.height ?? null) as number | null,
      tokenCount: (data.tokenCount ?? data.token_count ?? null) as number | null,
    }
  }

  async downloadAttachment(taskId: string, attachmentId: string): Promise<Blob> {
    const headers = await this._resolveHeaders()
    const response = await this._fetch(this._makeUrl(`/tasks/${taskId}/attachments/${attachmentId}`), {
      headers,
    })
    if (!response.ok) {
      throw new OrchestratorAPIError(
        `Attachment download failed: ${response.statusText}`,
        response.status,
      )
    }
    return response.blob()
  }

  // ------------------------------------------------------------------
  // Interactive workflow
  // ------------------------------------------------------------------

  async sendInteractiveMessage(taskId: string, content: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/interactive/message`, {
      content,
    })
    return { message: (data.message ?? "") as string }
  }

  async markInteractiveComplete(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/interactive/complete`)
    return { message: (data.message ?? "") as string }
  }

  async markInteractiveFailed(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/interactive/failed`)
    return { message: (data.message ?? "") as string }
  }

  async approveInteractiveAction(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/interactive/approve`)
    return { message: (data.message ?? "") as string }
  }

  // ------------------------------------------------------------------
  // Proactive workflow
  // ------------------------------------------------------------------

  async sendProactiveGuide(taskId: string, guide: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/proactive/guide`, {
      guide,
    })
    return { message: (data.message ?? "") as string }
  }

  async respondProactiveHelp(taskId: string, response: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/proactive/respond`, {
      response,
    })
    return { message: (data.message ?? "") as string }
  }

  async approveProactiveAction(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/proactive/approve`)
    return { message: (data.message ?? "") as string }
  }

  // ------------------------------------------------------------------
  // Ticket workflow
  // ------------------------------------------------------------------

  async sendTicketGuide(taskId: string, guide: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/ticket/guide`, {
      guide,
    })
    return { message: (data.message ?? "") as string }
  }

  async respondTicketHelp(taskId: string, response: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/ticket/respond`, {
      response,
    })
    return { message: (data.message ?? "") as string }
  }

  async approveTicketAction(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/ticket/approve`)
    return { message: (data.message ?? "") as string }
  }

  async wakeTicket(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/ticket/wake`)
    return { message: (data.message ?? "") as string }
  }

  // ------------------------------------------------------------------
  // Matrix workflow
  // ------------------------------------------------------------------

  async sendMatrixMessage(taskId: string, content: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/matrix/message`, {
      content,
    })
    return { message: (data.message ?? "") as string }
  }

  async markMatrixComplete(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/matrix/complete`)
    return { message: (data.message ?? "") as string }
  }

  async markMatrixFailed(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/matrix/failed`)
    return { message: (data.message ?? "") as string }
  }

  async approveMatrixAction(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/matrix/approve`)
    return { message: (data.message ?? "") as string }
  }

  async getMatrixConversation(taskId: string): Promise<MatrixConversationResult> {
    const data = await this._get<Record<string, unknown>>(`/tasks/${taskId}/matrix/conversation`)
    return {
      taskId: (data.taskId ?? data.task_id ?? taskId) as string,
      conversation: ((data.conversation ?? []) as Record<string, unknown>[]).map(
        (m) => m as unknown as Message,
      ),
    }
  }

  // ------------------------------------------------------------------
  // VSA workflow
  // ------------------------------------------------------------------

  async createVSATask(params: {
    goalPrompt: string
    title?: string
    modelId?: string
  }): Promise<VSATaskCreateResponse> {
    const data = await this._post<Record<string, unknown>>("/tasks/vsa", {
      goal_prompt: params.goalPrompt,
      title: params.title,
      model_id: params.modelId,
    })
    return {
      taskId: (data.taskId ?? data.task_id ?? "") as string,
      status: (data.status ?? "") as string,
    }
  }

  async sendVSAMessage(taskId: string, content: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/vsa/message`, {
      content,
    })
    return { message: (data.message ?? "") as string }
  }

  async renameVSATask(taskId: string, title: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/vsa/rename`, {
      title,
    })
    return { message: (data.message ?? "") as string }
  }

  async regenerateVSATitle(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/vsa/regenerate-title`)
    return { message: (data.message ?? "") as string }
  }

  async markVSAComplete(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/vsa/complete`)
    return { message: (data.message ?? "") as string }
  }

  async markVSAFailed(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/vsa/failed`)
    return { message: (data.message ?? "") as string }
  }

  async stopVSA(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/vsa/stop`)
    return { message: (data.message ?? "") as string }
  }

  async deleteVSA(taskId: string): Promise<SuccessResponse> {
    const data = await this._delete<Record<string, unknown>>(`/tasks/${taskId}/vsa`)
    return { message: (data.message ?? "") as string }
  }

  async listVSATasks(params?: {
    status?: string
    limit?: number
    offset?: number
  }): Promise<TaskListResult> {
    const data = await this._get<Record<string, unknown>>("/tasks/vsa", {
      status: params?.status,
      limit: params?.limit,
      offset: params?.offset,
    })
    const tasks = ((data.tasks ?? []) as Record<string, unknown>[]).map(buildTaskSummary)
    return { tasks, pagination: buildPagination(data) }
  }

  async searchVSATasks(query: string): Promise<TaskListResult> {
    const data = await this._get<Record<string, unknown>>("/tasks/vsa/search", { q: query })
    const tasks = ((data.tasks ?? []) as Record<string, unknown>[]).map(buildTaskSummary)
    return { tasks, pagination: buildPagination(data) }
  }

  async deleteVSATasksBulk(taskIds: string[]): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>("/tasks/vsa/delete-bulk", {
      task_ids: taskIds,
    })
    return { message: (data.message ?? "") as string }
  }

  // ------------------------------------------------------------------
  // MIO workflow
  // ------------------------------------------------------------------

  async sendMioMessage(taskId: string, content: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/mio/message`, {
      content,
    })
    return { message: (data.message ?? "") as string }
  }

  async approveMioAction(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/mio/approve`)
    return { message: (data.message ?? "") as string }
  }

  async wakeMio(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/mio/wake`)
    return { message: (data.message ?? "") as string }
  }

  async sendMioUserAway(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/mio/user-away`)
    return { message: (data.message ?? "") as string }
  }

  async markMioComplete(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/mio/complete`)
    return { message: (data.message ?? "") as string }
  }

  async markMioFailed(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/mio/failed`)
    return { message: (data.message ?? "") as string }
  }

  async archiveMio(taskId: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/mio/archive`)
    return { message: (data.message ?? "") as string }
  }

  async getMioContext(taskId: string): Promise<MioContext> {
    const data = await this._get<Record<string, unknown>>(`/tasks/${taskId}/mio/context`)
    return {
      taskId: (data.taskId ?? data.task_id ?? taskId) as string,
      currentTokens: (data.currentTokens ?? data.current_tokens ?? 0) as number,
      contextLimit: (data.contextLimit ?? data.context_limit ?? 0) as number,
      usagePercentage: (data.usagePercentage ?? data.usage_percentage ?? 0) as number,
      archivedCount: (data.archivedCount ?? data.archived_count ?? 0) as number,
      activeCount: (data.activeCount ?? data.active_count ?? 0) as number,
    }
  }

  // ------------------------------------------------------------------
  // Tools
  // ------------------------------------------------------------------

  async listTools(): Promise<ToolsListResult> {
    const data = await this._get<Record<string, unknown>>("/tools")
    return {
      tools: ((data.tools ?? data.tools ?? []) as Record<string, unknown>[]).map(
        (t) => t as unknown as ToolInfo,
      ),
      totalTools: (data.totalTools ?? data.total_tools ?? 0) as number,
      servers: (data.servers ?? []) as string[],
    }
  }

  // ------------------------------------------------------------------
  // Debug / Admin
  // ------------------------------------------------------------------

  async getWorkflowStates(): Promise<WorkflowStates> {
    const data = await this._get<Record<string, unknown>>("/debug/workflow-states")
    return {
      validStates: (data.validStates ?? data.valid_states ?? {}) as Record<string, string[]>,
      processableStates: (data.processableStates ?? data.processable_states ?? {}) as Record<string, string[]>,
      waitingStates: (data.waitingStates ?? data.waiting_states ?? {}) as Record<string, string[]>,
      stoppedStates: (data.stoppedStates ?? data.stopped_states ?? {}) as Record<string, string[]>,
      intermediateStates: (data.intermediateStates ?? data.intermediate_states ?? {}) as Record<string, string[]>,
    }
  }

  async updateTaskModels(
    taskId: string,
    models: { agent?: string; orchestrator?: string },
  ): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/models`, {
      agent: models.agent,
      orchestrator: models.orchestrator,
    })
    return { message: (data.message ?? "") as string }
  }

  async updateTaskIteration(
    taskId: string,
    iteration: number,
  ): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/iteration`, {
      iteration,
    })
    return { message: (data.message ?? "") as string }
  }

  async updateTaskWorkflowData(
    taskId: string,
    workflowData: Record<string, unknown>,
  ): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(`/tasks/${taskId}/workflow-data`, {
      workflow_data: workflowData,
    })
    return { message: (data.message ?? "") as string }
  }

  async deleteMessage(taskId: string, messageId: number): Promise<SuccessResponse> {
    const data = await this._delete<Record<string, unknown>>(
      `/tasks/${taskId}/conversation/messages/${messageId}`,
    )
    return { message: (data.message ?? "") as string }
  }

  async deleteMessages(
    taskId: string,
    messageIds: number[],
  ): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(
      `/tasks/${taskId}/conversation/messages/delete`,
      { message_ids: messageIds },
    )
    return { message: (data.message ?? "") as string }
  }

  async updateMessage(
    taskId: string,
    messageId: number,
    update: { content?: string; reasoning?: string },
  ): Promise<SuccessResponse> {
    const data = await this._put<Record<string, unknown>>(
      `/tasks/${taskId}/conversation/messages/${messageId}`,
      update,
    )
    return { message: (data.message ?? "") as string }
  }

  async resetMatrixToPhase(taskId: string, phase: number): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>(
      `/tasks/${taskId}/matrix/reset`,
      { phase },
    )
    return { message: (data.message ?? "") as string }
  }

  async getMessageTranslations(
    taskId: string,
    messageId: number,
    locale?: string,
  ): Promise<MessageTranslationsResult> {
    const params: Record<string, string | number | boolean | undefined> = {}
    if (locale) params.locale = locale
    const data = await this._get<Record<string, unknown>>(
      `/tasks/${taskId}/conversation/messages/${messageId}/translations`,
      params,
    )
    return {
      messageId: (data.messageId ?? data.message_id ?? messageId) as number,
      translations: ((data.translations ?? []) as Record<string, unknown>[]).map(
        (t) => t as unknown as MessageTranslation,
      ),
    }
  }

  // ------------------------------------------------------------------
  // Error events
  // ------------------------------------------------------------------

  async listErrors(params?: {
    since?: string
    severity?: string
    source?: string
    limit?: number
    offset?: number
  }): Promise<ErrorEventDetail[]> {
    const queryParams: Record<string, string | number | boolean | undefined> = {}
    if (params?.since) queryParams.since = params.since
    if (params?.severity) queryParams.severity = params.severity
    if (params?.source) queryParams.source = params.source
    if (params?.limit) queryParams.limit = params.limit
    if (params?.offset) queryParams.offset = params.offset

    const data = await this._get<Record<string, unknown>>("/errors", queryParams)
    return ((data.errors ?? []) as Record<string, unknown>[]).map(
      (e) => e as unknown as ErrorEventDetail,
    )
  }

  async getErrorDetail(errorId: string): Promise<ErrorEventDetail> {
    return this._get<ErrorEventDetail>(`/errors/${errorId}`)
  }

  async getErrorStats(since?: string): Promise<ErrorStatsResult> {
    const params: Record<string, string | number | boolean | undefined> = {}
    if (since) params.since = since
    return this._get<ErrorStatsResult>("/errors/stats", params)
  }

  async countErrors(since?: string): Promise<ErrorCountResult> {
    const params: Record<string, string | number | boolean | undefined> = {}
    if (since) params.since = since
    return this._get<ErrorCountResult>("/errors/count", params)
  }

  async purgeErrors(): Promise<ErrorPurgeResult> {
    return this._delete<ErrorPurgeResult>("/errors")
  }

  // ------------------------------------------------------------------
  // Health / Metrics
  // ------------------------------------------------------------------

  async health(): Promise<HealthStatus> {
    return this._get<HealthStatus>("/health")
  }

  async healthDetailed(): Promise<HealthDetail> {
    return this._get<HealthDetail>("/health/detail")
  }

  async ready(): Promise<ReadinessResult> {
    return this._get<ReadinessResult>("/ready")
  }

  async healthLeader(): Promise<LeaderStatus> {
    return this._get<LeaderStatus>("/leader")
  }

  async getMetrics(types?: string): Promise<MetricSnapshot> {
    const params: Record<string, string | number | boolean | undefined> = {}
    if (types) params.types = types
    return this._get<MetricSnapshot>("/metrics", params)
  }

  // ------------------------------------------------------------------
  // Configuration
  // ------------------------------------------------------------------

  async getSystemStatus(): Promise<SystemStatus> {
    return this._get<SystemStatus>("/config/status")
  }

  async updateSettings(settings: Record<string, unknown>): Promise<SystemStatus> {
    return this._post<SystemStatus>("/config/settings", settings)
  }

  async getConfigurationStatus(): Promise<ConfigurationStatus> {
    return this._get<ConfigurationStatus>("/config")
  }

  async setAgentModel(model: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>("/config/models/agent", { model })
    return { message: (data.message ?? "") as string }
  }

  async setOrchestratorModel(model: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>("/config/models/orchestrator", { model })
    return { message: (data.message ?? "") as string }
  }

  async getLLMBackendStatus(): Promise<Record<string, unknown>> {
    return this._get<Record<string, unknown>>("/config/llmbackends")
  }

  async addLLMBackend(host: string, apiKey: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>("/config/llmbackends", {
      host,
      api_key: apiKey,
    })
    return { message: (data.message ?? "") as string }
  }

  async removeLLMBackend(host: string): Promise<SuccessResponse> {
    const data = await this._delete<Record<string, unknown>>(`/config/llmbackends/${encodeURIComponent(host)}`)
    return { message: (data.message ?? "") as string }
  }

  async getMCPServerStatus(): Promise<Record<string, unknown>> {
    return this._get<Record<string, unknown>>("/config/mcpservers")
  }

  async addMCPServer(host: string, apiKey: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>("/config/mcpservers", {
      host,
      api_key: apiKey,
    })
    return { message: (data.message ?? "") as string }
  }

  async removeMCPServer(host: string): Promise<SuccessResponse> {
    const data = await this._delete<Record<string, unknown>>(`/config/mcpservers/${encodeURIComponent(host)}`)
    return { message: (data.message ?? "") as string }
  }

  async getTaskHandlerStatus(): Promise<TaskHandlerStatus> {
    return this._get<TaskHandlerStatus>("/config/taskhandler")
  }

  async getTaskHandlerStatusLocal(): Promise<TaskHandlerStatusLocal> {
    return this._get<TaskHandlerStatusLocal>("/config/taskhandler/local")
  }

  async setConcurrentTasksPerReplica(maxTasks: number): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>("/config/taskhandler/concurrency", {
      max_tasks: maxTasks,
    })
    return { message: (data.message ?? "") as string }
  }

  async getSummaryWorkerStatus(): Promise<SummaryWorkerStatus> {
    return this._get<SummaryWorkerStatus>("/config/summary-worker")
  }

  async setCompactorModel(modelName: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>("/config/models/compactor", {
      model_name: modelName,
    })
    return { message: (data.message ?? "") as string }
  }

  async setTranslateModel(modelName: string): Promise<SuccessResponse> {
    const data = await this._post<Record<string, unknown>>("/config/models/translate", {
      model_name: modelName,
    })
    return { message: (data.message ?? "") as string }
  }

  async getTokenWorkerStatus(): Promise<TokenWorkerStatus> {
    return this._get<TokenWorkerStatus>("/config/token-worker")
  }

  async getSlotsStatus(): Promise<SlotsStatus> {
    return this._get<SlotsStatus>("/config/slots")
  }

  // ------------------------------------------------------------------
  // Auth / WebSocket status
  // ------------------------------------------------------------------

  async getAuthConfig(): Promise<AuthConfig> {
    return this._get<AuthConfig>("/auth/config")
  }

  async getWebSocketStatus(): Promise<WebSocketStatus> {
    return this._get<WebSocketStatus>("/websocket/status")
  }

  // ------------------------------------------------------------------
  // SSE stream
  // ------------------------------------------------------------------

  async *streamTaskStatus(taskId: string): AsyncGenerator<Record<string, unknown>> {
    const headers = await this._resolveHeaders()
    headers["Accept"] = "text/event-stream"
    const response = await this._fetch(this._makeUrl(`/tasks/${taskId}/stream`), {
      headers,
    })
    if (!response.ok) {
      throw new OrchestratorAPIError(
        `Stream connection failed: ${response.statusText}`,
        response.status,
      )
    }
    const reader = response.body?.getReader()
    if (!reader) {
      throw new OrchestratorConnectionError("Stream body is not readable")
    }
    const decoder = new TextDecoder()
    let buffer = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            yield JSON.parse(line.slice(6))
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return controller.signal
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true })
  }
  return controller.signal
}
