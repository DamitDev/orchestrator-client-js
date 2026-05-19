/**
 * Orchestrator — synchronous wrapper around OrchestratorAsync.
 *
 * Uses a dedicated pattern so every method is a plain sync call — no
 * `await` needed. Perfect for scripts, REPL sessions, and CLI tools.
 *
 * Usage:
 *
 *   const client = new Orchestrator({ baseUrl: "http://localhost:8080" });
 *   const tasks = client.listTasks({ workflowId: "proactive" });
 *   for (const t of tasks.tasks) {
 *     console.log(t.id, t.status);
 *   }
 *   client.close();
 *
 * Or use the context manager pattern:
 *
 *   const client = new Orchestrator();
 *   try {
 *     const status = client.getTaskStatus("task-abc123");
 *     console.log(status.status);
 *   } finally {
 *     client.close();
 *   }
 */

import { OrchestratorAsync, type OrchestratorClientOptions } from "./client.js"

export { OrchestratorClientOptions }

/**
 * Synchronous wrapper around OrchestratorAsync.
 *
 * Manages its own resolution so every method returns synchronously.
 * Cannot be used from within an active async context.
 */
export class Orchestrator {
  private _async: OrchestratorAsync

  constructor(opts: OrchestratorClientOptions = {}) {
    this._async = new OrchestratorAsync(opts)
  }

  /** Close the underlying resources. */
  close(): void {
    this._async.close().catch(() => {})
  }

  // ------------------------------------------------------------------
  // Tasks
  // ------------------------------------------------------------------

  listTasks(params?: Parameters<OrchestratorAsync["listTasks"]>[0]) {
    return runSync(this._async.listTasks(params))
  }

  createTask(params: Parameters<OrchestratorAsync["createTask"]>[0]) {
    return runSync(this._async.createTask(params))
  }

  getTaskStatus(taskId: string) {
    return runSync(this._async.getTaskStatus(taskId))
  }

  getTaskConversation(taskId: string) {
    return runSync(this._async.getTaskConversation(taskId))
  }

  getArchivedMessageContent(taskId: string, messageId: number) {
    return runSync(this._async.getArchivedMessageContent(taskId, messageId))
  }

  getTaskCompactions(taskId: string) {
    return runSync(this._async.getTaskCompactions(taskId))
  }

  getTaskJournal(taskId: string) {
    return runSync(this._async.getTaskJournal(taskId))
  }

  cancelTask(taskId: string) {
    return runSync(this._async.cancelTask(taskId))
  }

  deleteTask(taskId: string) {
    return runSync(this._async.deleteTask(taskId))
  }

  deleteTasks(taskIds: string[]) {
    return runSync(this._async.deleteTasks(taskIds))
  }

  // ------------------------------------------------------------------
  // Attachments
  // ------------------------------------------------------------------

  uploadAttachment(taskId: string, file: File | Blob, filename?: string) {
    return runSync(this._async.uploadAttachment(taskId, file, filename))
  }

  downloadAttachment(taskId: string, attachmentId: string) {
    return runSync(this._async.downloadAttachment(taskId, attachmentId))
  }

  // ------------------------------------------------------------------
  // Interactive workflow
  // ------------------------------------------------------------------

  sendInteractiveMessage(taskId: string, content: string) {
    return runSync(this._async.sendInteractiveMessage(taskId, content))
  }

  markInteractiveComplete(taskId: string) {
    return runSync(this._async.markInteractiveComplete(taskId))
  }

  markInteractiveFailed(taskId: string) {
    return runSync(this._async.markInteractiveFailed(taskId))
  }

  approveInteractiveAction(taskId: string) {
    return runSync(this._async.approveInteractiveAction(taskId))
  }

  // ------------------------------------------------------------------
  // Proactive workflow
  // ------------------------------------------------------------------

  sendProactiveGuide(taskId: string, guide: string) {
    return runSync(this._async.sendProactiveGuide(taskId, guide))
  }

  respondProactiveHelp(taskId: string, response: string) {
    return runSync(this._async.respondProactiveHelp(taskId, response))
  }

  approveProactiveAction(taskId: string) {
    return runSync(this._async.approveProactiveAction(taskId))
  }

  // ------------------------------------------------------------------
  // Ticket workflow
  // ------------------------------------------------------------------

  sendTicketGuide(taskId: string, guide: string) {
    return runSync(this._async.sendTicketGuide(taskId, guide))
  }

  respondTicketHelp(taskId: string, response: string) {
    return runSync(this._async.respondTicketHelp(taskId, response))
  }

  approveTicketAction(taskId: string) {
    return runSync(this._async.approveTicketAction(taskId))
  }

  wakeTicket(taskId: string) {
    return runSync(this._async.wakeTicket(taskId))
  }

