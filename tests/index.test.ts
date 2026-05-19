import { describe, it, expect } from "vitest"
import {
  VERSION,
  OrchestratorAsync,
  Orchestrator,
  loadConfig,
  OrchestratorError,
  OrchestratorConnectionError,
  OrchestratorAuthError,
  OrchestratorNotFoundError,
  OrchestratorAPIError,
  OrchestratorConfigError,
} from "../src/index.js"

describe("package exports", () => {
  it("exposes VERSION", () => {
    expect(VERSION).toBe("5.6.0")
  })

  it("exposes OrchestratorAsync", () => {
    expect(OrchestratorAsync).toBeDefined()
  })

  it("exposes Orchestrator", () => {
    expect(Orchestrator).toBeDefined()
  })

  it("exposes loadConfig", () => {
    expect(loadConfig).toBeDefined()
  })

  it("exposes error classes", () => {
    expect(OrchestratorError).toBeDefined()
    expect(OrchestratorConnectionError).toBeDefined()
    expect(OrchestratorAuthError).toBeDefined()
    expect(OrchestratorNotFoundError).toBeDefined()
    expect(OrchestratorAPIError).toBeDefined()
    expect(OrchestratorConfigError).toBeDefined()
  })
})
