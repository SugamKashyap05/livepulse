"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search as SearchIcon } from "lucide-react"

export default function SearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = query.trim()
    if (trimmed.length > 0) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: open ? 220 : 180,
        maxWidth: "100%",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={open ? "Close search" : "Search"}
        style={{
          display: "none",
          width: 28,
          height: 28,
          border: "1px solid var(--border)",
          borderRadius: 4,
          background: "var(--surface)",
          color: "var(--muted)",
          cursor: "pointer",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 12,
        }}
        className="search-toggle"
      >
        ?
      </button>
      <div
        className={open ? "search-shell open" : "search-shell"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          width: "100%",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          borderRadius: 4,
          padding: "0 6px",
        }}
      >
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          aria-label="Search articles"
          style={{
            width: "100%",
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text)",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12,
            padding: "7px 4px",
          }}
        />
        <button
          type="submit"
          aria-label="Search"
          style={{
            border: "none",
            background: "transparent",
            color: "var(--muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: "2px 4px",
          }}
        >
          <SearchIcon size={14} />
        </button>
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => setQuery("")}
            title="Clear search"
            style={{
              border: "none",
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12,
              padding: "2px 4px",
            }}
          >
            x
          </button>
        )}
      </div>

      <style>{`
        @media (max-width: 720px) {
          form {
            width: auto !important;
          }
          .search-toggle {
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
          }
          .search-shell {
            display: none !important;
          }
          .search-shell.open {
            display: flex !important;
            width: min(58vw, 220px) !important;
          }
        }
      `}</style>
    </form>
  )
}
