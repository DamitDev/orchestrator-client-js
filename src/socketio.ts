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
	/**
	 * Client identifier sent as the `client_id` query parameter at connection
	 * time.  The server uses this for logging/diagnostics.
	 * Defaults to `"orchestrator-client"`.
	 */
	clientId?: string;
	/**
	 * Locale tag sent as the `locale` query parameter at connection time
	 * (e.g. `"hu-hu"`, `"en-us"`).  When set the server automatically joins
	 * the client into the matching `locale:<tag>` room so translation-ready
	 * events are delivered without a separate `subscribeLocale()` call.
	 */
	locale?: string;
}

/**
 * Socket.IO-based realtime client for receiving orchestrator events.
 *
 * The server wraps all domain events in a `message` Socket.IO event with an
 * inner `event_type` field. This client unwraps the envelope and dispatches
 * to registered handlers by event_type.
 *
 * ## Two subscription APIs — choose one or mix them:
 *
 * ### 1. Event-type handlers via `on(event, handler)`
 * Registers a callback for a specific event type string (e.g.
 * `"task_status_changed"`). You still need to join the relevant rooms
 * manually via `subscribeTask()`, `subscribeEvents()`, etc.
 *
 * ### 2. Room-scoped subscribers via `subscribe(handler, rooms)`
 * Mirrors the WebSocketProvider pattern used in the webui. Each call
 * returns an opaque subscription id. Calling `unsubscribe(id)` removes it.
 * Room membership is kept in sync automatically: the client joins the union
 * of all subscribers' rooms and leaves rooms that are no longer needed.
 * The handler receives the unwrapped event dict for every event from those
 * rooms, regardless of type.
 */
export class RealtimeClient {
	private _baseUrl: string;
	private _socketOptions: Record<string, unknown>;
	private _getToken?: (() => string | Promise<string>) | string;
	private _clientId: string;
	private _locale?: string;
	private _socket: SocketIOClient | null = null;
	private _handlers: Map<string, Set<EventHandler>> = new Map();
	private _connected = false;

	// Multi-subscriber room-diffing state (mirrors WebSocketProvider)
	private _subscriptions: Map<
		string,
		{ handler: EventHandler; rooms: string[] }
	> = new Map();
	private _currentRooms: Set<string> = new Set();
	private _subIdCounter = 0;

	constructor(baseUrl: string, opts: RealtimeClientOptions) {
		this._baseUrl = baseUrl.replace(/\/+$/, "");
		this._socketOptions = opts.socketOptions ?? {};
		this._getToken = opts.getToken;
		this._clientId = opts.clientId ?? "orchestrator-client";
		this._locale = opts.locale;

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

		const query: Record<string, string> = { client_id: this._clientId };
		if (this._locale) {
			query.locale = this._locale;
		}

		// We construct the socket dynamically to avoid a hard import
		const { io } = await import("socket.io-client");
		this._socket = io(this._baseUrl, {
			path: "/socket.io",
			auth,
			query,
			transports: ["websocket", "polling"],
			...this._socketOptions,
		}) as unknown as SocketIOClient;

		this._socket.on("connect", () => {
			this._connected = true;
			// Re-sync rooms after reconnect (server-side room membership is lost)
			this._currentRooms = new Set();
			this._syncRooms();
		});

		this._socket.on("disconnect", () => {
			this._connected = false;
			this._currentRooms = new Set();
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
	 * Dispatch a message envelope to registered handlers and subscribers.
	 * The server sends: socket.emit("message", {type: "message", event: {..., event_type: "...", ...}})
	 */
	private _dispatch(payload: unknown): void {
		const envelope = payload as Record<string, unknown>;
		const event = (envelope.event ?? envelope) as Record<string, unknown>;
		const eventType = event.event_type as string | undefined;
		if (!eventType) return;

		// Dispatch to event-type handlers registered via on()
		const handlers = this._handlers.get(eventType);
		if (handlers) {
			for (const h of handlers) {
				h(event);
			}
		}

		// Fan out to all room-scoped subscribers registered via subscribe()
		for (const sub of this._subscriptions.values()) {
			sub.handler(event);
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

	// ------------------------------------------------------------------
	// Multi-subscriber API (mirrors WebSocketProvider room-diffing)
	// ------------------------------------------------------------------

	/**
	 * Register a subscriber that receives all events from the given rooms.
	 *
	 * Room membership is managed automatically: the client joins the union
	 * of all active subscribers' rooms and leaves rooms that are no longer
	 * needed when the last subscriber referencing them is removed.
	 *
	 * The `handler` receives the unwrapped event dict (same object that
	 * `on()` handlers receive).
	 *
	 * Returns an opaque subscription id that must be passed to
	 * `unsubscribe()` to remove the subscription.
	 *
	 * Example — mirror the webui's per-component subscription pattern:
	 *
	 *   const id = rt.subscribe((event) => {
	 *     if (event.event_type === "task_status_changed") { ... }
	 *   }, [`task:${taskId}`]);
	 *
	 *   // later, on cleanup:
	 *   rt.unsubscribe(id);
	 */
	subscribe(handler: EventHandler, rooms: string[]): string {
		const id = `sub_${++this._subIdCounter}`;
		this._subscriptions.set(id, { handler, rooms });
		this._syncRooms();
		return id;
	}

	/**
	 * Remove a subscription registered via `subscribe()`.
	 *
	 * Rooms that are no longer referenced by any remaining subscriber are
	 * left automatically.
	 */
	unsubscribe(id: string): void {
		this._subscriptions.delete(id);
		this._syncRooms();
	}

	/**
	 * Diff the union of all subscribers' rooms against the currently joined
	 * rooms and emit `join`/`leave` for the delta.  No-ops when not connected.
	 */
	private _syncRooms(): void {
		const socket = this._socket;
		if (!socket?.connected) return;

		const needed = new Set<string>();
		for (const sub of this._subscriptions.values()) {
			for (const r of sub.rooms) needed.add(r);
		}

		const toJoin = [...needed].filter((r) => !this._currentRooms.has(r));
		const toLeave = [...this._currentRooms].filter((r) => !needed.has(r));

		if (toJoin.length) socket.emit("join", { rooms: toJoin });
		if (toLeave.length) socket.emit("leave", { rooms: toLeave });

		this._currentRooms = needed;
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
