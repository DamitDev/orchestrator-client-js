# orchestrator-client

TypeScript/JavaScript client for the [DAMIT AIOps Orchestrator](https://github.com/DamitDev/orchestrator) REST API and Socket.IO realtime events.

## Install

```bash
npm install orchestrator-client
# or
pnpm add orchestrator-client
```

If you need Socket.IO realtime support, install the peer dependency:

```bash
npm install socket.io-client
```

## Quick Start

```typescript
import { Orchestrator } from "orchestrator-client";

const client = new Orchestrator({ baseUrl: "http://localhost:8080" });

// Create a task
const task = client.createTask({
  workflowId: "proactive",
  goalPrompt: "Analyze system logs for errors",
  maxIterations: 50,
});
console.log(`Created: ${task.taskId}`);

// Poll status
const status = client.getTaskStatus(task.taskId);
console.log(`Status: ${status.status}, iteration ${status.iteration}/${status.maxIterations}`);

// List tasks
const tasks = client.listTasks({ workflowId: "proactive", limit: 10 });
for (const t of tasks.tasks) {
  console.log(`  ${t.id}: ${t.status}`);
}

// Cancel
client.cancelTask(task.taskId);

client.close();
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ORCHESTRATOR_URL` | `http://localhost:8080` | Base URL (supports subpath) |
| `ORCHESTRATOR_API_KEY` | — | Optional bearer token |
| `ORCHESTRATOR_TIMEOUT_MS` | `30000` | HTTP timeout (milliseconds) |
| `ORCHESTRATOR_MAX_RETRIES` | `3` | Max retry attempts |

## Async Variant

For use inside async code (e.g. React, Fastify, asyncio-style scripts):

```typescript
import { OrchestratorAsync } from "orchestrator-client";

const client = new OrchestratorAsync({ baseUrl: "http://localhost:8080" });
const status = await client.getTaskStatus("task-abc123");
await client.close();
```

## Auth

Provide a static token or a callback for dynamic tokens:

```typescript
// Static token
new Orchestrator({ baseUrl: "...", apiKey: "my-token" });

// Dynamic callback (called on each request)
new Orchestrator({
  baseUrl: "...",
  getToken: () => keycloak.token,
});
```

## Self-Signed / Insecure SSL

For development environments with self-signed certificates, use `createInsecureFetch()`:

```typescript
import { Orchestrator, createInsecureFetch } from "orchestrator-client";

const client = new Orchestrator({
  baseUrl: "https://orchestrator.internal:8443",
  fetch: await createInsecureFetch(),
});
```

Or use the shorthand `insecure` flag:

```typescript
const client = new Orchestrator({
  baseUrl: "https://orchestrator.internal:8443",
  insecure: true,  // Node.js only
});
```

## Exceptions

All inherit from `OrchestratorError` and carry `statusCode` and `errorCode`:

| Exception | Meaning |
|---|---|
| `OrchestratorConnectionError` | Network / DNS / timeout |
| `OrchestratorAuthError` | 401/403 |
| `OrchestratorNotFoundError` | 404 |
| `OrchestratorAPIError` | 400/500 with error code |
| `OrchestratorConfigError` | Bad env vars / missing config |

## Documentation

Detailed docs with full method listings and examples:

- [REST API client](docs/client.md) — all endpoints, workflow interactions, configuration
- [Socket.IO realtime](docs/realtime.md) — event types, room subscriptions, streaming
- [SSE status stream](docs/sse.md) — lightweight status-only monitoring

## Testing

```bash
pnpm install
pnpm test
```

## License

Apache 2.0
