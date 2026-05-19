# SSE Status Stream

The orchestrator provides a Server-Sent Events (SSE) stream for lightweight
status-only monitoring of a single task.

## Usage

```typescript
import { OrchestratorAsync } from "orchestrator-client";

const client = new OrchestratorAsync({ baseUrl: "http://localhost:8080" });

for await (const event of client.streamTaskStatus("task-abc123")) {
  console.log("Stream event:", event);
}
```

Events are JSON objects with the task's current status. The stream remains
open until the task completes or the connection is closed.
