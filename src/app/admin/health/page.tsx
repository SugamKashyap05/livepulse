import { FEED_SOURCES } from "@/lib/sources"
import HealthClient from "@/components/admin/HealthClient"

export const dynamic = "force-dynamic"

export default function HealthPage() {
  const sources = FEED_SOURCES.map((s) => ({
    name: s.name,
    url: s.url,
    topic: s.topic,
  }))

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 28,
          fontWeight: 700,
          color: "var(--text)",
          margin: 0,
        }}>
          Feed Health
        </h1>
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: "var(--muted)",
          marginTop: 6,
        }}>
          Live ping all RSS sources to check availability
        </p>
      </div>
      <HealthClient sources={sources} />
    </div>
  )
}
