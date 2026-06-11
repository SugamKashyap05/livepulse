"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ALL_TOPICS } from "@/lib/sources"

const REGION_OPTIONS = [
  { label: "India", value: "india" },
  { label: "United Kingdom", value: "uk" },
  { label: "United States", value: "us" },
  { label: "Global (no preference)", value: "global" },
]

const TOPICS = ALL_TOPICS.filter((topic) => topic.slug !== "all")

export default function OnboardingPage() {
  const router = useRouter()
  const [region, setRegion] = useState("global")
  const [topics, setTopics] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleTopic(slug: string) {
    setTopics((current) =>
      current.includes(slug)
        ? current.filter((topic) => topic !== slug)
        : [...current, slug]
    )
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, topics }),
      })

      if (!response.ok) {
        setError("Unable to save preferences right now.")
        return
      }

      router.push("/")
    } catch {
      setError("Unable to save preferences right now.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={pageStyle}>
      <form onSubmit={handleSubmit} style={panelStyle}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ ...labelStyle, color: "var(--accent)", marginBottom: 8 }}>
            STEP 1 OF 1
          </div>
          <h1 style={titleStyle}>Personalise Your Feed</h1>
          <p style={copyStyle}>
            Choose your region and topics. You can change these anytime in your profile.
          </p>
        </div>

        <div style={{ marginBottom: 28 }}>
          <div style={{ ...labelStyle, marginBottom: 12 }}>
            YOUR REGION
          </div>
          <div className="onboarding-choice-grid" style={choiceGridStyle}>
            {REGION_OPTIONS.map((option) => {
              const selected = region === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRegion(option.value)}
                  style={{
                    ...choiceButtonStyle,
                    background: selected ? "var(--accent-dim)" : "var(--surface2)",
                    border: `1px solid ${selected ? "var(--border-accent)" : "var(--border)"}`,
                    color: selected ? "var(--accent)" : "var(--text-dim)",
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ ...labelStyle, marginBottom: 12 }}>TOPICS</div>
          <div className="onboarding-choice-grid" style={topicGridStyle}>
            {TOPICS.map((topic) => {
              const selected = topics.includes(topic.slug)
              return (
                <button
                  key={topic.slug}
                  type="button"
                  onClick={() => toggleTopic(topic.slug)}
                  style={{
                    ...choiceButtonStyle,
                    background: selected ? "var(--accent-dim)" : "var(--surface2)",
                    border: `1px solid ${selected ? "var(--border-accent)" : "var(--border)"}`,
                    color: selected ? "var(--accent)" : "var(--text-dim)",
                  }}
                >
                  {topic.label}
                </button>
              )
            })}
          </div>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <button type="submit" disabled={saving} style={{
          ...buttonStyle,
          opacity: saving ? 0.7 : 1,
          cursor: saving ? "wait" : "pointer",
        }}>
          {saving ? "Saving..." : "Set Up My Feed →"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/")}
          style={skipButtonStyle}
        >
          Skip for now
        </button>
      </form>
    </main>
  )
}

const pageStyle = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: `
    var(--bg)
    radial-gradient(ellipse 80% 50% at 50% 0%,
      rgba(108,143,255,0.05) 0%,
      transparent 60%)
  `,
  padding: "clamp(16px, 3vw, 32px) 16px",
} as const

const panelStyle = {
  width: "100%",
  maxWidth: 560,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "clamp(16px, 4vw, 32px)",
  boxShadow: "var(--shadow-lg)",
} as const

const titleStyle = {
  fontFamily: "var(--font-display)",
  fontSize: 32,
  fontWeight: 700,
  color: "var(--text)",
  margin: 0,
} as const

const copyStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: "var(--muted)",
  lineHeight: 1.6,
  marginTop: 8,
} as const

const labelStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  letterSpacing: "1.5px",
  color: "var(--muted)",
  textTransform: "uppercase",
} as const

const choiceGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 8,
} as const

const topicGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 8,
} as const

const choiceButtonStyle = {
  padding: "12px 16px",
  borderRadius: 5,
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  textAlign: "left",
  transition: "all 0.15s",
} as const

const buttonStyle = {
  width: "100%",
  marginTop: 22,
  background: "var(--accent)",
  border: "none",
  borderRadius: 4,
  color: "#000",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  letterSpacing: "1px",
  padding: "12px 14px",
  textTransform: "uppercase",
} as const

const skipButtonStyle = {
  width: "100%",
  marginTop: 10,
  background: "transparent",
  border: "none",
  color: "var(--muted)",
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  padding: "8px 14px",
  textTransform: "uppercase",
} as const

const errorStyle = {
  color: "var(--red)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  marginTop: 14,
} as const
