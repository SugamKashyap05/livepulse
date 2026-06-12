import { Suspense } from "react"
import OnboardingClient from "@/components/OnboardingClient"

export default function OnboardingPage() {
  return (
    <main style={pageStyle}>
      <Suspense fallback={<div style={fallbackStyle}>Loading setup...</div>}>
        <OnboardingClient />
      </Suspense>
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

const fallbackStyle = {
  width: "100%",
  maxWidth: 560,
  padding: 32,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  textAlign: "center",
} as const
