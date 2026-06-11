"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ALL_TOPICS } from "@/lib/sources"

type TopicTabsProps = {
  activeSlug?: string
}

export default function TopicTabs({ activeSlug }: TopicTabsProps) {
  const pathname = usePathname()
  const derivedActive =
    pathname === "/"
      ? "all"
      : pathname.startsWith("/topic/")
        ? pathname.split("/").filter(Boolean).at(-1) || "all"
        : "all"
  const current = activeSlug || derivedActive

  return (
    <nav
      className="scroll-row topic-tabs"
      aria-label="Topics"
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        flexWrap: "nowrap",
        marginBottom: 28,
        paddingBottom: 2,
        scrollbarWidth: "thin",
      }}
    >
      {ALL_TOPICS.map((topic) => {
        const active = current === topic.slug
        return (
          <Link
            key={topic.slug}
            href={topic.slug === "all" ? "/" : `/topic/${topic.slug}`}
            style={{
              flex: "0 0 auto",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: "1px",
              textTransform: "uppercase",
              padding: "7px 12px",
              background: active
                ? "rgba(108,143,255,0.1)"
                : "transparent",
              border: `1px solid ${active
                ? "rgba(108,143,255,0.3)"
                : "var(--border)"}`,
              borderRadius: 20,
              color: active ? "var(--accent)" : "var(--muted)",
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            {topic.label}
          </Link>
        )
      })}
    </nav>
  )
}
