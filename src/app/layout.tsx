/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata, Viewport } from "next"
import "./globals.css"
import ChatAssistant from "@/components/ChatAssistant"
import { AuthGateProvider } from "@/context/AuthGateContext"
import { AuthGateModal } from "@/components/AuthGateModal"
import { getCurrentUserId } from "@/lib/auth"
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata: Metadata = {
  title: "LivePulse - World News",
  description: "Live news aggregator powered by AI",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const userId = await getCurrentUserId()
  const hasSession = !!userId

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=IBM+Plex+Serif:ital,wght@0,300;0,400;1,300;1,400&family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,700;0,900;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}>
        <AuthGateProvider hasSession={hasSession}>
          {children}
          <footer style={{
          borderTop: "1px solid var(--border)",
          padding: "24px 32px",
          marginTop: "auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}>
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            fontWeight: 700,
            fontStyle: "italic",
            color: "var(--muted)",
          }}>
            LivePulse
          </span>
          <div style={{ display: "flex", gap: 20 }}>
            {[
              { href: "/digest", label: "Daily Digest" },
              { href: "/ai-news", label: "AI Reports" },
              { href: "/admin", label: "Admin" },
            ].map(({ href, label }) => (
              <a key={href} href={href} style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: "var(--muted2)",
              }}>
                {label}
              </a>
            ))}
          </div>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--muted2)",
            letterSpacing: "0.5px",
          }}>
            &copy; {new Date().getFullYear()} LivePulse
          </span>
        </footer>
        <ChatAssistant />
        <AuthGateModal />
        <SpeedInsights />
        </AuthGateProvider>
      </body>
    </html>
  )
}
