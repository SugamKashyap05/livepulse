"use client"

import { useState } from "react"

export default function AdminLoginPage() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function isSafeAdminRedirect(url: string | null): boolean {
    if (!url) return false
    try {
      if (/^[a-z][a-z0-9+\-.]*:/i.test(url)) return false
      if (url.startsWith("//")) return false
      if (url.includes("\\")) return false
      const normalized = new URL(url, "http://localhost").pathname
      return normalized === "/admin" || normalized.startsWith("/admin/")
    } catch {
      return false
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        setError("Invalid admin password")
        return
      }

      const next = new URLSearchParams(window.location.search).get("next")
      const redirectTo = isSafeAdminRedirect(next) ? next : "/admin"
      window.location.href = redirectTo || "/admin"
    } catch {
      setError("Unable to sign in right now")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      padding: 24,
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: 28,
        }}
      >
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 30,
          margin: "0 0 8px",
          color: "var(--text)",
        }}>
          Admin Login
        </h1>
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--muted)",
          margin: "0 0 24px",
        }}>
          Enter the admin secret to continue.
        </p>

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          placeholder="Admin secret"
          style={{
            width: "100%",
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
            borderRadius: 4,
            color: "var(--text)",
            padding: "12px 14px",
            marginBottom: 14,
            outline: "none",
          }}
        />

        {error && (
          <div style={{
            color: "var(--red)",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !password.trim()}
          style={{
            width: "100%",
            background: loading || !password.trim() ? "var(--surface2)" : "var(--accent)",
            border: "none",
            borderRadius: 4,
            color: loading || !password.trim() ? "var(--muted)" : "#000",
            cursor: loading || !password.trim() ? "not-allowed" : "pointer",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            letterSpacing: "1px",
            padding: "12px 14px",
            textTransform: "uppercase",
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  )
}
