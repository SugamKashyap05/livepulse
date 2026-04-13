import Link from "next/link"

const NAV = [
  { label: "Dashboard", href: "/admin" },
  { label: "AI Manager", href: "/admin/ai-manager" },
  { label: "Sources", href: "/admin/sources" },
  { label: "Articles", href: "/admin/articles" },
  { label: "Health", href: "/admin/health" },
  { label: "Settings", href: "/admin/settings" },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "var(--bg)",
    }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        height: "100vh",
      }}>
        {/* Logo */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid var(--border)",
        }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 20,
              fontWeight: 900,
              color: "var(--text)",
              letterSpacing: -0.5,
            }}>
              LivePulse
            </div>
          </Link>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            letterSpacing: "2px",
            color: "var(--accent)",
            textTransform: "uppercase",
            marginTop: 2,
          }}>
            Admin Panel
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 0", flex: 1 }}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "block",
                padding: "10px 20px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: "var(--muted)",
                textDecoration: "none",
                borderLeft: "2px solid transparent",
                transition: "color 0.2s",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Back to site */}
        <div style={{
          padding: "16px 20px",
          borderTop: "1px solid var(--border)",
        }}>
          <Link
            href="/"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              letterSpacing: "1px",
              color: "var(--muted)",
              textDecoration: "none",
              textTransform: "uppercase",
            }}
          >
            ← Back to site
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto", padding: "32px" }}>
        {children}
      </main>
    </div>
  )
}
