"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AdminNotificationBell } from "@/components/admin/AdminNotificationProvider"

const NAV = [
  { label: "Dashboard", href: "/admin", icon: "D" },
  { label: "Newsroom", href: "/admin/newsroom", icon: "N" },
  { label: "AI Manager", href: "/admin/ai-manager", icon: "AI" },
  { label: "Sources", href: "/admin/sources", icon: "S" },
  { label: "Articles", href: "/admin/articles", icon: "A" },
  { label: "Health", href: "/admin/health", icon: "H" },
  { label: "Analytics", href: "/admin/analytics", icon: "📊" },
  { label: "Settings", href: "/admin/settings", icon: "SET" },
]

export default function AdminSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("admin-sidebar-collapsed") === "true"
  )
  const pathname = usePathname()

  const toggleCollapse = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    localStorage.setItem("admin-sidebar-collapsed", String(next))
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" })
    window.location.href = "/admin/login"
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
      <div style={{
        padding: 20,
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
                fontFamily: "var(--font-display)",
                fontSize: 20,
                fontWeight: 900,
                color: "var(--text)",
                letterSpacing: -0.5,
              }}>
                LivePulse
              </div>
            </Link>
            <div style={{
              fontFamily: "var(--font-mono)",
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
          type="button"
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
          {isCollapsed ? ">" : "<"}
        </button>
      </div>

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
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: isActive ? "var(--accent)" : "var(--muted)",
                borderRadius: 4,
                background: isActive ? "var(--accent-dim)" : "transparent",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
              title={isCollapsed ? item.label : ""}
            >
              <span style={{ fontSize: 11, minWidth: 18, textAlign: "center" }}>{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      <div style={{
        padding: 16,
        borderTop: "1px solid var(--border)",
        display: "grid",
        gap: 10,
      }}>
        <AdminNotificationBell collapsed={isCollapsed} />
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap: 10,
          }}
        >
          <span>EXIT</span>
          {!isCollapsed && <span>EXIT ADMIN</span>}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--red)",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 3,
            padding: isCollapsed ? "8px 0" : "8px 10px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap: 10,
            textTransform: "uppercase",
          }}
        >
          <span>OUT</span>
          {!isCollapsed && <span>LOGOUT</span>}
        </button>
      </div>
    </aside>
  )
}
