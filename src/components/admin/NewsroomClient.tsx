"use client"

import { useState, useEffect, useRef } from "react"

type Activity = {
  id: string
  agent: string
  action: string
  status: string
  content: string | null
  createdAt: string
}

type DraftArticle = {
  id: string
  title: string
  description: string
  topic: string
  image: string | null
  createdAt: string
  published: boolean
}

export default function NewsroomClient({ initialActivity }: { initialActivity: Activity[] }) {
  const [activity, setActivity] = useState<Activity[]>(initialActivity)
  const [drafts, setDrafts] = useState<DraftArticle[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function poll() {
      try {
        const [actRes, drRes] = await Promise.all([
          fetch("/api/ai/newsroom/activity", { signal: controller.signal }),
          fetch("/api/admin/ai/drafts", { signal: controller.signal }),
        ])
        const [actData, drData] = await Promise.all([
          actRes.json(),
          drRes.json(),
        ])
        if (!cancelled) {
          setActivity(actData)
          setDrafts(drData)
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") console.error(e)
      }
    }

    poll()
    const interval = setInterval(poll, 15000)

    return () => {
      cancelled = true
      clearInterval(interval)
      controller.abort()
    }
  }, [])

  async function fetchDrafts() {
    try {
      const res = await fetch("/api/admin/ai/drafts")
      const data = await res.json()
      setDrafts(data)
    } catch (e) { console.error(e) }
  }

  async function triggerAgents() {
    setIsProcessing(true)
    try {
      await fetch("/api/ai/newsroom/process", { method: "POST" })
    } catch (e) {
      console.error(e)
    } finally {
      setIsProcessing(false)
    }
  }

  async function publishArticle(id: string) {
    try {
      const res = await fetch("/api/admin/ai/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error("[publish failed]", err)
        return
      }
      setPreviewId(null)
      fetchDrafts()
    } catch (e) { console.error(e) }
  }

  async function unpublishArticle(id: string) {
    try {
      const res = await fetch("/api/admin/ai/unpublish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) return
      setPreviewId(null)
      fetchDrafts()
    } catch (e) {
      console.error(e)
    }
  }

  const selectedDraft = drafts.find(d => d.id === previewId)

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: 32, height: "calc(100vh - 150px)" }}>
      {/* Main Terminal & Preview Area */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        
        {/* Terminal Window */}
        <div style={{
          flex: 2,
          background: "#0a0a0d",
          border: "1px solid #1a1a20",
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
        }}>
          <div style={{
            padding: "12px 16px",
            background: "#121217",
            borderBottom: "1px solid #1a1a20",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff5f56" }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ffbd2e" }} />
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#27c93f" }} />
              <span style={{
                marginLeft: 12,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                color: "#666",
                letterSpacing: "1px",
              }}>CONSOLE V2.0</span>
            </div>
            <button
              onClick={triggerAgents}
              disabled={isProcessing}
              style={{
                padding: "6px 16px",
                background: isProcessing ? "transparent" : "var(--accent)",
                border: `1px solid ${isProcessing ? "#333" : "var(--accent)"}`,
                color: isProcessing ? "#666" : "#000",
                borderRadius: 4,
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                fontWeight: 700,
                cursor: isProcessing ? "not-allowed" : "pointer",
              }}
            >
              {isProcessing ? "PROCESSING CYCLES..." : "DEPLOY AGENTS"}
            </button>
          </div>

          <div
            ref={scrollRef}
            style={{
              flex: 1,
              padding: 24,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            {activity.map((a) => (
              <div key={a.id} style={{
                borderLeft: `2px solid ${a.status === "thinking" ? "var(--accent)" : "#333"}`,
                paddingLeft: 16,
                opacity: a.status === "thinking" ? 1 : 0.7,
              }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 4, fontSize: 11 }}>
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>[{a.agent.toUpperCase()}]</span>
                  <span style={{ color: "#888" }}>{a.action}</span>
                </div>
                <div style={{ color: "#aaa", fontSize: 12, lineHeight: 1.5 }}>
                  {a.status === "thinking" ? "Thinking..." : a.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Drafts Queue */}
        <div style={{
          flex: 1,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 20,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}>
          <h3 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", marginBottom: 16 }}>Pending Publication ({drafts.length})</h3>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 10 }}>
            {drafts.map(draft => (
              <div 
                key={draft.id}
                onClick={() => setPreviewId(draft.id)}
                style={{
                  minWidth: 200,
                  padding: 12,
                  background: "rgba(255,255,255,0.02)",
                  border: `1px solid ${previewId === draft.id ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 4,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ fontSize: 10, color: "var(--accent)", marginBottom: 4 }}>{draft.topic}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{draft.title}</div>
              </div>
            ))}
            {drafts.length === 0 && <div style={{ color: "#444", fontSize: 11 }}>No pending drafts. Start agents to generate articles.</div>}
          </div>
        </div>
      </div>

      {/* Right Sidebar: Preview or Stats */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {previewId && selectedDraft ? (
          <div style={{
            background: "var(--surface)",
            border: "2px solid var(--accent)",
            borderRadius: 8,
            padding: 24,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            animation: "fadeIn 0.3s ease-out"
          }}>
            <button 
              onClick={() => setPreviewId(null)}
              style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", alignSelf: "flex-end", fontSize: 20 }}
            >×</button>
            <div style={{ fontSize: 10, color: "var(--accent)", textTransform: "uppercase", marginBottom: 8 }}>Preview Mode</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, marginBottom: 16 }}>{selectedDraft.title}</h2>
            
            {selectedDraft.image && (
              <img src={selectedDraft.image} alt={selectedDraft.title} style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 4, marginBottom: 16 }} />
            )}

            <div style={{ 
              fontSize: 13, 
              lineHeight: 1.6, 
              color: "#aaa", 
              overflowY: "auto", 
              flex: 1, 
              marginBottom: 24,
              whiteSpace: "pre-wrap"
            }}>
              {selectedDraft.description}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button 
                onClick={() => publishArticle(selectedDraft.id)}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "var(--accent)",
                  color: "#000",
                  border: "none",
                  borderRadius: 4,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >PUBLISH TO SITE</button>
              <button
                onClick={() => unpublishArticle(selectedDraft.id)}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "var(--red)",
                  color: "#000",
                  border: "none",
                  borderRadius: 4,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >UNPUBLISH</button>
            </div>
          </div>
        ) : (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 20, flex: 1 }}>
             <h3 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "var(--muted)", textTransform: "uppercase", marginBottom: 16 }}>Agent Ecosystem</h3>
             <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
               <div style={{ fontSize: 11 }}><span style={{ color: "var(--accent)" }}>SCOUT:</span> Now generating autonomous investigative reports.</div>
               <div style={{ fontSize: 11 }}><span style={{ color: "var(--accent)" }}>WRITER:</span> Synthesizing context images and data.</div>
             </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
