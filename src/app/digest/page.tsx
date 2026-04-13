import Header from "@/components/Header"

export const dynamic = "force-dynamic"

async function getDigest() {
  // We call the API internally using the absolute URL if possible, 
  // but since it's a server component we can just use the same logic or fetch.
  // For simplicity and to ensure caching logic works, we'll fetch from our own API.
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  try {
    const res = await fetch(`${baseUrl}/api/ai/digest`, { cache: "no-store" })
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    return null
  }
}

export default async function DigestPage() {
  const digest = await getDigest()
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <>
      <Header />
      <main style={{ 
        maxWidth: 800, 
        margin: "0 auto", 
        padding: "60px 24px 100px",
        fontFamily: "var(--font-serif)",
      }}>
        {/* Date / Metadata */}
        <div style={{
          textAlign: "center",
          marginBottom: 48,
        }}>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: "3px",
            marginBottom: 12,
          }}>
            Daily Briefing
          </div>
          <h1 style={{
            fontSize: 48,
            fontWeight: 900,
            fontFamily: "'Playfair Display', serif",
            margin: "0 0 16px 0",
            letterSpacing: -1,
            color: "var(--text)",
          }}>
            Today in LivePulse
          </h1>
          <div style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 13,
            color: "var(--muted)",
          }}>
            {today}
          </div>
        </div>

        {/* Separator */}
        <div style={{
          height: "1px",
          width: 80,
          background: "var(--border)",
          margin: "0 auto 48px",
        }} />

        {/* Digest Content */}
        {!digest ? (
            <div style={{ textAlign: "center", color: "var(--muted)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>
                Preparing today's intelligence... Please refresh in a moment.
            </div>
        ) : (
          <article style={{
            fontSize: 18,
            lineHeight: 1.8,
            color: "var(--text)",
            opacity: 0.9,
          }}>
             <div style={{
                whiteSpace: "pre-wrap",
                fontFamily: "'Inter', sans-serif",
                textAlign: "justify"
             }}>
                {digest.content}
             </div>
          </article>
        )}

        {/* Footer info */}
        <div style={{
          marginTop: 80,
          padding: "32px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          textAlign: "center",
        }}>
            <div style={{ 
                fontFamily: "'IBM Plex Mono', monospace", 
                fontSize: 10, 
                color: "var(--accent)", 
                textTransform: "uppercase",
                marginBottom: 8
            }}>
                Powered by LivePulse AI
            </div>
            <p style={{ 
                margin: 0, 
                fontSize: 13, 
                color: "var(--muted)",
                lineHeight: 1.6
            }}>
                Generated every morning using local LLM synthesis of over 30 global sources.
                No data ever leaves your machine.
            </p>
        </div>
      </main>
    </>
  )
}
