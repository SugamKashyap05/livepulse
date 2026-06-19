/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getLivePulseAnonymousId, getLivePulseSessionId, clearLivePulseTelemetryIdentity, createPageViewId } from "./contextTelemetry"

describe("contextTelemetry", () => {
  beforeEach(() => {
    clearLivePulseTelemetryIdentity()
    // Mock crypto.randomUUID
    vi.stubGlobal("crypto", {
      randomUUID: () => "mock-uuid"
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("getLivePulseAnonymousId", () => {
    it("generates a new ID and stores it in localStorage", () => {
      const id = getLivePulseAnonymousId()
      expect(id).toBe("anon_mock-uuid")
      expect(localStorage.getItem("livepulse.anonymousId")).toBe("anon_mock-uuid")
    })

    it("returns existing ID from localStorage", () => {
      localStorage.setItem("livepulse.anonymousId", "existing-anon")
      const id = getLivePulseAnonymousId()
      expect(id).toBe("existing-anon")
    })
  })

  describe("getLivePulseSessionId", () => {
    it("generates a new ID and stores it in sessionStorage", () => {
      const id = getLivePulseSessionId()
      expect(id).toBe("session_mock-uuid")
      expect(sessionStorage.getItem("livepulse.sessionId")).toBe("session_mock-uuid")
    })

    it("returns existing ID from sessionStorage", () => {
      sessionStorage.setItem("livepulse.sessionId", "existing-session")
      const id = getLivePulseSessionId()
      expect(id).toBe("existing-session")
    })
  })

  describe("clearLivePulseTelemetryIdentity", () => {
    it("removes items from storage", () => {
      localStorage.setItem("livepulse.anonymousId", "test")
      sessionStorage.setItem("livepulse.sessionId", "test")
      
      clearLivePulseTelemetryIdentity()
      
      expect(localStorage.getItem("livepulse.anonymousId")).toBeNull()
      expect(sessionStorage.getItem("livepulse.sessionId")).toBeNull()
    })
  })

  describe("createPageViewId", () => {
    it("creates a view id", () => {
      expect(createPageViewId()).toBe("view_mock-uuid")
    })
  })
})
