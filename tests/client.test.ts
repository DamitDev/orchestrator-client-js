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
    const url = (client as unknown as { _makeUrl: (p: string) => string })._makeUrl("/health")
    expect(url).toBe("http://localhost:8080/health")
  })

  it("uses custom fetch when provided", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", message: "mock", version: "1.0" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )
    const client = new OrchestratorAsync({
      baseUrl: "http://localhost:8080",
      fetch: mockFetch,
    })
    const result = await client.health()
    expect(result.status).toBe("ok")
    expect(mockFetch).toHaveBeenCalled()
  })

  it("sets _insecure flag when insecure: true in Node.js", () => {
    // In Node.js test environment, process.versions.node exists
    const client = new OrchestratorAsync({
      baseUrl: "https://localhost:8443",
      insecure: true,
    }) as unknown as { _insecure: boolean }
    expect(client._insecure).toBe(true)
  })

  it("does not set _insecure when insecure: true but custom fetch provided", () => {
    const mockFetch = vi.fn()
    const client = new OrchestratorAsync({
      baseUrl: "https://localhost:8443",
      insecure: true,
      fetch: mockFetch,
    }) as unknown as { _insecure: boolean }
    expect(client._insecure).toBe(false)
  })
})

describe("OrchestratorAsync health", () => {
  it("uses injected fetch for API calls", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", message: "healthy", version: "1.0" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )
    const client = new OrchestratorAsync({
      baseUrl: "http://localhost:8080",
      fetch: mockFetch,
    })
    const result = await client.health()
    expect(result).toEqual({ status: "ok", message: "healthy", version: "1.0" })
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8080/health",
      expect.objectContaining({ method: "GET" }),
    )
  })
})

// ---------------------------------------------------------------------------
// VSA delegated token
// ---------------------------------------------------------------------------

describe("OrchestratorAsync VSA delegated token", () => {
  it("includes delegated_token in createVSATask body when provided", async () => {
    let capturedBody: unknown
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return new Response(
        JSON.stringify({ task_id: "vsa-1", status: "queued" }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    })
    const client = new OrchestratorAsync({ baseUrl: "http://localhost:8080", fetch: mockFetch })
    await client.createVSATask({
      goalPrompt: "AiDIT kérdés",
      delegatedToken: "eyJhbGciOiJSUzI1NiJ9.test",
    })
    expect((capturedBody as Record<string, unknown>).delegated_token).toBe(
      "eyJhbGciOiJSUzI1NiJ9.test",
    )
  })

  it("omits delegated_token from createVSATask body when not provided", async () => {
    let capturedBody: unknown
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return new Response(
        JSON.stringify({ task_id: "vsa-2", status: "queued" }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    })
    const client = new OrchestratorAsync({ baseUrl: "http://localhost:8080", fetch: mockFetch })
    await client.createVSATask({ goalPrompt: "Kérdés" })
    expect((capturedBody as Record<string, unknown>).delegated_token).toBeUndefined()
  })

  it("includes delegated_token in sendVSAMessage body when provided", async () => {
    let capturedBody: unknown
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return new Response(
        JSON.stringify({ message: "ok" }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    })
    const client = new OrchestratorAsync({ baseUrl: "http://localhost:8080", fetch: mockFetch })
    await client.sendVSAMessage("task-1", "Hello", { delegatedToken: "fresh-tok" })
    expect((capturedBody as Record<string, unknown>).delegated_token).toBe("fresh-tok")
  })

  it("omits delegated_token from sendVSAMessage body when not provided", async () => {
    let capturedBody: unknown
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return new Response(
        JSON.stringify({ message: "ok" }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    })
    const client = new OrchestratorAsync({ baseUrl: "http://localhost:8080", fetch: mockFetch })
    await client.sendVSAMessage("task-1", "Hello")
    expect((capturedBody as Record<string, unknown>).delegated_token).toBeUndefined()
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
