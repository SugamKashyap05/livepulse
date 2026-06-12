"use client"

import { useState, useRef, useEffect } from "react"

type Message = {
  role: "user" | "assistant"
  content: string
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: "user", content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || data.error || "No response",
        },
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

  return (
    <>
      {/* FAB button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: open ? "var(--surface)" : "var(--accent)",
          border: open ? "1px solid var(--border2)" : "none",
          color: open ? "var(--text)" : "#000",
          fontSize: 20,
          cursor: "pointer",
          zIndex: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          transition: "all 0.2s",
        }}
      >
        {open ? "x" : "+"}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{
          position: "fixed",
          bottom: 92,
          right: 28,
          width: 360,
          height: 500,
          background: "var(--surface)",
          border: "1px solid var(--border2)",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          zIndex: 199,
          overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--accent)",
            }} />
            <div>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text)",
              }}>
                News Assistant
              </div>
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 9,
                color: "var(--muted)",
              }}>
                Ask about today&apos;s news
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}>
            {messages.length === 0 && (
              <div style={{
                textAlign: "center",
                padding: "30px 0",
              }}>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  color: "var(--muted)",
                  marginBottom: 16,
                }}>
                  Ask anything about today&apos;s news
                </div>
                {[
                  "What happened in tech today?",
                  "Summarize sports news",
                  "Top India stories?",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s)
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      marginBottom: 6,
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 11,
                      color: "var(--muted)",
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
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
                  maxWidth: "82%",
                  padding: "10px 14px",
                  borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  background: m.role === "user"
                    ? "var(--accent)"
                    : "var(--surface2)",
                  border: m.role === "user"
                    ? "none"
                    : "1px solid var(--border)",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: m.role === "user" ? "#000" : "var(--text)",
                  whiteSpace: "pre-wrap",
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{
                  padding: "10px 14px",
                  borderRadius: "12px 12px 12px 2px",
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12,
                  color: "var(--accent)",
                }}>
                  thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "12px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 8,
            flexShrink: 0,
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask about the news..."
              style={{
                flex: 1,
                background: "var(--surface2)",
                border: "1px solid var(--border2)",
                borderRadius: 4,
                padding: "8px 12px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                color: "var(--text)",
                outline: "none",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                padding: "8px 14px",
                background: loading || !input.trim()
                  ? "var(--surface2)"
                  : "var(--accent)",
                color: loading || !input.trim() ? "var(--muted)" : "#000",
                border: "none",
                borderRadius: 4,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                transition: "all 0.2s",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  )
}
