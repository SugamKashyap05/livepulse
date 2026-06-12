"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { CSSProperties, ReactNode } from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"

type NotificationJob = {
  id: string
  type: string
  status: string
  title: string
  createdAt: string
  completedAt: string | null
}

export type AdminNotification = {
  id: string
  type: string
  title: string
  body: string
  status: string
  jobId: string | null
  department?: string | null
  severity?: string | null
  departmentEventId?: string | null
  readAt: string | null
  createdAt: string
  job?: NotificationJob | null
}

type NotificationContextValue = {
  notifications: AdminNotification[]
  unreadCount: number
  refresh: () => Promise<boolean>
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  refresh: async () => false,
})

export function useAdminNotifications() {
  return useContext(NotificationContext)
}

export default function AdminNotificationProvider({
  children,
}: {
  children: ReactNode
}) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const latestNotificationIdRef = useRef<string | null>(null)
  const pollIntervalRef = useRef(5000)
  const pathname = usePathname()
  const isLoginPage = pathname === "/admin/login"

  const refresh = useCallback(async (): Promise<boolean> => {
    if (isLoginPage) return false

    try {
      const res = await fetch("/api/admin/notifications")
      if (res.status === 401) {
        window.location.href = "/admin/login?next=/admin"
        return false
      }
      if (!res.ok) return false
      const data = await res.json()
      const nextNotifications = Array.isArray(data.notifications)
        ? data.notifications
        : []
      const latestId = nextNotifications[0]?.id ?? null
      const hadNewItems =
        latestId !== null && latestId !== latestNotificationIdRef.current

      latestNotificationIdRef.current = latestId
      setNotifications(nextNotifications)
      setUnreadCount(Number(data.unreadCount ?? 0))

      const hasQueued = nextNotifications.some(
        (item: AdminNotification) =>
          item.job?.status === "queued" || item.job?.status === "running"
      )
      if (hasQueued) {
        fetch("/api/admin/ai/jobs/run-next", { method: "POST" }).catch(() => {})
      }

      pollIntervalRef.current = hadNewItems
        ? 5000
        : Math.min(Math.round(pollIntervalRef.current * 1.5), 30000)

      return hadNewItems
    } catch (error) {
      console.error("[admin notifications] refresh failed:", error)
      return false
    }
  }, [isLoginPage])

  useEffect(() => {
    if (isLoginPage) return

    let stopped = false
    let timeout: ReturnType<typeof setTimeout> | null = null

    async function startPolling() {
      await refresh()
      if (!stopped) {
        timeout = setTimeout(startPolling, pollIntervalRef.current)
      }
    }

    startPolling()

    return () => {
      stopped = true
      if (timeout) clearTimeout(timeout)
    }
  }, [isLoginPage, refresh])

  const value = useMemo(
    () => ({ notifications, unreadCount, refresh }),
    [notifications, unreadCount, refresh]
  )

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function AdminNotificationBell({
  collapsed = false,
  placement = "sidebar",
}: {
  collapsed?: boolean
  placement?: "sidebar" | "top"
}) {
  const { notifications, unreadCount, refresh } = useAdminNotifications()
  const [open, setOpen] = useState(false)

  async function markAllRead() {
    await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {})
    refresh()
  }

  return (
    <div style={bellShellStyle}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title="Admin notifications"
        style={{
          ...bellButtonStyle,
          width: placement === "top" ? "auto" : "100%",
          minWidth: placement === "top" ? 170 : undefined,
          justifyContent: collapsed ? "center" : "space-between",
        }}
      >
        <span>{collapsed ? "!" : "NOTIFICATIONS"}</span>
        {unreadCount > 0 && <span style={badgeStyle}>{unreadCount}</span>}
      </button>

      {open && (
        <div
          style={{
            ...dropdownStyle,
            ...(placement === "top" ? topDropdownStyle : sidebarDropdownStyle),
            ...(placement === "sidebar" && collapsed ? collapsedSidebarDropdownStyle : null),
          }}
        >
          <div style={dropdownHeaderStyle}>
            <span>AI TASKS</span>
            <button type="button" onClick={markAllRead} style={markReadStyle}>
              MARK READ
            </button>
          </div>

          {notifications.length === 0 ? (
            <div style={emptyStyle}>No notifications yet.</div>
          ) : (
            notifications.slice(0, 8).map((item) => (
              <div
                key={item.id}
                style={{
                  ...notificationItemStyle,
                  opacity: item.readAt ? 0.62 : 1,
                }}
              >
                <div style={notificationTitleStyle}>{item.title}</div>
                <div style={notificationBodyStyle}>{item.body}</div>
                <div style={notificationMetaStyle}>
                  <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                  {item.job && <span>{item.job.status.toUpperCase()}</span>}
                </div>
              </div>
            ))
          )}

          <div style={dropdownFooterStyle}>
            <Link href="/admin/ai-manager" style={footerLinkStyle}>
              AI MANAGER
            </Link>
            <Link href="/admin/newsroom" style={footerLinkStyle}>
              NEWSROOM
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

const bellShellStyle: CSSProperties = {
  position: "relative",
  display: "inline-flex",
}

const bellButtonStyle: CSSProperties = {
  width: "100%",
  minHeight: 34,
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  color: "var(--text-dim)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  letterSpacing: "0.8px",
  cursor: "pointer",
}

const badgeStyle: CSSProperties = {
  minWidth: 18,
  height: 18,
  padding: "0 5px",
  borderRadius: 9,
  background: "var(--accent)",
  color: "#000",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 9,
  fontWeight: 700,
}

const dropdownStyle: CSSProperties = {
  position: "absolute",
  width: 360,
  maxHeight: 480,
  overflowY: "auto",
  background: "var(--surface)",
  border: "1px solid var(--border2)",
  borderRadius: 6,
  boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
  zIndex: 100,
}

const sidebarDropdownStyle: CSSProperties = {
  position: "fixed",
  left: 232,
  bottom: 24,
  zIndex: 1000,
}

const collapsedSidebarDropdownStyle: CSSProperties = {
  left: 82,
}

const topDropdownStyle: CSSProperties = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 8px)",
}

const dropdownHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 12px",
  borderBottom: "1px solid var(--border)",
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1px",
}

const markReadStyle: CSSProperties = {
  color: "var(--muted)",
  fontSize: 9,
  cursor: "pointer",
}

const emptyStyle: CSSProperties = {
  padding: 16,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
}

const notificationItemStyle: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid var(--border)",
}

const notificationTitleStyle: CSSProperties = {
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  marginBottom: 5,
}

const notificationBodyStyle: CSSProperties = {
  color: "var(--text-dim)",
  fontSize: 12,
  lineHeight: 1.45,
}

const notificationMetaStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 8,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}

const dropdownFooterStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  padding: 10,
}

const footerLinkStyle: CSSProperties = {
  flex: 1,
  padding: "7px 8px",
  border: "1px solid var(--border)",
  borderRadius: 4,
  color: "var(--accent)",
  textAlign: "center",
  fontFamily: "var(--font-mono)",
  fontSize: 9,
}
