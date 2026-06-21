"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ALL_TOPICS } from "@/lib/sources"

const REGION_OPTIONS = [
  { label: "India", value: "india" },
  { label: "United Kingdom", value: "uk" },
  { label: "United States", value: "us" },
  { label: "Global (no preference)", value: "global" },
]

const TOPICS = ALL_TOPICS.filter((topic) => topic.slug !== "all")

type PreferencesResponse = {
  region: string | null
  topics: string[]
  personalizationEnabled: boolean
  user?: {
    name: string | null
    email: string | null
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const [name, setName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [region, setRegion] = useState("global")
  const [topics, setTopics] = useState<string[]>([])
  const [personalizationEnabled, setPersonalizationEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPreferences() {
      try {
        const response = await fetch("/api/user/preferences")
        if (response.status === 401) {
          router.push("/login?next=/profile")
          return
        }
        if (!response.ok) {
          setError("Unable to load preferences.")
          return
        }

        const data = (await response.json()) as PreferencesResponse
        if (!cancelled) {
          setName(data.user?.name ?? null)
          setEmail(data.user?.email ?? null)
          setRegion(data.region ?? "global")
          setTopics(data.topics ?? [])
          setPersonalizationEnabled(data.personalizationEnabled ?? true)
        }
      } catch {
        if (!cancelled) setError("Unable to load preferences.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPreferences()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleTopic(slug: string) {
    setTopics((current) =>
      current.includes(slug)
        ? current.filter((topic) => topic !== slug)
        : [...current, slug]
    )
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const response = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, topics }),
      })

      if (response.status === 401) {
        router.push("/login?next=/profile")
        return
      }

      if (!response.ok) {
        setError("Unable to save preferences.")
        return
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError("Unable to save preferences.")
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => {})
    router.push("/")
  }

  async function handleTogglePersonalization() {
    setSaving(true)
    try {
      const res = await fetch("/api/user/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_personalization" }),
      })
      if (res.ok) {
        const data = await res.json()
        setPersonalizationEnabled(data.personalizationEnabled)
      } else {
        setError("Could not update privacy setting.")
      }
    } catch {
      setError("Could not update privacy setting.")
    } finally {
      setSaving(false)
    }
  }

  async function handleResetData() {
    if (!window.confirm("Are you sure? This will reset your personalized news feed recommendations. This cannot be undone.")) return
    
    setSaving(true)
    try {
      const res = await fetch("/api/user/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_profile" }),
      })
      if (res.ok) {
        alert("Your personalization data has been reset.")
      } else {
        setError("Could not reset data.")
      }
    } catch {
      setError("Could not reset data.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={pageStyle}>
      <form onSubmit={handleSave} style={panelStyle}>
        <p style={eyebrowStyle}>Profile</p>
        <h1 style={titleStyle}>{name || email || "Your account"}</h1>
        <p style={copyStyle}>{email || "Manage your LivePulse preferences."}</p>

        <label style={labelStyle} htmlFor="region">
          Region
        </label>
        <select
          id="region"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          disabled={loading}
          style={inputStyle}
        >
          {REGION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div style={{ marginTop: 18 }}>
          <div style={labelStyle}>Followed topics</div>
          <div style={topicGridStyle}>
            {TOPICS.map((topic) => {
              const selected = topics.includes(topic.slug)
              return (
                <button
                  key={topic.slug}
                  type="button"
                  disabled={loading}
                  onClick={() => toggleTopic(topic.slug)}
                  style={{
                    ...topicButtonStyle,
                    borderColor: selected ? "var(--accent)" : "var(--border2)",
                    color: selected ? "var(--accent)" : "var(--muted)",
                    background: selected ? "rgba(219,255,0,0.08)" : "transparent",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {topic.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 24 }}>
          <div style={eyebrowStyle}>Privacy & Data</div>
          
          <div style={{ marginTop: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", marginBottom: 4 }}>
                Personalized Feed
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                Allow LivePulse to use your reading history and feedback to recommend articles you might like.
              </div>
            </div>
            <button
              type="button"
              disabled={loading || saving}
              onClick={handleTogglePersonalization}
              style={{
                ...buttonStyle,
                background: personalizationEnabled ? "var(--accent)" : "transparent",
                color: personalizationEnabled ? "var(--bg)" : "var(--muted)",
                borderColor: personalizationEnabled ? "var(--accent)" : "var(--border)",
                minWidth: 80,
              }}
            >
              {personalizationEnabled ? "Enabled" : "Disabled"}
            </button>
          </div>

          <div style={{ marginTop: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", marginBottom: 4 }}>
                Reset Personalization Data
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>
                Clear your aggregated interest profile. This will reset your feed recommendations to default.
              </div>
            </div>
            <button
              type="button"
              disabled={loading || saving}
              onClick={handleResetData}
              style={{
                ...buttonStyle,
                background: "transparent",
                color: "var(--negative)",
                borderColor: "var(--negative)",
                opacity: 0.8,
              }}
            >
              Reset Data
            </button>
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}
        {saved && <div style={savedStyle}>Saved</div>}

        <button type="submit" disabled={loading || saving} style={{
          ...buttonStyle,
          opacity: loading || saving ? 0.7 : 1,
          cursor: loading || saving ? "wait" : "pointer",
        }}>
          {saving ? "Saving..." : "Save"}
        </button>

        <button type="button" onClick={handleSignOut} style={signOutStyle}>
          Sign out
        </button>
      </form>
    </main>
  )
}

const pageStyle = {
  minHeight: "100vh",
  background: "var(--bg)",
  padding: "64px 24px",
} as const

const panelStyle = {
  width: "100%",
  maxWidth: 620,
  margin: "0 auto",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 30,
} as const

const eyebrowStyle = {
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 10,
  letterSpacing: "1.5px",
  color: "var(--accent)",
  textTransform: "uppercase",
  margin: "0 0 8px",
} as const

const titleStyle = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 36,
  margin: "0 0 10px",
  color: "var(--text)",
} as const

const copyStyle = {
  fontSize: 14,
  color: "var(--muted)",
  margin: "0 0 24px",
} as const

const labelStyle = {
  display: "block",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  letterSpacing: "1px",
  color: "var(--muted)",
  textTransform: "uppercase",
  marginBottom: 8,
} as const

const inputStyle = {
  width: "100%",
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderRadius: 4,
  color: "var(--text)",
  padding: "12px 14px",
  outline: "none",
} as const

const topicGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
} as const

const topicButtonStyle = {
  border: "1px solid var(--border2)",
  borderRadius: 4,
  padding: "10px 12px",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  letterSpacing: "1px",
  textTransform: "uppercase",
  cursor: "pointer",
} as const

const buttonStyle = {
  width: "100%",
  marginTop: 22,
  background: "var(--accent)",
  border: "none",
  borderRadius: 4,
  color: "#000",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 12,
  letterSpacing: "1px",
  padding: "12px 14px",
  textTransform: "uppercase",
} as const

const signOutStyle = {
  width: "100%",
  marginTop: 10,
  background: "transparent",
  border: "1px solid var(--border2)",
  borderRadius: 4,
  color: "var(--muted)",
  cursor: "pointer",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  padding: "10px 14px",
  textTransform: "uppercase",
} as const

const errorStyle = {
  color: "var(--red)",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  marginTop: 14,
} as const

const savedStyle = {
  color: "var(--accent)",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: 11,
  marginTop: 14,
} as const
