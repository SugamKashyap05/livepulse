"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV = [
  { label: "Dashboard", href: "/admin", icon: "📊" },
  { label: "Newsroom", href: "/admin/newsroom", icon: "📡" },
  { label: "AI Manager", href: "/admin/ai-manager", icon: "✦" },
  { label: "Sources", href: "/admin/sources", icon: "📂" },
  { label: "Articles", href: "/admin/articles", icon: "📰" },
  { label: "Health", href: "/admin/health", icon: "🔋" },
  { label: "Settings", href: "/admin/settings", icon: "⚙️" },
]

export default function AdminSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("admin-sidebar-collapsed") === "true"
  })
  const pathname = usePathname()

  const toggleCollapse = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    localStorage.setItem("admin-sidebar-collapsed", String(next))
  }

  return (
    <aside style={{
      width: isCollapsed ? 70 : 220,
      background: "var(--surface)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      flexShrink: 0,
      position: "sticky",
      top: 0,
      height: "100vh",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px",
        height: 80,
        display: "flex",
        flexDirection: isCollapsed ? "column" : "row",
        alignItems: "center",
        justifyContent: isCollapsed ? "center" : "space-between",
        borderBottom: "1px solid var(--border)",
        gap: 12,
      }}>
        {!isCollapsed && (
          <div>
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
              Admin
            </div>
          </div>
        )}
        
        <button 
          onClick={toggleCollapse}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--muted)",
            fontSize: 10,
          }}
        >
          {isCollapsed ? "→" : "←"}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ padding: "12px 6px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {NAV.map((item) => {
          const isActive = item.href === "/admin"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: isCollapsed ? "center" : "flex-start",
                gap: 12,
                padding: "12px 14px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: isActive ? "var(--accent)" : "var(--muted)",
                textDecoration: "none",
                borderRadius: 4,
                background: isActive ? "rgba(74,240,196,0.05)" : "transparent",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
              title={isCollapsed ? item.label : ""}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: "16px",
        borderTop: "1px solid var(--border)",
        display: "flex",
        justifyContent: isCollapsed ? "center" : "flex-start",
      }}>
        <Link
          href="/"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            color: "var(--muted)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span>🏠</span>
          {!isCollapsed && <span>EXIT ADMIN</span>}
        </Link>
      </div>
    </aside>
  )
}
