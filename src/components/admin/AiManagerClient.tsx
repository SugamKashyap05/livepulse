"use client"

import { useState } from "react"

type Log = {
  id: string
  action: string
  model: string
  ms: number | null
  tokens: number | null
  success: boolean
  error: string | null
  createdAt: string
}

type Digest = {
  id: string
  date: string
  content: string
  model: string | null
  createdAt: string
}

type Models = Record<string, string>

export default function AiManagerClient({
  logs,
  digests,
  models,
}: {
  logs: Log[]
  digests: Digest[]
  models: Models
}) {
  const [tab, setTab] = useState<"chat" | "logs" | "digests">("chat")
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  async function sendToManager() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: "user", content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/ai/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || data.error || "No response" },
      ])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${String(e)}` },
      ])
    } finally {
      setLoading(false)
    }
  }

  const TABS = [
    { key: "chat", label: "AI Chat" },
    { key: "logs", label: `AI Logs (${logs.length})` },
    { key: "digests", label: `Digests (${digests.length})` },
  ]

  const suggestions = [
    "What topics are trending today?",
    "Which sources have the most articles?",
    "Suggest 3 new RSS feeds to add",
    "What's the sentiment breakdown?",
    "How is the site performing?",
    "What news is most important today?",
  ]

  return (
    <div>
      {/* Models in use */}
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: "16px 20px",
        marginBottom: 20,
        display: "flex",
        gap: 24,
        flexWrap: "wrap",
      }}>
        <span style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 9,
          letterSpacing: "1.5px",
          textTransform: "uppercase",
          color: "var(--muted)",
          alignSelf: "center",
        }}>
          Active Models:
        </span>
        {Object.entries(models).map(([task, model]) => (
          <div key={task} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              color: "var(--muted)",
              textTransform: "uppercase",
            }}>
              {task}:
            </span>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              color: "var(--accent)",
              background: "rgba(74,240,196,0.08)",
              padding: "2px 8px",
              borderRadius: 2,
              border: "1px solid rgba(74,240,196,0.15)",
            }}>
              {model}
            </span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--border)",
        marginBottom: 20,
      }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              letterSpacing: "1px",
              textTransform: "uppercase",
              padding: "10px 20px",
              background: "transparent",
              color: tab === t.key ? "var(--accent)" : "var(--muted)",
              border: "none",
              borderBottom: `2px solid ${tab === t.key ? "var(--accent)" : "transparent"}`,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* AI Chat tab */}
      {tab === "chat" && (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          overflow: "hidden",
        }}>
          <div style={{
            height: 380,
            overflowY: "auto",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}>
            {messages.length === 0 && (
              <div>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  color: "var(--muted)",
                  marginBottom: 16,
                }}>
                  Ask the AI manager anything about your site:
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      style={{
                        padding: "8px 12px",
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        borderRadius: 4,
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 10,
                        color: "var(--muted)",
                        cursor: "pointer",
                        textAlign: "left",
                        lineHeight: 1.4,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div style={{
                  maxWidth: "80%",
                  padding: "10px 14px",
                  borderRadius: 6,
                  background: m.role === "user"
                    ? "var(--accent)"
                    : "var(--surface2)",
                  border: m.role === "user"
                    ? "none"
                    : "1px solid var(--border)",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: m.role === "user" ? "#000" : "var(--text)",
                  whiteSpace: "pre-wrap",
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{
                padding: "10px 14px",
                borderRadius: 6,
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                color: "var(--accent)",
                width: "fit-content",
              }}>
                thinking...
              </div>
            )}
          </div>

          <div style={{
            padding: 16,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 8,
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendToManager()}
              placeholder="Ask the AI manager..."
              style={{
                flex: 1,
                background: "var(--surface2)",
                border: "1px solid var(--border2)",
                borderRadius: 4,
                padding: "10px 14px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                color: "var(--text)",
                outline: "none",
              }}
            />
            <button
              onClick={sendToManager}
              disabled={loading || !input.trim()}
              style={{
                padding: "10px 20px",
                background: loading || !input.trim()
                  ? "transparent"
                  : "var(--accent)",
                color: loading || !input.trim() ? "var(--muted)" : "#000",
                border: `1px solid ${loading || !input.trim() ? "var(--border)" : "var(--accent)"}`,
                borderRadius: 4,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "..." : "Ask"}
            </button>
          </div>
        </div>
      )}

      {/* Logs tab */}
      {tab === "logs" && (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          overflow: "hidden",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "120px 120px 80px 80px 1fr",
            padding: "10px 16px",
            borderBottom: "1px solid var(--border)",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}>
            <span>Action</span>
            <span>Model</span>
            <span>Time</span>
            <span>Tokens</span>
            <span>Status</span>
          </div>
          {logs.map((l) => (
            <div
              key={l.id}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 120px 80px 80px 1fr",
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                alignItems: "center",
              }}
            >
              <span style={{ color: "var(--accent)" }}>{l.action}</span>
              <span style={{ color: "var(--muted)" }}>{l.model}</span>
              <span style={{ color: "var(--muted)" }}>{l.ms}ms</span>
              <span style={{ color: "var(--muted)" }}>{l.tokens || "—"}</span>
              <span style={{ color: l.success ? "#4af0c4" : "#ff4d4d" }}>
                {l.success ? "✓" : `✗ ${l.error}`}
              </span>
            </div>
          ))}
          {logs.length === 0 && (
            <div style={{
              padding: 32,
              textAlign: "center",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: "var(--muted)",
            }}>
              No AI actions logged yet
            </div>
          )}
        </div>
      )}

      {/* Digests tab */}
      {tab === "digests" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {digests.map((d) => (
            <div
              key={d.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: 20,
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
              }}>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12,
                  color: "var(--accent)",
                }}>
                  {d.date}
                </span>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  color: "var(--muted)",
                }}>
                  {d.model} · {new Date(d.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <p style={{
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: 13,
                lineHeight: 1.7,
                color: "var(--muted)",
                margin: 0,
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {d.content}
              </p>
            </div>
          ))}
          {digests.length === 0 && (
            <div style={{
              padding: 32,
              textAlign: "center",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 11,
              color: "var(--muted)",
            }}>
              No digests generated yet. Visit /digest to create one.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
