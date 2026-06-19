"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { clearLivePulseTelemetryIdentity } from "@/lib/contextTelemetry"

type PersonalizationState = {
  personalizationEnabled: boolean
  events: number
  articleContexts: number
  interestProfileExists: boolean
}

export default function SettingsPage() {
  const router = useRouter()
  const [state, setState] = useState<PersonalizationState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch("/api/user/personalization")
        if (response.status === 401) {
          router.push("/login?next=/settings")
          return
        }
        if (!response.ok) throw new Error("load failed")
        const data = (await response.json()) as PersonalizationState
        if (!cancelled) setState(data)
      } catch {
        if (!cancelled) setError("Unable to load personalization settings.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [router])

  async function setPersonalizationEnabled(enabled: boolean) {
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch("/api/user/personalization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalizationEnabled: enabled }),
      })

      if (!response.ok) throw new Error("save failed")
      setState((current) =>
        current ? { ...current, personalizationEnabled: enabled } : current
      )
      setNotice(enabled ? "Personalization is on." : "Personalization is off.")
    } catch {
      setError("Unable to update personalization.")
    } finally {
      setSaving(false)
    }
  }

  async function resetPersonalization() {
    const confirmed = window.confirm(
      "Reset your LivePulse personalization profile and reading signals?"
    )
    if (!confirmed) return

    setResetting(true)
    setError(null)
    setNotice(null)

    try {
      const response = await fetch("/api/user/personalization", {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("reset failed")
      clearLivePulseTelemetryIdentity()
      setState((current) =>
        current
          ? {
              ...current,
              events: 0,
              articleContexts: 0,
              interestProfileExists: false,
            }
          : current
      )
      setNotice("Personalization profile reset.")
    } catch {
      setError("Unable to reset personalization.")
    } finally {
      setResetting(false)
    }
  }

  const enabled = state?.personalizationEnabled ?? true

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <div style={breadcrumbStyle}>
          <Link href="/">Feed</Link>
          <span>/</span>
          <span>Settings</span>
        </div>

        <p style={eyebrowStyle}>Reader settings</p>
        <h1 style={titleStyle}>Personalization</h1>
        <p style={copyStyle}>
          Control whether LivePulse uses your reading signals to tune the feed.
        </p>

        <div style={statusPanelStyle}>
          <div>
            <div style={labelStyle}>Context engine</div>
            <div style={statusTitleStyle}>
              {loading ? "Loading..." : enabled ? "Personalization on" : "Personalization off"}
            </div>
            <p style={statusCopyStyle}>
              When on, impressions, reads, dwell time, saves, and feedback can
              shape your signed-in feed. When off, new signed-in events are not
              added to your profile.
            </p>
          </div>

          <button
            type="button"
            disabled={loading || saving}
            onClick={() => setPersonalizationEnabled(!enabled)}
            style={{
              ...toggleButtonStyle,
              background: enabled ? "var(--accent)" : "transparent",
              color: enabled ? "#000" : "var(--muted)",
              borderColor: enabled ? "var(--accent)" : "var(--border2)",
              cursor: loading || saving ? "wait" : "pointer",
            }}
          >
            {saving ? "Saving..." : enabled ? "Turn off" : "Turn on"}
          </button>
        </div>

        <div style={metricsGridStyle}>
          <Metric label="Stored events" value={state?.events ?? 0} />
          <Metric label="Article signals" value={state?.articleContexts ?? 0} />
          <Metric
            label="Interest profile"
            value={state?.interestProfileExists ? "Ready" : "Empty"}
          />
        </div>

        <div style={dangerPanelStyle}>
          <div>
            <div style={labelStyle}>Reset profile</div>
            <p style={statusCopyStyle}>
              Delete signed-in context events, article signal summaries, and
              learned topic/source weights. Bookmarks and followed topics stay.
            </p>
          </div>
          <button
            type="button"
            disabled={loading || resetting}
            onClick={resetPersonalization}
            style={{
              ...resetButtonStyle,
              cursor: loading || resetting ? "wait" : "pointer",
            }}
          >
            {resetting ? "Resetting..." : "Reset"}
          </button>
        </div>

        {notice && <div style={noticeStyle}>{notice}</div>}
        {error && <div style={errorStyle}>{error}</div>}
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={metricStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
    </div>
  )
}

const pageStyle = {
  minHeight: "100vh",
  background: "var(--bg)",
  padding: "64px 24px",
} as const

const panelStyle = {
  width: "100%",
  maxWidth: 760,
  margin: "0 auto",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 30,
} as const

const breadcrumbStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--muted)",
  marginBottom: 24,
  textTransform: "uppercase",
  letterSpacing: "1px",
} as const

const eyebrowStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1.5px",
  color: "var(--accent)",
  textTransform: "uppercase",
  margin: "0 0 8px",
} as const

const titleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: 38,
  margin: "0 0 10px",
  color: "var(--text)",
} as const

const copyStyle = {
  fontSize: 14,
  color: "var(--muted)",
  margin: "0 0 24px",
  lineHeight: 1.6,
} as const

const statusPanelStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 18,
  alignItems: "center",
  padding: 18,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
} as const

const labelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1px",
  color: "var(--muted)",
  textTransform: "uppercase",
  marginBottom: 8,
} as const

const statusTitleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: 24,
  color: "var(--text)",
  marginBottom: 8,
} as const

const statusCopyStyle = {
  margin: 0,
  fontSize: 13,
  color: "var(--text-dim)",
  lineHeight: 1.65,
} as const

const toggleButtonStyle = {
  border: "1px solid",
  borderRadius: 4,
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "1px",
  padding: "11px 14px",
  textTransform: "uppercase",
  minWidth: 112,
} as const

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
  marginTop: 14,
} as const

const metricStyle = {
  padding: 16,
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
} as const

const metricValueStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 22,
  color: "var(--text)",
} as const

const dangerPanelStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 18,
  alignItems: "center",
  padding: 18,
  marginTop: 14,
  background: "rgba(255,77,77,0.06)",
  border: "1px solid rgba(255,77,77,0.24)",
  borderRadius: 6,
} as const

const resetButtonStyle = {
  background: "transparent",
  border: "1px solid rgba(255,77,77,0.5)",
  borderRadius: 4,
  color: "var(--negative)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "1px",
  padding: "11px 14px",
  textTransform: "uppercase",
  minWidth: 112,
} as const

const noticeStyle = {
  color: "var(--accent)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  marginTop: 14,
} as const

const errorStyle = {
  color: "var(--negative)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  marginTop: 14,
} as const
