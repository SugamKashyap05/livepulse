import { prisma } from "@/lib/db"
import NewsroomClient from "@/components/admin/NewsroomClient"

export const dynamic = "force-dynamic"

export default async function NewsroomPage() {
  const activity = await prisma.agentActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  // Convert Date objects to strings for the client component
  const serializedActivity = activity.map((a: any) => ({
    ...a,
    createdAt: a.createdAt.toISOString()
  }))

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 32,
          fontWeight: 900,
          color: "var(--text)",
          marginBottom: 8,
        }}>
          Agentic Newsroom
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          Autonomous AI agents working in cycles to scan, verify, and de-bias your global publication.
        </p>
      </header>

      <NewsroomClient initialActivity={serializedActivity} />
    </div>
  )
}
