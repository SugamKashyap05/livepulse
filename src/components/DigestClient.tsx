"use client"

import Link from "next/link"

export default function DigestClient({
  initialDigest,
}: {
  initialDigest: string | null
}) {
  if (!initialDigest) {
    return (
      <div className="digest-card" style={{
        textAlign: "center",
        padding: "60px 0",
        border: "1px dashed var(--border)",
        borderRadius: 6,
      }}>
        <div className="digest-content" style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
          color: "var(--muted)",
          marginBottom: 10,
        }}>
          No published briefing is available yet for today.
        </div>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--muted)",
          lineHeight: 1.6,
          marginBottom: 20,
        }}>
          The public digest appears here after it is generated and approved from
          the newsroom control plane.
        </div>
        <Link 
          href="/" 
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 16px",
            background: "var(--text)",
            color: "var(--background)",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: 500,
            textDecoration: "none"
          }}
        >
          Browse today's articles →
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="digest-content-area" style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "28px 32px",
        marginBottom: 20,
      }}>
        <div style={{
          fontFamily: "var(--font-ai)",
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.85,
          letterSpacing: "0.005em",
          color: "var(--text)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}>
          {initialDigest}
        </div>
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 10,
          color: "var(--muted)",
          letterSpacing: "1px",
        }}>
          Published newsroom briefing
        </span>
      </div>
    </div>
  )
}
