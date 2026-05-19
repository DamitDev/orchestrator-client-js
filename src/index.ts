/**
 * orchestrator-client — TypeScript/JavaScript client for the DAMIT AIOps Orchestrator.
 *
 * Provides a complete wrapper for the orchestrator's REST API and
 * Socket.IO realtime events, with typed responses, automatic retry,
 * and configurable auth.
 *
 * Main components:
 *
 * - {@link Orchestrator} — synchronous REST client (primary interface)
 * - {@link OrchestratorAsync} — async REST client (for async contexts)
 * - {@link RealtimeClient} — Socket.IO event subscription layer
 * - Typed exception hierarchy ({@link OrchestratorError} and subclasses)
 * - Typed response interfaces for all response shapes
 */

export const VERSION = "5.6.0"

// Client classes
export { OrchestratorAsync } from "./client.js"
export type { OrchestratorClientOptions } from "./client.js"
export { Orchestrator } from "./sync-client.js"

// Config
export { loadConfig } from "./config.js"
export type { OrchestratorConfig } from "./config.js"

// Custom fetch
export { createInsecureFetch } from "./fetch.js"

// Socket.IO
export { RealtimeClient } from "./socketio.js"
export {
  EVENT_TASK_CREATED,
  EVENT_TASK_STATUS_CHANGED,
  EVENT_TASK_ITERATION_CHANGED,
  EVENT_TASK_DELETED,
  EVENT_TASK_RESULT_UPDATED,
  EVENT_TASK_INSIGHT_UPDATED,
  EVENT_MESSAGE_ADDED,
  EVENT_MESSAGE_STREAMING,
  EVENT_MESSAGE_SUMMARY_GENERATED,
  EVENT_MESSAGE_TRANSLATION_READY,
  EVENT_ERROR_EVENT_RECORDED,
} from "./socketio.js"
export type { EventHandler, RealtimeClientOptions } from "./socketio.js"

// Exceptions
export {
  OrchestratorError,
  OrchestratorConnectionError,
  OrchestratorAuthError,
  OrchestratorNotFoundError,
  OrchestratorAPIError,
  OrchestratorConfigError,
} from "./errors.js"

// Models
export type { Pagination } from "./models/pagination.js"
export type {
  TaskSummary,
  TaskOptions,
  TaskDetail,
  TaskListResult,
  TaskCreateResponse,
  TaskCancelResponse,
  TaskDeleteResult,
  VSATaskCreateResponse,
} from "./models/task.js"
export type {
  AttachmentMeta,
  ToolCall,
  Message,
  ConversationResult,
  MatrixConversationResult,
  ArchivedContent,
  MessageTranslation,
  MessageTranslationsResult,
  MessageTranslationReadyEvent,
} from "./models/conversation.js"
export type {
  ErrorEvent,
  ErrorEventDetail,
  ErrorStatsResult,
  ErrorCountResult,
  ErrorPurgeResult,
} from "./models/errors.js"
export type {
  HealthStatus,
  ComponentHealth,
  HealthDetail,
  ReadinessCheck,
  ReadinessResult,
  LockStatus,
  LeaderStatus,
  MetricSnapshot,
} from "./models/health.js"
export type {
  SystemStatusSettings,
  SystemStatus,
  LLMBackendInfo,
  MCPServerInfo,
  TaskHandlerReplica,
  TaskHandlerCluster,
  TaskHandlerStatus,
  TaskHandlerStatusLocal,
  SummaryWorkerStatus,
  TokenWorkerStatus,
  SlotInfo,
  SlotsStatus,
  ConfigurationStatus,
} from "./models/config-models.js"
export type { ToolInfo, ToolsListResult } from "./models/tools.js"
export type {
  CompactionEvent,
  TaskJournal,
  AttachmentUploadResponse,
} from "./models/journal.js"
export type { AuthConfig, WebSocketClientInfo, WebSocketStatus } from "./models/auth.js"
export type { SuccessResponse, MioContext, WorkflowStates } from "./models/workflow.js"
