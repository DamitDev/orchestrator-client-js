/**
 * RealtimeClient — Socket.IO wrapper for orchestrator realtime events.
 *
 * Connects to the orchestrator's Socket.IO endpoint (same host:port as the
 * REST API) and provides a typed subscription layer using the server's
 * room-based event system.
 *
 * Usage:
 *
 *   const rt = new RealtimeClient("http://localhost:8080");
 *   await rt.connect();
 *   await rt.subscribeTask("task-abc123");
 *
 *   rt.on("task_status_changed", (event) => {
 *     console.log(event.new_status);
 *   });
 */

import type { Socket as SocketIOClient } from "socket.io-client"

// ---------------------------------------------------------------------------
// Event type constants — mirror the Python client's event name constants
// ---------------------------------------------------------------------------

export const EVENT_TASK_CREATED = "task_created"
export const EVENT_TASK_STATUS_CHANGED = "task_status_changed"
export const EVENT_TASK_ITERATION_CHANGED = "task_iteration_changed"
export const EVENT_TASK_DELETED = "task_deleted"
export const EVENT_TASK_RESULT_UPDATED = "task_result_updated"
export const EVENT_TASK_INSIGHT_UPDATED = "task_insight_updated"
export const EVENT_MESSAGE_ADDED = "message_added"
export const EVENT_MESSAGE_STREAMING = "message_streaming"
export const EVENT_MESSAGE_SUMMARY_GENERATED = "message_summary_generated"
export const EVENT_MESSAGE_TRANSLATION_READY = "message_translation_ready"
export const EVENT_ERROR_EVENT_RECORDED = "error_event_recorded"

export type EventHandler = (...args: unknown[]) => void

export interface RealtimeClientOptions {
  /** Socket.IO connection options. */
  socketOptions?: Record<string, unknown>
  /** Optional bearer token or async token getter. */
  getToken?: (() => string | Promise<string>) | string
  /** Whether to auto-connect on construction (default: false). */
  autoConnect?: boolean
}

/**
 * Socket.IO-based realtime client for receiving orchestrator events.
 *
 * Requires the consumer to provide their own `socket.io-client` instance
 * to avoid version conflicts.
 */
export class RealtimeClient {
  private _baseUrl: string
  private _socketOptions: Record<string, unknown>
  private _getToken?: (() => string | Promise<string>) | string
  private _socket: SocketIOClient | null = null
  private _handlers: Map<string, Set<EventHandler>> = new Map()
  private _connected = false

  constructor(baseUrl: string, opts: RealtimeClientOptions) {
    this._baseUrl = baseUrl.replace(/\/+$/, "")
    this._socketOptions = opts.socketOptions ?? {}
    this._getToken = opts.getToken

    if (opts.autoConnect) {
      this.connect()
    }
  }

  get connected(): boolean {
    return this._connected
  }

  async connect(): Promise<void> {
    const auth: Record<string, unknown> = {}
    if (this._getToken) {
      auth.token =
        typeof this._getToken === "function"
          ? await this._getToken()
          : this._getToken
    }

    // We construct the socket dynamically to avoid a hard import
    const { io } = await import("socket.io-client")
    this._socket = io(this._baseUrl, {
      path: "/socket.io",
      auth,
      transports: ["websocket", "polling"],
      ...this._socketOptions,
    }) as unknown as SocketIOClient

    this._socket.on("connect", () => {
      this._connected = true
    })

    this._socket.on("disconnect", () => {
      this._connected = false
    })

    return new Promise<void>((resolve, reject) => {
      const socket = this._socket!
      socket.on("connect", () => resolve())
      socket.on("connect_error", (err: Error) => reject(err))
      // If already connected, resolve immediately
      if (socket.connected) {
        resolve()
      }
    })
  }

  async disconnect(): Promise<void> {
    if (this._socket) {
      this._socket.disconnect()
      this._socket = null
    }
    this._connected = false
  }

  /**
   * Subscribe to realtime events for a specific task.
   */
  async subscribeTask(taskId: string): Promise<void> {
    if (!this._socket) throw new Error("RealtimeClient not connected")
    return new Promise((resolve, reject) => {
      this._socket!.emit("subscribe", { task_id: taskId }, (response: { ok: boolean; error?: string }) => {
        if (response.ok) resolve()
        else reject(new Error(response.error ?? "Subscription failed"))
      })
    })
  }

  /**
   * Unsubscribe from realtime events for a specific task.
   */
  async unsubscribeTask(taskId: string): Promise<void> {
    if (!this._socket) throw new Error("RealtimeClient not connected")
    return new Promise((resolve, reject) => {
      this._socket!.emit("unsubscribe", { task_id: taskId }, (response: { ok: boolean; error?: string }) => {
        if (response.ok) resolve()
        else reject(new Error(response.error ?? "Unsubscription failed"))
      })
    })
  }

  /**
   * Register a handler for a specific event type.
   */
  on(event: string, handler: EventHandler): void {
    if (!this._handlers.has(event)) {
      this._handlers.set(event, new Set())
      // Wire up socket listener when first handler is added
      if (this._socket) {
        this._socket.on(event, (...args: unknown[]) => {
          const handlers = this._handlers.get(event)
          if (handlers) {
            for (const h of handlers) {
              h(...args)
            }
          }
        })
      }
    }
    this._handlers.get(event)!.add(handler)
  }

  /**
   * Remove a registered handler.
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this._handlers.get(event)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this._handlers.delete(event)
        if (this._socket) {
          this._socket.off(event)
        }
      }
    }
  }

  /**
   * Wait for the connection to close (for long-running listeners).
   */
  wait(): Promise<void> {
    return new Promise((resolve) => {
      const socket = this._socket
      if (!socket) {
        resolve()
        return
      }
      socket.on("disconnect", () => resolve())
    })
  }
}
