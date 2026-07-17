"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"

const mobileLinkStyle = {
  display: "block",
  minHeight: 44,
  padding: "13px 16px",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "var(--text)",
  borderBottom: "1px solid var(--border)",
} as const

export default function MobileHeaderMenu({
  authSlot,
}: {
  authSlot: ReactNode
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isMenuOpen) return

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsMenuOpen(false)
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside, { passive: true })
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isMenuOpen])

  return (
    <div ref={wrapperRef} className="mobile-only" style={{ position: "relative" }}>
      <button
        type="button"
        aria-expanded={isMenuOpen}
        aria-controls="mobile-menu"
        onClick={() => setIsMenuOpen((value) => !value)}
        style={{
          width: 44,
          height: 44,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--surface)",
          color: "var(--text)",
          fontFamily: "var(--font-mono)",
          fontSize: 18,
        }}
      >
        {isMenuOpen ? "✕" : "☰"}
      </button>

      {isMenuOpen && (
        <div
          id="mobile-menu"
          role="navigation"
          className="mobile-menu-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "min(320px, calc(100vw - 32px))",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
            zIndex: 120,
          }}
        >
          {[
            { href: "/", label: "Feed" },
            { href: "/digest", label: "Digest" },
            { href: "/ai-news", label: "AI Reports" },
            { href: "/bookmarks", label: "Saved" },
            { href: "/search", label: "Search" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={mobileLinkStyle}
            >
              {item.label}
            </Link>
          ))}
          <div style={{
            padding: 16,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}>
            {authSlot}
          </div>
        </div>
      )}
    </div>
  )
}
