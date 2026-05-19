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

import type { Socket as SocketIOClient } from "socket.io-client";

// ---------------------------------------------------------------------------
// Event type constants — mirror the Python client's event name constants
// ---------------------------------------------------------------------------

export const EVENT_TASK_CREATED = "task_created";
export const EVENT_TASK_STATUS_CHANGED = "task_status_changed";
export const EVENT_TASK_ITERATION_CHANGED = "task_iteration_changed";
export const EVENT_TASK_DELETED = "task_deleted";
export const EVENT_TASK_RESULT_UPDATED = "task_result_updated";
export const EVENT_TASK_INSIGHT_UPDATED = "task_insight_updated";
export const EVENT_MESSAGE_ADDED = "message_added";
export const EVENT_MESSAGE_STREAMING = "message_streaming";
export const EVENT_MESSAGE_SUMMARY_GENERATED = "message_summary_generated";
export const EVENT_MESSAGE_TRANSLATION_READY = "message_translation_ready";
export const EVENT_ERROR_EVENT_RECORDED = "error_event_recorded";
export const EVENT_TASK_BULK_DELETED = "task_bulk_deleted";
export const EVENT_TASK_WORKFLOW_DATA_CHANGED = "task_workflow_data_changed";
export const EVENT_ITERATION_REMINDER_ADDED = "iteration_reminder_added";
export const EVENT_MESSAGE_DELETED = "message_deleted";
export const EVENT_MESSAGE_UPDATED = "message_updated";
export const EVENT_APPROVAL_REQUESTED = "approval_requested";
export const EVENT_APPROVAL_PROVIDED = "approval_provided";
export const EVENT_HELP_REQUESTED = "help_requested";
export const EVENT_HELP_PROVIDED = "help_provided";
export const EVENT_USER_MESSAGE_ADDED = "user_message_added";
export const EVENT_MIO_MEMORY_CREATED = "mio_memory_created";
export const EVENT_MIO_MEMORY_UPDATED = "mio_memory_updated";
export const EVENT_MIO_MEMORY_DELETED = "mio_memory_deleted";
export const EVENT_LLM_BACKEND_CHANGED = "llm_backend_changed";
export const EVENT_MCP_SERVER_CHANGED = "mcp_server_changed";
export const EVENT_MODEL_CONFIG_CHANGED = "model_config_changed";
export const EVENT_TASK_HANDLER_STATUS_CHANGED = "task_handler_status_changed";
export const EVENT_SUMMARY_WORKER_STATUS = "summary_worker_status";
export const EVENT_TOKEN_WORKER_STATUS = "token_worker_status";
export const EVENT_TOKEN_COUNT_UPDATED = "token_count_updated";
export const EVENT_MESSAGES_ARCHIVED = "messages_archived";
export const EVENT_SUBPROCESS_STARTED = "subprocess_started";
export const EVENT_SUBPROCESS_COMPLETED = "subprocess_completed";
export const EVENT_SUBPROCESS_FAILED = "subprocess_failed";

export type EventHandler = (...args: unknown[]) => void;

export interface RealtimeClientOptions {
	/** Socket.IO connection options. */
	socketOptions?: Record<string, unknown>;
	/** Optional bearer token or async token getter. */
	getToken?: (() => string | Promise<string>) | string;
	/** Whether to auto-connect on construction (default: false). */
	autoConnect?: boolean;
}

/**
 * Socket.IO-based realtime client for receiving orchestrator events.
 *
 * The server wraps all domain events in a `message` Socket.IO event with an
 * inner `event_type` field. This client unwraps the envelope and dispatches
 * to registered handlers by event_type.
 */
export class RealtimeClient {
	private _baseUrl: string;
	private _socketOptions: Record<string, unknown>;
	private _getToken?: (() => string | Promise<string>) | string;
	private _socket: SocketIOClient | null = null;
	private _handlers: Map<string, Set<EventHandler>> = new Map();
	private _connected = false;

	constructor(baseUrl: string, opts: RealtimeClientOptions) {
		this._baseUrl = baseUrl.replace(/\/+$/, "");
		this._socketOptions = opts.socketOptions ?? {};
		this._getToken = opts.getToken;

		if (opts.autoConnect) {
			this.connect();
		}
	}

	get connected(): boolean {
		return this._connected;
	}

	async connect(): Promise<void> {
		const auth: Record<string, unknown> = {};
		if (this._getToken) {
			auth.token =
				typeof this._getToken === "function"
					? await this._getToken()
					: this._getToken;
		}

		// We construct the socket dynamically to avoid a hard import
		const { io } = await import("socket.io-client");
		this._socket = io(this._baseUrl, {
			path: "/socket.io",
			auth,
			transports: ["websocket", "polling"],
			...this._socketOptions,
		}) as unknown as SocketIOClient;

		this._socket.on("connect", () => {
			this._connected = true;
		});

		this._socket.on("disconnect", () => {
			this._connected = false;
		});

		// All domain events come wrapped in a `message` socket event with
		// an inner `event_type` field. Dispatch them to registered handlers.
		this._socket.on("message", (payload: unknown) => this._dispatch(payload));

		return new Promise<void>((resolve, reject) => {
			if (!this._socket) {
				reject(new Error("RealtimeClient not connected"));
				return;
			}
			this._socket.on("connect", () => resolve());
			this._socket.on("connect_error", (err: Error) => reject(err));
			// If already connected, resolve immediately
			if (this._socket.connected) {
				resolve();
			}
		});
	}

