import AdminSidebar from "@/components/admin/AdminSidebar"

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
      <AdminSidebar />

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto", padding: "32px" }}>
        {children}
      </main>
    </div>
  )
}