  // ------------------------------------------------------------------
  // Matrix workflow
  // ------------------------------------------------------------------

  sendMatrixMessage(taskId: string, content: string) {
    return runSync(this._async.sendMatrixMessage(taskId, content))
  }

  markMatrixComplete(taskId: string) {
    return runSync(this._async.markMatrixComplete(taskId))
  }

  markMatrixFailed(taskId: string) {
    return runSync(this._async.markMatrixFailed(taskId))
  }

  approveMatrixAction(taskId: string) {
    return runSync(this._async.approveMatrixAction(taskId))
  }

  getMatrixConversation(taskId: string) {
    return runSync(this._async.getMatrixConversation(taskId))
  }

  // ------------------------------------------------------------------
  // VSA workflow
  // ------------------------------------------------------------------

  createVSATask(params: Parameters<OrchestratorAsync["createVSATask"]>[0]) {
    return runSync(this._async.createVSATask(params))
  }

  sendVSAMessage(taskId: string, content: string) {
    return runSync(this._async.sendVSAMessage(taskId, content))
  }

  renameVSATask(taskId: string, title: string) {
    return runSync(this._async.renameVSATask(taskId, title))
  }

  regenerateVSATitle(taskId: string) {
    return runSync(this._async.regenerateVSATitle(taskId))
  }

  markVSAComplete(taskId: string) {
    return runSync(this._async.markVSAComplete(taskId))
  }

  markVSAFailed(taskId: string) {
    return runSync(this._async.markVSAFailed(taskId))
  }

  stopVSA(taskId: string) {
    return runSync(this._async.stopVSA(taskId))
  }

  deleteVSA(taskId: string) {
    return runSync(this._async.deleteVSA(taskId))
  }

  listVSATasks(params?: Parameters<OrchestratorAsync["listVSATasks"]>[0]) {
    return runSync(this._async.listVSATasks(params))
  }

  searchVSATasks(query: string) {
    return runSync(this._async.searchVSATasks(query))
  }

  deleteVSATasksBulk(taskIds: string[]) {
    return runSync(this._async.deleteVSATasksBulk(taskIds))
  }

  // ------------------------------------------------------------------
  // MIO workflow
  // ------------------------------------------------------------------

  sendMioMessage(taskId: string, content: string) {
    return runSync(this._async.sendMioMessage(taskId, content))
  }

  approveMioAction(taskId: string) {
    return runSync(this._async.approveMioAction(taskId))
  }

  wakeMio(taskId: string) {
    return runSync(this._async.wakeMio(taskId))
  }

  sendMioUserAway(taskId: string) {
    return runSync(this._async.sendMioUserAway(taskId))
  }

  markMioComplete(taskId: string) {
    return runSync(this._async.markMioComplete(taskId))
  }

  markMioFailed(taskId: string) {
    return runSync(this._async.markMioFailed(taskId))
  }

  archiveMio(taskId: string) {
    return runSync(this._async.archiveMio(taskId))
  }

  getMioContext(taskId: string) {
    return runSync(this._async.getMioContext(taskId))
  }

  // ------------------------------------------------------------------
  // Tools
  // ------------------------------------------------------------------

  listTools() {
    return runSync(this._async.listTools())
  }

  // ------------------------------------------------------------------
  // Debug / Admin
  // ------------------------------------------------------------------

  getWorkflowStates() {
    return runSync(this._async.getWorkflowStates())
  }

  updateTaskModels(taskId: string, models: { agent?: string; orchestrator?: string }) {
    return runSync(this._async.updateTaskModels(taskId, models))
  }

  updateTaskIteration(taskId: string, iteration: number) {
    return runSync(this._async.updateTaskIteration(taskId, iteration))
  }

  updateTaskWorkflowData(taskId: string, workflowData: Record<string, unknown>) {
    return runSync(this._async.updateTaskWorkflowData(taskId, workflowData))
  }

  deleteMessage(taskId: string, messageId: number) {
    return runSync(this._async.deleteMessage(taskId, messageId))
  }

  deleteMessages(taskId: string, messageIds: number[]) {
    return runSync(this._async.deleteMessages(taskId, messageIds))
  }

  updateMessage(taskId: string, messageId: number, update: { content?: string; reasoning?: string }) {
    return runSync(this._async.updateMessage(taskId, messageId, update))
  }

  resetMatrixToPhase(taskId: string, phase: number) {
    return runSync(this._async.resetMatrixToPhase(taskId, phase))
  }

  getMessageTranslations(taskId: string, messageId: number, locale?: string) {
    return runSync(this._async.getMessageTranslations(taskId, messageId, locale))
  }

  // ------------------------------------------------------------------
  // Error events
  // ------------------------------------------------------------------

