"use client"

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
        }}>
          The public digest appears here after it is generated and approved from
          the newsroom control plane.
        </div>
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
