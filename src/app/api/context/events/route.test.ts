import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "./route"
import { NextResponse } from "next/server"

// Mock the dependencies
vi.mock("@/lib/auth", () => ({
  getMutableCurrentUserId: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    userProfile: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/contextEngine", () => ({
  normalizeContextEvent: vi.fn((input) => input), // pass through
  recordContextEvents: vi.fn().mockResolvedValue({ accepted: 1 }),
}))

import { getMutableCurrentUserId } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { recordContextEvents } from "@/lib/contextEngine"

describe("POST /api/context/events", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/context/events", {
      method: "POST",
      body: "invalid-json", // This will cause req.json() to fail or we can mock req.json
    })
    
    // Request mock might not fail automatically on "invalid-json", 
    // so we can mock req.json() to throw
    req.json = vi.fn().mockRejectedValueOnce(new Error("Invalid JSON"))

    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Invalid JSON" })
  })

  it("returns 400 when no valid events are provided", async () => {
    const req = new Request("http://localhost/api/context/events", {
      method: "POST",
      body: JSON.stringify({ events: [] }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "No valid events" })
  })

  it("records events successfully for anonymous users", async () => {
    vi.mocked(getMutableCurrentUserId).mockResolvedValueOnce(null)

    const req = new Request("http://localhost/api/context/events", {
      method: "POST",
      body: JSON.stringify({
        anonymousId: "anon-123",
        events: [{ type: "impression", articleId: "1" }],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, accepted: 1 })
    
    expect(recordContextEvents).toHaveBeenCalledWith(expect.objectContaining({
      userId: null,
      anonymousId: "anon-123",
      events: expect.any(Array),
    }))
  })

  it("respects user personalization settings", async () => {
    vi.mocked(getMutableCurrentUserId).mockResolvedValueOnce("user-123")
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValueOnce({ personalizationEnabled: false } as any)

    const req = new Request("http://localhost/api/context/events", {
      method: "POST",
      body: JSON.stringify({
        events: [{ type: "impression", articleId: "1" }],
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    
    // Should be recorded with null userId because personalization is disabled
    expect(recordContextEvents).toHaveBeenCalledWith(expect.objectContaining({
      userId: null,
      anonymousId: null,
    }))
  })
})
