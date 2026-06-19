import Link from "next/link"
import AuthNav from "@/components/AuthNav"
import MobileHeaderMenu from "@/components/MobileHeaderMenu"

const navLinkStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "1px",
  color: "var(--muted)",
  textTransform: "uppercase",
  transition: "color 0.15s ease",
  padding: "4px 0",
  borderBottom: "1px solid transparent",
} as const

export default function Header() {
  return (
    <header style={{
      position: "sticky",
      top: 0,
      zIndex: 100,
      borderBottom: "1px solid var(--border)",
      backdropFilter: "blur(12px) saturate(180%)",
      WebkitBackdropFilter: "blur(12px) saturate(180%)",
      backgroundColor: "rgba(9, 9, 12, 0.92)",
    }}>
      <div
        className="public-header-top"
        style={{
        borderBottom: "1px solid var(--border)",
        padding: "6px 32px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <span
          className="public-header-date"
          style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--muted)",
          letterSpacing: "1px",
        }}>
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }).toUpperCase()}
        </span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "1.5px",
            color: "var(--positive)",
          }}>
            <span style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--positive)",
              animation: "pulse-live 2s ease-in-out infinite",
              display: "inline-block",
            }} />
            LIVE
          </span>
          <AuthNav />
        </div>
      </div>

      <div
        className="public-header-mobile mobile-only"
        style={{ display: "none" }}
      >
        <Link href="/" style={{
          fontFamily: "var(--font-display)",
          fontSize: 21,
          fontWeight: 900,
          fontStyle: "italic",
          color: "var(--text)",
          letterSpacing: "-0.5px",
          whiteSpace: "nowrap",
        }}>
          LivePulse
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "1px",
            color: "var(--positive)",
          }}>
            <span style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--positive)",
              animation: "pulse-live 2s ease-in-out infinite",
              display: "inline-block",
            }} />
            LIVE
          </span>
          <MobileHeaderMenu authSlot={<AuthNav />} />
        </div>
      </div>

      <div
        className="public-header-main"
        style={{
        padding: "0 32px",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        height: 72,
      }}>
        <nav style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {[
            { href: "/", label: "Feed" },
            { href: "/digest", label: "Digest" },
            { href: "/ai-news", label: "AI Reports" },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={navLinkStyle}>
              {label}
            </Link>
          ))}
        </nav>

        <Link href="/" style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 900,
          fontStyle: "italic",
          color: "var(--text)",
          letterSpacing: "-0.5px",
          whiteSpace: "nowrap",
          textAlign: "center",
        }}>
          LivePulse
        </Link>

        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 16,
          alignItems: "center",
        }}>
          <Link href="/bookmarks" style={navLinkStyle}>
            Saved
          </Link>
          <Link href="/search" style={navLinkStyle}>
            Search
          </Link>
          <Link href="/settings" style={navLinkStyle}>
            Settings
          </Link>
        </div>
      </div>
    </header>
  )
}
