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
              padding: "8px 2px 7px",
              borderBottom: `1px solid ${active ? "var(--accent)" : "transparent"}`,
              color: active ? "var(--accent)" : "var(--muted)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            {topic.label}
          </Link>
        )
      })}
    </nav>
  )
}
