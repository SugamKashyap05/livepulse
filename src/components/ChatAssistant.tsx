"use client"

import { usePathname } from "next/navigation"
import type { CSSProperties, FormEvent, ReactNode } from "react"
import { useEffect, useRef, useState } from "react"
import { useAuthGate, useSession } from "@/context/AuthGateContext"

interface Message {
  role: "user" | "assistant"
  content: string
}

type StreamEvent = {
  type?: string
  content?: string
}

function canUseHover() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  )
}

function formatAIResponse(content: string): ReactNode {
  const lines = content.split("\n")
  const elements: ReactNode[] = []
  let bulletBuffer: string[] = []

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return
    elements.push(
      <ul key={`ul-${elements.length}`} style={formattedListStyle}>
        {bulletBuffer.map((item, index) => (
          <li key={index} style={formattedListItemStyle}>
            <span style={formattedBulletStyle}>◆</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    )
    bulletBuffer = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const bulletMatch =
      trimmed.match(/^[*\-•]\s+(.+)/) ||
      trimmed.match(/^\d+\.\s+(.+)/)

    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1])
      continue
    }

    flushBullets()

    if (trimmed.length > 0) {
      const isLabel = trimmed.endsWith(":")
      elements.push(
        <p
          key={`p-${elements.length}`}
          style={{
            ...formattedParagraphStyle,
            color: isLabel ? "var(--text-dim)" : "var(--text)",
            fontWeight: isLabel ? 500 : 400,
            letterSpacing: isLabel ? "0.3px" : 0,
          }}
        >
          {trimmed}
        </p>
      )
    }
  }

  flushBullets()
  return <>{elements}</>
}

void formatAIResponse

