import AdminSidebar from "@/components/admin/AdminSidebar"
import AdminNotificationProvider, {
  AdminNotificationBell,
} from "@/components/admin/AdminNotificationProvider"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminNotificationProvider>
      <div style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--bg)",
      }}>
        <AdminSidebar />

        <main style={{ flex: 1, overflow: "auto" }}>
          <div style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            minHeight: 56,
            padding: "10px 32px",
            background: "rgba(10, 11, 18, 0.92)",
            borderBottom: "1px solid var(--border)",
            backdropFilter: "blur(14px)",
          }}>
            <AdminNotificationBell placement="top" />
          </div>
          <div style={{ padding: "32px" }}>
            {children}
          </div>
        </main>
      </div>
    </AdminNotificationProvider>
  )
}
