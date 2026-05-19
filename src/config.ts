/**
 * Environment-based configuration for the orchestrator client.
 *
 * All settings are read from environment variables with sensible defaults,
 * so upstream applications can configure the client without passing args.
 */

export interface OrchestratorConfig {
  /** Base URL of the orchestrator (e.g. "http://localhost:8080"). */
  baseUrl: string
  /** Optional static bearer token sent as `Authorization: Bearer <key>`. */
  apiKey?: string
  /** Default timeout in milliseconds for HTTP requests. */
  timeoutMs: number
  /** Maximum retry attempts on transient failures. */
  maxRetries: number
}

const DEFAULTS: OrchestratorConfig = {
  baseUrl: "http://localhost:8080",
  apiKey: undefined,
  timeoutMs: 30_000,
  maxRetries: 3,
}

/**
 * Build configuration from environment variables.
 *
 * - `ORCHESTRATOR_URL` — base URL (default: "http://localhost:8080")
 * - `ORCHESTRATOR_API_KEY` — optional bearer token
 * - `ORCHESTRATOR_TIMEOUT_MS` — timeout in ms (default: 30000)
 * - `ORCHESTRATOR_MAX_RETRIES` — max retries (default: 3)
 */
export function loadConfig(
  overrides?: Partial<OrchestratorConfig>,
): OrchestratorConfig {
  return {
    baseUrl: (
      process.env.ORCHESTRATOR_URL ??
      overrides?.baseUrl ??
      DEFAULTS.baseUrl
    ).replace(/\/+$/, ""),
    apiKey:
      process.env.ORCHESTRATOR_API_KEY ??
      overrides?.apiKey ??
      DEFAULTS.apiKey,
    timeoutMs: Number(
      process.env.ORCHESTRATOR_TIMEOUT_MS ??
        overrides?.timeoutMs ??
        DEFAULTS.timeoutMs,
    ),
    maxRetries: Number(
      process.env.ORCHESTRATOR_MAX_RETRIES ??
        overrides?.maxRetries ??
        DEFAULTS.maxRetries,
    ),
  }
}
