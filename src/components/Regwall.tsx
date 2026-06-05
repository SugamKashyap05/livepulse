"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

type RegwallProps = {
  onClose: () => void
}

export default function Regwall({ onClose }: RegwallProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const currentPath = query ? `${pathname}?${query}` : pathname
  const next = encodeURIComponent(currentPath)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="regwall-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(0, 0, 0, 0.72)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 22,
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.45)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 14,
        }}>
          <div
            id="regwall-title"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: "1px",
              color: "var(--accent)",
              textTransform: "uppercase",
            }}
          >
            Keep reading
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close registration prompt"
            style={{
              width: 28,
              height: 28,
              border: "1px solid var(--border)",
              borderRadius: 4,
              background: "var(--surface2)",
              color: "var(--muted)",
              cursor: "pointer",
            }}
          >
            x
          </button>
        </div>

        <h2 style={{
          margin: "0 0 10px",
          fontFamily: "'Playfair Display', serif",
          fontSize: 28,
          lineHeight: 1.15,
          color: "var(--text)",
        }}>
          Create a free LivePulse account
        </h2>

        <p style={{
          margin: "0 0 18px",
          color: "var(--muted)",
          fontSize: 13,
          lineHeight: 1.6,
        }}>
          Sign up to load more stories, keep your personalised feed, save bookmarks,
          and track what you have already read.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Link
            href={`/signup?next=${next}`}
            style={{
              display: "block",
              padding: "10px 12px",
              borderRadius: 4,
              background: "var(--accent)",
              color: "#000",
              textAlign: "center",
              textDecoration: "none",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            Sign up
          </Link>
          <Link
            href={`/login?next=${next}`}
            style={{
              display: "block",
              padding: "10px 12px",
              borderRadius: 4,
              background: "var(--surface2)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              textAlign: "center",
              textDecoration: "none",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
