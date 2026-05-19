# REST API Client Reference

## Construction

```typescript
import { Orchestrator, OrchestratorAsync } from "orchestrator-client";

// Sync variant (primary)
const client = new Orchestrator({ baseUrl: "http://localhost:8080" });

// Async variant
const asyncClient = new OrchestratorAsync({ baseUrl: "http://localhost:8080" });
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | `"http://localhost:8080"` | Base URL of the orchestrator |
| `apiKey` | `string` | — | Static bearer token |
| `getToken` | `() => string \| Promise<string>` | — | Dynamic token callback |
| `timeoutMs` | `number` | `30000` | Request timeout in ms |
| `maxRetries` | `number` | `3` | Max retry attempts |

## Task Methods

### listTasks

```typescript
const result = client.listTasks({
  workflowId?: string,
  status?: string,
  limit?: number,
  offset?: number,
  sortBy?: string,
  sortOrder?: string,
});
// Returns { tasks: TaskSummary[], pagination: Pagination }
```

### createTask

```typescript
const result = client.createTask({
  workflowId: string,
  goalPrompt: string,
  maxIterations?: number,
  options?: Record<string, boolean>,
  ticketId?: string,
  title?: string,
  modelId?: string,
});
// Returns { taskId: string, status: string }
```

### getTaskStatus

```typescript
const detail = client.getTaskStatus(taskId);
// Returns TaskDetail (extends TaskSummary with subtaskIds, workflowData, options)
```

### getTaskConversation

```typescript
const conv = client.getTaskConversation(taskId);
// Returns { taskId: string, conversation: Message[] }
```

### cancelTask / deleteTask / deleteTasks

```typescript
client.cancelTask(taskId);
client.deleteTask(taskId);
client.deleteTasks([taskId1, taskId2]);
```

## Workflow Methods

Each workflow type has its own interaction methods. Prefixes indicate the workflow:

| Prefix | Workflow | Key Methods |
|---|---|---|
| `Interactive` | Interactive | `sendInteractiveMessage`, `approveInteractiveAction`, `markInteractiveComplete`, `markInteractiveFailed` |
| `Proactive` | Proactive | `sendProactiveGuide`, `respondProactiveHelp`, `approveProactiveAction` |
| `Ticket` | Ticket | `sendTicketGuide`, `respondTicketHelp`, `approveTicketAction`, `wakeTicket` |
| `Matrix` | Matrix | `sendMatrixMessage`, `getMatrixConversation`, `approveMatrixAction` |
| `VSA` | VSA | `createVSATask`, `sendVSAMessage`, `listVSATasks`, `searchVSATasks` |
| `MIO` | MIO | `sendMioMessage`, `approveMioAction`, `getMioContext`, `archiveMio` |

## Configuration Methods

| Method | Description |
|---|---|
| `getSystemStatus()` | Current system configuration |
| `updateSettings(settings)` | Update configuration |
| `getConfigurationStatus()` | Full configuration overview |
| `setAgentModel(model)` | Set agent model |
| `setOrchestratorModel(model)` | Set orchestrator model |
| `getLLMBackendStatus()` | LLM backends status |
| `addLLMBackend(host, apiKey)` | Add LLM backend |
| `removeLLMBackend(host)` | Remove LLM backend |
| `getTaskHandlerStatus()` | Task handler cluster status |
| `getSlotsStatus()` | Agent VM slot status |

## Health / Metrics

| Method | Description |
|---|---|
| `health()` | Simple health check |
| `healthDetailed()` | Detailed component health |
| `ready()` | Readiness probe |
| `healthLeader()` | Leader election status |
| `getMetrics(types?)` | Performance metrics |

## Error Events

| Method | Description |
|---|---|
| `listErrors(params?)` | Paginated error history |
| `getErrorDetail(errorId)` | Full error with traceback |
| `getErrorStats(since?)` | Aggregated error stats |
| `countErrors(since?)` | Error count |
| `purgeErrors()` | Delete all errors |