function formatReadableAIResponse(content: string): ReactNode {
  const elements: ReactNode[] = []
  let bullets: string[] = []

  const flushBullets = () => {
    if (bullets.length === 0) return
    elements.push(
      <ul key={`clean-ul-${elements.length}`} style={formattedListStyle}>
        {bullets.map((item, index) => (
          <li key={index} style={formattedListItemStyle}>
            <span style={formattedBulletStyle}>◆</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    )
    bullets = []
  }

  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    const bulletMatch =
      trimmed.match(/^[*\-•]\s+(.+)/) ||
      trimmed.match(/^\d+\.\s+(.+)/)

    if (bulletMatch) {
      bullets.push(bulletMatch[1])
      continue
    }

    flushBullets()

    if (trimmed.length > 0) {
      const isLabel = trimmed.endsWith(":")
      elements.push(
        <p
          key={`clean-p-${elements.length}`}
          style={{
            ...formattedParagraphStyle,
            color: isLabel ? "var(--text-dim)" : "var(--text)",
            fontWeight: isLabel ? 500 : 400,
            letterSpacing: isLabel ? "0.3px" : 0,
          }}
        >
          {trimmed}
        </p>
      )
    }
  }

  flushBullets()
  return <>{elements}</>
}

export default function ChatAssistant() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your LivePulse AI. Ask me anything about today's news.",
    },
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastTouchActivationAt = useRef(0)
  const currentTopic = pathname.startsWith("/topic/")
    ? pathname.split("/topic/")[1].split("/")[0]
    : "all"

  const { triggerAuthGate } = useAuthGate()
  const { hasSession } = useSession()

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingContent])

  async function handleSend(event: FormEvent) {
    event.preventDefault()
    if (!input.trim() || isTyping) return

    const userMsg = input
    const maxHistory = 20
    const trimmedHistory = messages.slice(-maxHistory)
    const nextMessages: Message[] = [
      ...trimmedHistory,
      { role: "user", content: userMsg },
    ]

    if (!hasSession) {
      triggerAuthGate('chat')
      return
    }

    setInput("")
    setMessages(nextMessages)
    setIsTyping(true)
    setIsThinking(true)
    setStreamingContent("")

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          topic: currentTopic,
        }),
      })

      if (response.status === 401) {
        setMessages(trimmedHistory)
        triggerAuthGate('chat')
        setIsTyping(false)
        setIsThinking(false)
        return
      }

      if (!response.ok || !response.body) {
        throw new Error("Chat failed")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split("\n\n")
        buffer = events.pop() ?? ""

        for (const rawEvent of events) {
          const line = rawEvent
            .split("\n")
            .find((eventLine) => eventLine.startsWith("data: "))
          if (!line) continue

          try {
            const event = JSON.parse(line.slice(6)) as StreamEvent

            if (event.type === "start") {
              setIsThinking(false)
            }

            if (event.type === "token" && typeof event.content === "string") {
              accumulated += event.content
              setStreamingContent(accumulated)
            }

            if (event.type === "done") {
              const finalContent =
                typeof event.content === "string" ? event.content : accumulated
              setStreamingContent("")
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: finalContent || "No response available.",
                },
              ])
            }

            if (event.type === "error") {
              setStreamingContent("")
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content:
                    event.content ||
                    "AI service is unavailable right now. Try again when Ollama is running.",
                },
              ])
            }
          } catch {
            // Ignore malformed SSE frames.
          }
        }
      }
    } catch (error) {
      console.error(error)
      setStreamingContent("")
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "AI service is unavailable right now. Try again when Ollama is running.",
        },
      ])
    } finally {
      setIsTyping(false)
      setIsThinking(false)
      setStreamingContent("")
    }
  }

  const sendDisabled = !input.trim() || isTyping

  function toggleChat() {
    setIsOpen((value) => !value)
  }

  function handleLauncherClick() {
    toggleChat()
  }

  return (
    <>
      <button
        className="chat-launcher"
        onClick={handleLauncherClick}
        style={floatingButtonStyle}
        onMouseEnter={(event) => {
          if (!canUseHover()) return
          event.currentTarget.style.transform = "scale(1.1)"
        }}
        onMouseLeave={(event) => {
          if (!canUseHover()) return
          event.currentTarget.style.transform = "scale(1)"
        }}
      >
        {isOpen ? "x" : "AI"}
      </button>

      {isOpen && (
        <div className="chat-panel-open" style={windowStyle}>
          <div style={headerStyle}>
            <div style={statusDotStyle} />
            <div style={{ flex: 1 }}>
              <div style={titleStyle}>LivePulse AI</div>
              <div style={subtitleStyle}>Online - Context-Aware</div>
            </div>
          </div>

          <div ref={scrollRef} className="chat-messages" style={messagesStyle}>
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                style={{
                  ...messageBubbleBaseStyle,
                  alignSelf: message.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: message.role === "user" ? "80%" : "86%",
                  padding: message.role === "user" ? "12px 16px" : "14px 18px",
                  borderRadius:
                    message.role === "user" ? "8px 0 8px 8px" : "0 8px 8px 8px",
                  background:
                    message.role === "user"
                      ? "rgba(108, 143, 255, 0.1)"
                      : "var(--surface2)",
                  border:
                    message.role === "user"
                      ? "1px solid rgba(108, 143, 255, 0.2)"
                      : "1px solid var(--border2)",
                  borderLeft:
                    message.role === "user"
                      ? "1px solid rgba(108, 143, 255, 0.2)"
                      : "3px solid var(--accent)",
                }}
              >
                {message.role === "assistant"
                  ? formatReadableAIResponse(message.content)
                  : message.content}
              </div>
            ))}
            {isThinking && (
              <div style={thinkingRowStyle}>
                <div style={thinkingBubbleStyle}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        ...thinkingDotStyle,
                        animationDelay: `${i * 0.2}s`,
                      }}
                    />
                  ))}
                  <span style={thinkingTextStyle}>AI is thinking...</span>
                </div>
              </div>
            )}

            {streamingContent && (
              <div style={streamingBubbleStyle}>
                {formatReadableAIResponse(streamingContent)}
                <span style={streamingCursorStyle} />
              </div>
            )}
          </div>

          <form onSubmit={handleSend} style={formOuterStyle}>
            <div
              style={inputShellStyle}
              onFocus={(event) => {
                event.currentTarget.style.border = "1px solid rgba(108,143,255,0.4)"
                event.currentTarget.style.background = "var(--surface)"
              }}
              onBlur={(event) => {
                event.currentTarget.style.border = "1px solid var(--border2)"
                event.currentTarget.style.background = "var(--surface2)"
              }}
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={isTyping}
                placeholder="Ask about today's news..."
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={sendDisabled}
                style={{
                  ...askButtonStyle,
                  opacity: sendDisabled ? 0.4 : 1,
                  cursor: sendDisabled ? "not-allowed" : "pointer",
                }}
                onMouseEnter={(event) => {
                  if (!canUseHover()) return
                  if (!event.currentTarget.disabled) {
                    event.currentTarget.style.opacity = "0.85"
                  }
                }}
                onMouseLeave={(event) => {
                  if (!canUseHover()) return
                  event.currentTarget.style.opacity = sendDisabled ? "0.4" : "1"
                }}
              >
                ASK
              </button>
            </div>
          </form>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  )
}

