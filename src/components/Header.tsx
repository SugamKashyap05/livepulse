import Link from "next/link"

export default function Header() {

  return (
    <header style={{
      background: "var(--bg)",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "var(--accent)",
            animation: "pulse 1.8s ease-in-out infinite",
          }} />
          <span style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 24,
            fontWeight: 900,
            letterSpacing: -1,
            color: "var(--text)",
          }}>
            LivePulse
          </span>
        </div>

        <nav style={{ flex: 1, display: "flex", gap: 24, paddingLeft: 32 }}>
          <Link href="/digest" style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "1px",
            color: "var(--muted)",
            textTransform: "uppercase",
            textDecoration: "none",
          }}>
            Daily Digest
          </Link>
          <Link href="/ai-news" style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "1px",
            color: "var(--accent)",
            textTransform: "uppercase",
            textDecoration: "none",
          }}>
            ✦ AI Intelligence
          </Link>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: "rgba(255,77,77,0.12)",
            border: "1px solid rgba(255,77,77,0.3)",
            color: "var(--red)",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            letterSpacing: "1.5px",
            padding: "3px 8px",
            borderRadius: 2,
          }}>
            <span style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--red)",
              display: "inline-block",
            }} />
            LIVE
          </span>
          <span style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: "var(--muted)",
          }}>
            {new Date().toUTCString().slice(0, 16)}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </header>
  )
}
