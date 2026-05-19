/**
 * Typed exception hierarchy for orchestrator API interactions.
 *
 * Every error carries `statusCode` and `errorCode` extracted from the
 * server's uniform error envelope, making it easy for callers to handle
 * specific error conditions programmatically.
 */

/**
 * Base error for all orchestrator-related errors.
 */
export class OrchestratorError extends Error {
  public readonly statusCode: number | null
  public readonly errorCode: string | null
  public readonly details: Record<string, unknown>

  constructor(
    message: string,
    opts?: {
      statusCode?: number | null
      errorCode?: string | null
      details?: Record<string, unknown>
    },
  ) {
    super(message)
    this.name = "OrchestratorError"
    this.statusCode = opts?.statusCode ?? null
    this.errorCode = opts?.errorCode ?? null
    this.details = opts?.details ?? {}
  }
}

/**
 * Orchestrator is unreachable (network / DNS / timeout).
 */
export class OrchestratorConnectionError extends OrchestratorError {
  constructor(message: string) {
    super(message, { statusCode: null })
    this.name = "OrchestratorConnectionError"
  }
}

/**
 * Authentication or authorization failure (401/403).
 */
export class OrchestratorAuthError extends OrchestratorError {
  constructor(message: string, statusCode: number = 401) {
    super(message, { statusCode })
    this.name = "OrchestratorAuthError"
  }
}

/**
 * Requested resource does not exist (404).
 */
export class OrchestratorNotFoundError extends OrchestratorError {
  public readonly resourceType: string
  public readonly resourceId: string

  constructor(resourceType: string, resourceId: string, message?: string) {
    super(message ?? `${resourceType} not found: ${resourceId}`, {
      statusCode: 404,
    })
    this.name = "OrchestratorNotFoundError"
    this.resourceType = resourceType
    this.resourceId = resourceId
  }
}

/**
 * Non-2xx response from the orchestrator API.
 *
 * Covers 400 Bad Request, 500 Internal Server Error, and any other
 * unexpected status that isn't auth or not-found specific.
 */
export class OrchestratorAPIError extends OrchestratorError {
  constructor(
    message: string,
    statusCode: number,
    errorCode?: string | null,
    details?: Record<string, unknown>,
  ) {
    super(message, { statusCode, errorCode, details })
    this.name = "OrchestratorAPIError"
  }
}

/**
 * Invalid or missing client configuration (bad env vars, etc.).
 */
export class OrchestratorConfigError extends OrchestratorError {
  constructor(message: string) {
    super(message, { statusCode: null })
    this.name = "OrchestratorConfigError"
  }
}