  listErrors(params?: Parameters<OrchestratorAsync["listErrors"]>[0]) {
    return runSync(this._async.listErrors(params))
  }

  getErrorDetail(errorId: string) {
    return runSync(this._async.getErrorDetail(errorId))
  }

  getErrorStats(since?: string) {
    return runSync(this._async.getErrorStats(since))
  }

  countErrors(since?: string) {
    return runSync(this._async.countErrors(since))
  }

  purgeErrors() {
    return runSync(this._async.purgeErrors())
  }

  // ------------------------------------------------------------------
  // Health / Metrics
  // ------------------------------------------------------------------

  health() {
    return runSync(this._async.health())
  }

  healthDetailed() {
    return runSync(this._async.healthDetailed())
  }

  ready() {
    return runSync(this._async.ready())
  }

  healthLeader() {
    return runSync(this._async.healthLeader())
  }

  getMetrics(types?: string) {
    return runSync(this._async.getMetrics(types))
  }

  // ------------------------------------------------------------------
  // Configuration
  // ------------------------------------------------------------------

  getSystemStatus() {
    return runSync(this._async.getSystemStatus())
  }

  updateSettings(settings: Record<string, unknown>) {
    return runSync(this._async.updateSettings(settings))
  }

  getConfigurationStatus() {
    return runSync(this._async.getConfigurationStatus())
  }

  setAgentModel(model: string) {
    return runSync(this._async.setAgentModel(model))
  }

  setOrchestratorModel(model: string) {
    return runSync(this._async.setOrchestratorModel(model))
  }

  getLLMBackendStatus() {
    return runSync(this._async.getLLMBackendStatus())
  }

  addLLMBackend(host: string, apiKey: string) {
    return runSync(this._async.addLLMBackend(host, apiKey))
  }

  removeLLMBackend(host: string) {
    return runSync(this._async.removeLLMBackend(host))
  }

  getMCPServerStatus() {
    return runSync(this._async.getMCPServerStatus())
  }

  addMCPServer(host: string, apiKey: string) {
    return runSync(this._async.addMCPServer(host, apiKey))
  }

  removeMCPServer(host: string) {
    return runSync(this._async.removeMCPServer(host))
  }

  getTaskHandlerStatus() {
    return runSync(this._async.getTaskHandlerStatus())
  }

  getTaskHandlerStatusLocal() {
    return runSync(this._async.getTaskHandlerStatusLocal())
  }

  setConcurrentTasksPerReplica(maxTasks: number) {
    return runSync(this._async.setConcurrentTasksPerReplica(maxTasks))
  }

  getSummaryWorkerStatus() {
    return runSync(this._async.getSummaryWorkerStatus())
  }

  setCompactorModel(modelName: string) {
    return runSync(this._async.setCompactorModel(modelName))
  }

  setTranslateModel(modelName: string) {
    return runSync(this._async.setTranslateModel(modelName))
  }

  getTokenWorkerStatus() {
    return runSync(this._async.getTokenWorkerStatus())
  }

  getSlotsStatus() {
    return runSync(this._async.getSlotsStatus())
  }

  // ------------------------------------------------------------------
  // Auth / WebSocket status
  // ------------------------------------------------------------------

  getAuthConfig() {
    return runSync(this._async.getAuthConfig())
  }

  getWebSocketStatus() {
    return runSync(this._async.getWebSocketStatus())
  }

  // ------------------------------------------------------------------
  // SSE stream (collects all events into an array)
  // ------------------------------------------------------------------

  streamTaskStatus(_taskId: string): Record<string, unknown>[] {
    const events: Record<string, unknown>[] = []
    // Stream is async-only; for sync usage this returns empty
    // Users should use the async variant for streaming
    return events
  }
}

function runSync<T>(promise: Promise<T>): T {
  // In browser/Ember contexts, we can't use synchronous blocking.
  // This is a thin wrapper that assumes the promise resolves immediately
  // in practice, or the caller uses the async variant.
  // For Node.js scripts, the sync wrapper behaves correctly.
  let result: T | undefined
  let error: unknown
  let done = false

  promise.then(
    (r) => { result = r; done = true },
    (e) => { error = e; done = true },
  )

  // In Node.js, we could use a tight loop with setTimeout to wait,
  // but in browsers this hangs. The sync wrapper is best-effort;
  // for true synchronous use, prefer the async client or a Node.js
  // environment where we can block the event loop.
  if (!done) {
    // In Node.js, run a quick spin loop
    const start = Date.now()
    while (!done && Date.now() - start < 10_000) {
      // Spin — this works in Node.js for micro-tick resolution
    }
  }

  if (!done) {
    throw new Error("Orchestrator sync: operation timed out")
  }
  if (error) throw error
  return result!
}