	async disconnect(): Promise<void> {
		if (this._socket) {
			this._socket.disconnect();
			this._socket = null;
		}
		this._connected = false;
	}

	/**
	 * Dispatch a message envelope to registered handlers.
	 * The server sends: socket.emit("message", {type: "message", event: {..., event_type: "...", ...}})
	 */
	private _dispatch(payload: unknown): void {
		const envelope = payload as Record<string, unknown>;
		const event = (envelope.event ?? envelope) as Record<string, unknown>;
		const eventType = event.event_type as string | undefined;
		if (!eventType) return;
		const handlers = this._handlers.get(eventType);
		if (handlers) {
			for (const h of handlers) {
				h(event);
			}
		}
	}

	/**
	 * Subscribe to realtime events for a specific task.
	 * Emits a `join` event with `{rooms: ["task:{taskId}"]}`.
	 */
	subscribeTask(taskId: string): void {
		if (!this._socket) throw new Error("RealtimeClient not connected");
		this._socket.emit("join", { rooms: [`task:${taskId}`] });
	}

	/**
	 * Unsubscribe from realtime events for a specific task.
	 * Emits a `leave` event with `{rooms: ["task:{taskId}"]}`.
	 */
	unsubscribeTask(taskId: string): void {
		if (!this._socket) throw new Error("RealtimeClient not connected");
		this._socket.emit("leave", { rooms: [`task:${taskId}`] });
	}

	/**
	 * Subscribe to event-type-scoped rooms.
	 * e.g. subscribeEvents("task_created", "task_deleted")
	 */
	subscribeEvents(...eventTypes: string[]): void {
		if (!this._socket) throw new Error("RealtimeClient not connected");
		const rooms = eventTypes.map((t) => `event:${t}`);
		this._socket.emit("join", { rooms });
	}

	/**
	 * Unsubscribe from event-type-scoped rooms.
	 */
	unsubscribeEvents(...eventTypes: string[]): void {
		if (!this._socket) throw new Error("RealtimeClient not connected");
		const rooms = eventTypes.map((t) => `event:${t}`);
		this._socket.emit("leave", { rooms });
	}

	/**
	 * Subscribe to the `all` broadcast room (receives all events).
	 */
	subscribeAll(): void {
		if (!this._socket) throw new Error("RealtimeClient not connected");
		this._socket.emit("join", { rooms: ["all"] });
	}

	/**
	 * Subscribe to a locale-specific room.
	 */
	subscribeLocale(locale: string): void {
		if (!this._socket) throw new Error("RealtimeClient not connected");
		this._socket.emit("join", { rooms: [`locale:${locale}`] });
	}

	/**
	 * Unsubscribe from a locale-specific room.
	 */
	unsubscribeLocale(locale: string): void {
		if (!this._socket) throw new Error("RealtimeClient not connected");
		this._socket.emit("leave", { rooms: [`locale:${locale}`] });
	}

	/**
	 * Join arbitrary rooms by name.
	 */
	joinRooms(rooms: string[]): void {
		if (!this._socket) throw new Error("RealtimeClient not connected");
		this._socket.emit("join", { rooms });
	}

	/**
	 * Leave arbitrary rooms by name.
	 */
	leaveRooms(rooms: string[]): void {
		if (!this._socket) throw new Error("RealtimeClient not connected");
		this._socket.emit("leave", { rooms });
	}

	/**
	 * Send a ping to the server.
	 */
	ping(): void {
		if (!this._socket) throw new Error("RealtimeClient not connected");
		this._socket.emit("ping");
	}

	/**
	 * Register a handler for a specific event type.
	 *
	 * Domain events (task_created, task_status_changed, etc.) are dispatched
	 * via the message envelope. Raw socket events (connect, disconnect,
	 * connection_established, rooms_updated, pong) are wired directly.
	 */
	on(event: string, handler: EventHandler): void {
		if (!this._handlers.has(event)) {
			this._handlers.set(event, new Set());
			// For raw socket events that arrive outside the message envelope,
			// also wire up a direct socket listener so they still fire.
			if (this._socket) {
				const rawSocketEvents = new Set([
					"connect",
					"disconnect",
					"connect_error",
					"connection_established",
					"rooms_updated",
					"pong",
				]);
				if (rawSocketEvents.has(event)) {
					this._socket.on(event, (...args: unknown[]) => {
						const handlers = this._handlers.get(event);
						if (handlers) {
							for (const h of handlers) {
								h(...args);
							}
						}
					});
				}
			}
		}
		const handlers = this._handlers.get(event);
		if (handlers) {
			handlers.add(handler);
		}
	}

	/**
	 * Remove a registered handler.
	 */
	off(event: string, handler: EventHandler): void {
		const handlers = this._handlers.get(event);
		if (handlers) {
			handlers.delete(handler);
			if (handlers.size === 0) {
				this._handlers.delete(event);
				if (this._socket) {
					this._socket.off(event);
				}
			}
		}
	}

	/**
	 * Wait for the connection to close (for long-running listeners).
	 */
	wait(): Promise<void> {
		return new Promise((resolve) => {
			if (!this._socket) {
				resolve();
				return;
			}
			this._socket.on("disconnect", () => resolve());
		});
	}
}
