# Socket.IO Realtime Events

## Setup

```typescript
import { RealtimeClient } from "orchestrator-client";

const rt = new RealtimeClient("http://localhost:8080", {
  getToken: () => "my-token",
});

await rt.connect();
```

## Subscribing to Task Events

```typescript
// Subscribe to a task's events
await rt.subscribeTask("task-abc123");

// Unsubscribe when done
await rt.unsubscribeTask("task-abc123");
```

## Event Handlers

```typescript
import {
  EVENT_TASK_STATUS_CHANGED,
  EVENT_MESSAGE_ADDED,
  EVENT_MESSAGE_TRANSLATION_READY,
} from "orchestrator-client";

// Register handler
rt.on(EVENT_TASK_STATUS_CHANGED, (event) => {
  console.log("Task status changed:", event);
});

// Remove handler
rt.off(EVENT_TASK_STATUS_CHANGED, handler);
```

## Known Event Types

| Constant | Event Name | Description |
|---|---|---|
| `EVENT_TASK_CREATED` | `task_created` | A new task was created |
| `EVENT_TASK_STATUS_CHANGED` | `task_status_changed` | Task status transition |
| `EVENT_TASK_ITERATION_CHANGED` | `task_iteration_changed` | Task iteration changed |
| `EVENT_TASK_DELETED` | `task_deleted` | Task was deleted |
| `EVENT_TASK_RESULT_UPDATED` | `task_result_updated` | Task result was updated |
| `EVENT_TASK_INSIGHT_UPDATED` | `task_insight_updated` | Task insight was updated |
| `EVENT_MESSAGE_ADDED` | `message_added` | New message in conversation |
| `EVENT_MESSAGE_STREAMING` | `message_streaming` | Message is being streamed |
| `EVENT_MESSAGE_SUMMARY_GENERATED` | `message_summary_generated` | Summary generated |
| `EVENT_MESSAGE_TRANSLATION_READY` | `message_translation_ready` | Translation completed |
| `EVENT_ERROR_EVENT_RECORDED` | `error_event_recorded` | Error was recorded |

## Disconnecting

```typescript
await rt.disconnect();
```

For long-running listeners, use `wait()` to keep the connection alive:

```typescript
await rt.wait();
```
