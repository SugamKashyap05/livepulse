import { prisma } from "@/lib/db"
import BatchActionButton from "./BatchActions"

export const dynamic = "force-dynamic"

export default async function AiManagerPage() {
  const [
    totalArticles,
    summarizedCount,
    taggedCount,
    scoredCount,
    aiLogs,
  ] = await Promise.all([
    prisma.newsArticle.count(),
    prisma.newsArticle.count({ where: { summary: { not: null } } }),
    prisma.newsArticle.count({ where: { aiTags: { not: null } } }),
    prisma.newsArticle.count({ where: { scored: true } }),
    prisma.aiLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ])

  const unscoredArticles = await prisma.newsArticle.findMany({
    where: { scored: false },
    take: 10,
    select: { id: true, title: true }
  })
  
  const untaggedArticles = await prisma.newsArticle.findMany({
    where: { aiTags: null },
    take: 10,
    select: { id: true, title: true }
  })

  return (
    <div style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 32,
          fontWeight: 900,
          margin: 0,
          marginBottom: 8,
          letterSpacing: -0.5,
        }}>
          AI Manager
        </h1>
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
          color: "var(--muted)",
          margin: 0,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}>
          Control and monitor Ollama intelligence
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 20,
        marginBottom: 40,
      }}>
        {[
          { label: "Total Articles", val: totalArticles },
          { label: "Summarized", val: summarizedCount },
          { label: "AI Tagged", val: taggedCount },
          { label: "Sentiment Scored", val: scoredCount },
        ].map((stat, i) => (
          <div key={i} style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "20px",
            borderRadius: 8,
          }}>
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 8,
            }}>{stat.label}</div>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              fontFamily: "'Playfair Display', serif",
            }}>{stat.val}</div>
          </div>
        ))}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 320px",
        gap: 32,
      }}>
        {/* Actions Section */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <section style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "24px",
            borderRadius: 12,
          }}>
            <h2 style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
              margin: "0 0 20px 0",
              color: "var(--accent)",
            }}>Batch Processing</h2>
            
            <div style={{ display: "flex", gap: 16 }}>
               <BatchActionButton 
                action="sentiment" 
                articleIds={unscoredArticles.map(a => a.id)} 
                label={`Score Sentiment (${unscoredArticles.length} pending)`} 
              />
              <BatchActionButton 
                action="tag" 
                articleIds={untaggedArticles.map(a => a.id)} 
                label={`Auto Tag (${untaggedArticles.length} pending)`} 
              />
            </div>
          </section>

          {/* AI Logs */}
          <section>
            <h2 style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
              margin: "0 0 16px 0",
              color: "var(--muted)",
            }}>Action Logs (Last 20)</h2>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              background: "var(--border)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              overflow: "hidden",
            }}>
              {aiLogs.length === 0 ? (
                 <div style={{ padding: 20, background: "var(--surface)", color: "var(--muted)", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}>
                    No logs found. Run some AI actions to see them here.
                 </div>
              ) : aiLogs.map((log: any) => (
                <div key={log.id} style={{
                  padding: "12px 16px",
                  background: "var(--surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: 11,
                  fontFamily: "'IBM Plex Mono', monospace",
                }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ color: "var(--accent)", textTransform: "uppercase" }}>{log.action}</span>
                    <span style={{ color: "var(--muted)", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.prompt || "No prompt data"}</span>
                  </div>
                  <div style={{ color: "var(--muted)" }}>
                    {log.createdAt.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar Panel */}
        <aside style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <section style={{
            background: "rgba(74,240,196,0.03)",
            border: "1px solid rgba(74,240,196,0.1)",
            padding: "20px",
            borderRadius: 12,
          }}>
            <h3 style={{
              fontSize: 10,
              fontFamily: "'IBM Plex Mono', monospace",
              color: "#4af0c4",
              textTransform: "uppercase",
              paddingBottom: 12,
              borderBottom: "1px solid rgba(74,240,196,0.1)",
              marginBottom: 16,
              margin: 0,
            }}>
              Ollama Configuration
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "var(--muted)" }}>Status</span>
                    <span style={{ color: "#4af0c4" }}>Connected</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "var(--muted)" }}>Active Model</span>
                    <span>{process.env.OLLAMA_MODEL || "llama3"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "var(--muted)" }}>Base URL</span>
                    <span>localhost:11434</span>
                </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