const floatingButtonStyle: CSSProperties = {
  position: "fixed",
  bottom: 24,
  right: 24,
  width: 56,
  height: 56,
  borderRadius: 28,
  background: "var(--accent)",
  color: "var(--bg)",
  border: "none",
  boxShadow: "0 8px 32px rgba(74,240,196,0.3)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "1px",
  zIndex: 1000,
  transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
}

const windowStyle: CSSProperties = {
  position: "fixed",
  bottom: 96,
  right: 24,
  width: 380,
  height: 500,
  background: "rgba(18,18,20,0.85)",
  backdropFilter: "blur(20px)",
  border: "1px solid var(--border)",
  borderRadius: 20,
  boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  zIndex: 1000,
  animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
}

const headerStyle: CSSProperties = {
  padding: "20px",
  borderBottom: "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  gap: 12,
}

const statusDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#4af0c4",
  boxShadow: "0 0 10px #4af0c4",
}

const titleStyle: CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontWeight: 900,
  fontSize: 16,
  letterSpacing: -0.5,
}

const subtitleStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: 1,
}

const messagesStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
}

const messageBubbleBaseStyle: CSSProperties = {
  color: "var(--text)",
  fontFamily: "var(--font-ai)",
  fontSize: 14,
  fontWeight: 500,
  lineHeight: 1.58,
  letterSpacing: "0.005em",
  boxShadow: "none",
}

const thinkingRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "flex-start",
}

const thinkingBubbleStyle: CSSProperties = {
  display: "flex",
  gap: 4,
  alignItems: "center",
  padding: "10px 14px",
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderLeft: "3px solid var(--accent)",
  borderRadius: "0 8px 8px 8px",
}

const thinkingDotStyle: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: "50%",
  background: "var(--accent)",
  display: "inline-block",
  animation: "thinking-dot 1.2s ease-in-out infinite",
}

const thinkingTextStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--muted)",
  marginLeft: 6,
  letterSpacing: "0.5px",
}

const streamingBubbleStyle: CSSProperties = {
  ...messageBubbleBaseStyle,
  alignSelf: "flex-start",
  maxWidth: "86%",
  padding: "14px 18px",
  borderRadius: "0 8px 8px 8px",
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderLeft: "3px solid var(--accent)",
  whiteSpace: "pre-wrap",
}

const streamingCursorStyle: CSSProperties = {
  display: "inline-block",
  width: 8,
  height: 14,
  background: "var(--accent)",
  marginLeft: 2,
  verticalAlign: "text-bottom",
  animation: "cursor-blink 0.8s step-end infinite",
}

const formOuterStyle: CSSProperties = {
  padding: "16px",
  borderTop: "1px solid var(--border)",
}

const inputShellStyle: CSSProperties = {
  display: "flex",
  border: "1px solid var(--border2)",
  borderRadius: 6,
  overflow: "hidden",
  background: "var(--surface2)",
  transition: "border-color 0.15s, background 0.15s",
}

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "transparent",
  border: "none",
  borderRadius: "6px 0 0 6px",
  padding: "12px 16px",
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  outline: "none",
}

const askButtonStyle: CSSProperties = {
  background: "var(--accent)",
  color: "#000",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "1.5px",
  padding: "12px 18px",
  border: "none",
  borderRadius: "0 6px 6px 0",
  transition: "opacity 0.15s",
  whiteSpace: "nowrap",
}

const formattedListStyle: CSSProperties = {
  margin: "8px 0",
  paddingLeft: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 6,
}

const formattedListItemStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  fontFamily: "var(--font-ai)",
  fontSize: 14,
  lineHeight: 1.6,
  color: "var(--text)",
}

const formattedBulletStyle: CSSProperties = {
  color: "var(--accent)",
  flexShrink: 0,
  marginTop: 3,
  fontSize: 8,
}

const formattedParagraphStyle: CSSProperties = {
  fontFamily: "var(--font-ai)",
  fontSize: 14,
  lineHeight: 1.7,
  margin: "4px 0",
}
