import type { Metadata } from "next"
import "./globals.css"
import ChatAssistant from "@/components/ChatAssistant"

export const metadata: Metadata = {
  title: "LivePulse — World News",
  description: "Live news aggregator with local Ollama AI",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Mono:wght@400;500&family=Playfair+Display:wght@700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <ChatAssistant />
      </body>
    </html>
  )
}
