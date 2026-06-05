"use client"

import { usePathname } from "next/navigation"
import { useState, useRef, useEffect } from "react"

interface Message {
  role: "user" | "assistant"
  content: string
}

export default function ChatAssistant() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm your LivePulse AI. Ask me anything about today's news." }
  ])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentTopic = pathname.startsWith("/topic/")
    ? pathname.split("/topic/")[1].split("/")[0]
    : "all"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isTyping) return

    const userMsg = input
    const MAX_HISTORY = 20
    const trimmedHistory = messages.slice(-MAX_HISTORY)
    const nextMessages: Message[] = [
      ...trimmedHistory,
      { role: "user", content: userMsg },
    ]
    setInput("")
    setMessages(nextMessages)
    setIsTyping(true)

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: nextMessages,
          topic: currentTopic,
        }),
      })

      const data = await response.json()
      if (!response.ok || data.error) {
        throw new Error(data.error || "Chat failed")
      }

      setMessages(prev => [
        ...prev,
        { role: "assistant", content: data.reply || "No response available." },
      ])
    } catch (err) {
      console.error(err)
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "AI service is unavailable right now. Try again when Ollama is running." },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
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
          fontSize: 24,
          zIndex: 1000,
          transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
      >
        {isOpen ? "×" : "✧"}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div style={{
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
        }}>
          {/* Header */}
          <div style={{
            padding: "20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#4af0c4",
              boxShadow: "0 0 10px #4af0c4",
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontFamily: "'Playfair Display', serif", 
                fontWeight: 900, 
                fontSize: 16,
                letterSpacing: -0.5
              }}>
                LivePulse AI
              </div>
              <div style={{ 
                fontFamily: "'IBM Plex Mono', monospace", 
                fontSize: 9, 
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: 1
              }}>
                Online · Context-Aware
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div 
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                padding: "12px 16px",
                borderRadius: m.role === "user" ? "18px 18px 2px 18px" : "18px 18px 18px 2px",
                background: m.role === "user" ? "var(--accent)" : "rgba(255,255,255,0.05)",
                color: m.role === "user" ? "var(--bg)" : "var(--text)",
                fontSize: 14,
                lineHeight: 1.5,
                boxShadow: m.role === "user" ? "0 4px 12px rgba(74,240,196,0.2)" : "none",
              }}>
                {m.content}
              </div>
            ))}
            {isTyping && (
              <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                color: "var(--muted)",
                padding: "8px 0",
                opacity: 0.7,
              }}>
                ▋ thinking...
              </div>
            )}
          </div>

          {/* Input Area */}
          <form 
            onSubmit={handleSend}
            style={{
              padding: "16px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about today's news..."
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "10px 16px",
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={e => (e.target.style.borderColor = "var(--accent)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")}
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              style={{
                background: "var(--accent)",
                color: "var(--bg)",
                border: "none",
                borderRadius: 10,
                width: 40,
                height: 40,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: (!input.trim() || isTyping) ? 0.5 : 1,
              }}
            >
              ➝
            </button>
          </form>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  )
}
