import TelemetryClient from "@/components/admin/TelemetryClient"

export const dynamic = "force-dynamic"

export default function TelemetryPage() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text)",
            margin: 0,
          }}
        >
          Live Telemetry
        </h1>
        <p
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: "var(--muted)",
            marginTop: 6,
          }}
        >
          Real-time AI monitoring: View active jobs, logs, and agent thought streams
        </p>
      </div>

      <TelemetryClient />
    </div>
  )
}
