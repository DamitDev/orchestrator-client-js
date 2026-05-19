import { describe, it, expect, vi, beforeEach } from "vitest"
import { OrchestratorAsync } from "../src/client.js"
import { Orchestrator } from "../src/sync-client.js"
import {
  OrchestratorError,
  OrchestratorConnectionError,
  OrchestratorAuthError,
  OrchestratorNotFoundError,
  OrchestratorAPIError,
  OrchestratorConfigError,
} from "../src/errors.js"
import { loadConfig } from "../src/config.js"

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

describe("errors", () => {
  it("OrchestratorError has correct properties", () => {
    const err = new OrchestratorError("test error", {
      statusCode: 400,
      errorCode: "BAD_REQUEST",
      details: { field: "name" },
    })
    expect(err.message).toBe("test error")
    expect(err.statusCode).toBe(400)
    expect(err.errorCode).toBe("BAD_REQUEST")
    expect(err.details).toEqual({ field: "name" })
  })

  it("OrchestratorConnectionError has null statusCode", () => {
    const err = new OrchestratorConnectionError("connection failed")
    expect(err.statusCode).toBeNull()
    expect(err.name).toBe("OrchestratorConnectionError")
  })

  it("OrchestratorAuthError defaults to 401", () => {
    const err = new OrchestratorAuthError("auth failed")
    expect(err.statusCode).toBe(401)
  })

  it("OrchestratorAuthError accepts custom statusCode", () => {
    const err = new OrchestratorAuthError("forbidden", 403)
    expect(err.statusCode).toBe(403)
  })

  it("OrchestratorNotFoundError includes resource info", () => {
    const err = new OrchestratorNotFoundError("task", "abc123")
    expect(err.statusCode).toBe(404)
    expect(err.resourceType).toBe("task")
    expect(err.resourceId).toBe("abc123")
    expect(err.message).toBe("task not found: abc123")
  })

  it("OrchestratorAPIError carries status code and error code", () => {
    const err = new OrchestratorAPIError("bad request", 400, "INVALID_INPUT", { field: "x" })
    expect(err.statusCode).toBe(400)
    expect(err.errorCode).toBe("INVALID_INPUT")
    expect(err.details).toEqual({ field: "x" })
  })

  it("OrchestratorConfigError has null statusCode", () => {
    const err = new OrchestratorConfigError("missing env var")
    expect(err.statusCode).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

describe("loadConfig", () => {
  const origEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...origEnv }
  })

  it("returns defaults when no env vars set", () => {
    delete process.env.ORCHESTRATOR_URL
    const cfg = loadConfig()
    expect(cfg.baseUrl).toBe("http://localhost:8080")
    expect(cfg.apiKey).toBeUndefined()
    expect(cfg.timeoutMs).toBe(30000)
    expect(cfg.maxRetries).toBe(3)
  })

  it("reads from environment variables", () => {
    process.env.ORCHESTRATOR_URL = "https://oapi.example.com/uat"
    process.env.ORCHESTRATOR_API_KEY = "mykey"
    process.env.ORCHESTRATOR_TIMEOUT_MS = "10000"
    process.env.ORCHESTRATOR_MAX_RETRIES = "5"
    const cfg = loadConfig()
    expect(cfg.baseUrl).toBe("https://oapi.example.com/uat")
    expect(cfg.apiKey).toBe("mykey")
    expect(cfg.timeoutMs).toBe(10000)
    expect(cfg.maxRetries).toBe(5)
  })

  it("overrides take precedence over defaults", () => {
    const cfg = loadConfig({
      baseUrl: "http://custom:8080",
      maxRetries: 1,
    })
    expect(cfg.baseUrl).toBe("http://custom:8080")
    expect(cfg.maxRetries).toBe(1)
  })

  it("strips trailing slashes from baseUrl", () => {
    const cfg = loadConfig({ baseUrl: "http://localhost:8080/" })
    expect(cfg.baseUrl).toBe("http://localhost:8080")
  })
})

// ---------------------------------------------------------------------------
// OrchestratorAsync — basic construction
// ---------------------------------------------------------------------------

describe("OrchestratorAsync", () => {
  it("can be constructed with defaults", () => {
    const client = new OrchestratorAsync()
    expect(client).toBeInstanceOf(OrchestratorAsync)
  })

  it("can be constructed with options", () => {
    const client = new OrchestratorAsync({
      baseUrl: "http://localhost:9090",
      apiKey: "secret",
      timeoutMs: 5000,
      maxRetries: 1,
    })
    expect(client).toBeInstanceOf(OrchestratorAsync)
  })

  it("normalizes baseUrl by stripping trailing slash", () => {
    const client = new OrchestratorAsync({ baseUrl: "http://localhost:8080/" })
    // Verify via internal method
    const url = (client as unknown as { _makeUrl: (p: string) => string })._makeUrl("/health")
    expect(url).toBe("http://localhost:8080/health")
  })
})

// ---------------------------------------------------------------------------
// Orchestrator (sync wrapper)
// ---------------------------------------------------------------------------

describe("Orchestrator", () => {
  it("can be constructed", () => {
    const client = new Orchestrator({ baseUrl: "http://localhost:8080" })
    expect(client).toBeInstanceOf(Orchestrator)
  })

  it("can be closed without error", () => {
    const client = new Orchestrator()
    expect(() => client.close()).not.toThrow()
  })
})
