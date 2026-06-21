/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"

type Activity = {
  id: string
  agent: string
  action: string
  status: string
  targetId?: string | null
  content: string | null
  createdAt: string
}

type DraftArticle = {
  id: string
  title: string
  description: string | null
  topic: string
  image: string | null
  fetchedAt?: string
  pubDate?: string
  createdAt?: string
  published: boolean
  factScore: number | null
  biasAnalysis: string | null
}

type PublishedMessage = {
  text: string
  id?: string
} | null

export default function NewsroomClient({ initialActivity }: { initialActivity: Activity[] }) {
  const [activity, setActivity] = useState<Activity[]>(initialActivity)
  const [drafts, setDrafts] = useState<DraftArticle[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [reanalysing, setReanalysing] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [publishedMsg, setPublishedMsg] = useState<PublishedMessage>(null)
  const [topicFilter, setTopicFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"time" | "score">("time")
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function poll() {
      try {
        const [actRes, drRes] = await Promise.all([
          fetch("/api/admin/ai/newsroom/activity", { signal: controller.signal }),
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [activity])

  async function fetchDrafts() {
    try {
      const res = await fetch("/api/admin/ai/drafts")
      const data = await res.json()
      setDrafts(data)
    } catch (e) {
      console.error(e)
    }
  }

  async function refreshNewsroom() {
    const [actRes, drRes] = await Promise.all([
        fetch("/api/admin/ai/newsroom/activity"),
      fetch("/api/admin/ai/drafts"),
    ])
    const [actData, drData] = await Promise.all([
      actRes.json(),
      drRes.json(),
    ])
    setActivity(actData)
    setDrafts(drData)
  }

  async function triggerAgents() {
    setIsProcessing(true)
    try {
      await fetch("/api/ai/newsroom/process", { method: "POST" })
      await refreshNewsroom()
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
      setPublishedMsg({ text: "Article published to /ai-news", id })
      setTimeout(() => setPublishedMsg(null), 3000)
      fetchDrafts()
    } catch (e) {
      console.error(e)
    }
  }

  async function deleteDraft(id: string) {
    if (!confirm("Discard this draft permanently? This cannot be undone.")) return

    try {
      const res = await fetch("/api/admin/ai/discard", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) return
      setPreviewId(null)
      setPublishedMsg({ text: "Draft discarded." })
      setTimeout(() => setPublishedMsg(null), 2000)
      fetchDrafts()
    } catch (e) {
      console.error(e)
    }
  }

  async function reanalyseDraft(id: string) {
    setReanalysing(true)
    try {
      const res = await fetch("/api/admin/ai/reanalyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (res.ok) {
        setDrafts((prev) => prev.map((draft) =>
          draft.id === id
            ? { ...draft, factScore: data.factScore, biasAnalysis: data.biasAnalysis }
            : draft
        ))
        await refreshNewsroom()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setReanalysing(false)
    }
  }

  const selectedDraft = drafts.find((draft) => draft.id === previewId)
  const draftTopics = useMemo(
    () => ["all", ...Array.from(new Set(drafts.map((draft) => draft.topic)))],
    [drafts]
  )
  const filteredDrafts = topicFilter === "all"
    ? drafts
    : drafts.filter((draft) => draft.topic === topicFilter)
  const sortedFilteredDrafts = [...filteredDrafts].sort((a, b) => {
    if (sortBy === "score") {
      return (b.factScore ?? -1) - (a.factScore ?? -1)
    }
    return getDraftTime(b).getTime() - getDraftTime(a).getTime()
  })

  return (
    <>
      {publishedMsg && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          background: "var(--accent)",
          color: "#000",
          padding: "8px 16px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          zIndex: 9999,
        }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span>{publishedMsg.text}</span>
            {publishedMsg.id && (
              <a
                href={`/ai-news/${publishedMsg.id}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: "#000",
                  fontWeight: 700,
                  textDecoration: "underline",
                  fontSize: 10,
                }}
              >
                VIEW -&gt;
              </a>
            )}
          </div>
        </div>
      )}

      <div style={{
        display: "flex",
        gap: 24,
        marginBottom: 20,
        padding: "12px 16px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        fontFamily: "'IBM Plex Mono', monospace",
        flexWrap: "wrap",
      }}>
        {[
          { label: "DRAFTS PENDING", value: drafts.length },
          {
            label: "AGENT CYCLES",
            value: activity.filter((item) =>
              item.action.toLowerCase().includes("cycle") || item.agent === "Scout"
            ).length,
          },
          {
            label: "LAST ACTIVITY",
            value: activity[0]
              ? new Date(activity[0].createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "-",
          },
          { label: "STATUS", value: isProcessing ? "RUNNING" : "IDLE" },
        ].map((stat) => (
          <div key={stat.label}>
            <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "1px" }}>
              {stat.label}
            </div>
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              color: stat.label === "STATUS" && stat.value === "RUNNING"
                ? "var(--accent)"
                : "var(--text)",
              marginTop: 2,
            }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 280px 380px",
        gap: 24,
        height: "calc(100vh - 220px)",
      }}>
        <div style={{
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
              }}>
                CONSOLE V2.0
              </span>
            </div>
            <button
              onClick={triggerAgents}
              disabled={isProcessing}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 10,
                letterSpacing: "1px",
                padding: "6px 14px",
                background: isProcessing ? "transparent" : "var(--accent)",
                color: isProcessing ? "var(--accent)" : "#000",
                border: isProcessing ? "1px solid var(--accent)" : "none",
                borderRadius: 4,
                cursor: isProcessing ? "not-allowed" : "pointer",
                animation: isProcessing ? "pulse 1.5s infinite" : "none",
              }}
            >
              {isProcessing ? "● RUNNING..." : "▶ DEPLOY AGENTS"}
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
            {activity.map((item) => (
              <div
                key={item.id}
                style={{
                  borderLeft: `2px solid ${item.status === "thinking" ? "var(--accent)" : "#333"}`,
                  paddingLeft: 16,
                  opacity: item.status === "thinking" ? 1 : 0.7,
                }}
              >
                <div style={{
                  display: "flex",
                  gap: 12,
                  marginBottom: 4,
                  fontSize: 11,
                  alignItems: "center",
                }}>
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                    [{item.agent.toUpperCase()}]
                  </span>
                  <span style={{ color: "#888" }}>{item.action}</span>
                  <span style={{ color: "#555", marginLeft: "auto", fontSize: 9 }}>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  {item.targetId && (
                    <button
                      type="button"
                      onClick={() => setPreviewId(item.targetId ?? null)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--accent)",
                        fontSize: 9,
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: 0,
                      }}
                    >
                      VIEW
                    </button>
                  )}
                </div>
                <div style={{ color: "#aaa", fontSize: 12, lineHeight: 1.5 }}>
                  {item.status === "thinking" ? "Thinking..." : item.content}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 16,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>
          <h3 style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            color: "var(--muted)",
            textTransform: "uppercase",
            marginBottom: 12,
          }}>
            Pending Publication ({filteredDrafts.length}/{drafts.length})
          </h3>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {draftTopics.map((topic) => (
              <button
                key={topic}
                onClick={() => setTopicFilter(topic)}
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 9,
                  padding: "3px 8px",
                  background: topicFilter === topic ? "var(--accent)" : "var(--surface2)",
                  color: topicFilter === topic ? "#000" : "var(--muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  cursor: "pointer",
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                {topic === "all" ? `ALL (${drafts.length})` : topic}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[
              { label: "NEWEST", value: "time" as const },
              { label: "BY SCORE", value: "score" as const },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value)}
                style={{
                  flex: 1,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 9,
                  padding: "5px 8px",
                  background: sortBy === option.value ? "var(--accent)" : "transparent",
                  color: sortBy === option.value ? "#000" : "var(--muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div style={{ overflowY: "auto", paddingRight: 4 }}>
            {sortedFilteredDrafts.map((draft) => (
              <div
                key={draft.id}
                onClick={() => setPreviewId(draft.id)}
                style={{
                  padding: "12px 14px",
                  background: previewId === draft.id
                    ? "var(--surface2)"
                    : "var(--surface)",
                  border: `1px solid ${previewId === draft.id
                    ? "var(--accent)"
                    : "var(--border)"}`,
                  borderRadius: 6,
                  cursor: "pointer",
                  marginBottom: 8,
                }}
              >
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 9,
                  color: "var(--accent)",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: 6,
                }}>
                  {draft.topic}
                </div>

                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text)",
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  marginBottom: 8,
                }}>
                  {draft.title}
                </div>

                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 9,
                    color: "var(--muted)",
                  }}>
                    {draft.description
                      ? `${draft.description.split(" ").length} words`
                      : "-"}
                  </span>

                  {draft.factScore !== null && (
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 9,
                      padding: "2px 6px",
                      background: draft.factScore >= 80
                        ? "rgba(74,240,196,0.15)"
                        : draft.factScore >= 60
                        ? "rgba(245,197,66,0.15)"
                        : "rgba(255,77,77,0.15)",
                      color: draft.factScore >= 80
                        ? "#4af0c4"
                        : draft.factScore >= 60
                        ? "#f5c542"
                        : "#ff4d4d",
                      borderRadius: 3,
                    }}>
                      FS: {draft.factScore}
                    </span>
                  )}

                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 9,
                    color: "var(--muted)",
                  }}>
                    {getDraftTime(draft).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
            {sortedFilteredDrafts.length === 0 && (
              <div style={{ color: "#444", fontSize: 11 }}>
                No pending drafts for this filter.
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          {previewId && selectedDraft ? (
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              height: "100%",
            }}>
              <div style={{
                padding: "10px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--surface2)",
              }}>
                <span style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  color: "var(--accent)",
                  letterSpacing: "1px",
                }}>
                  DRAFT PREVIEW
                </span>
                <button
                  onClick={() => setPreviewId(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--muted)",
                    cursor: "pointer",
                  }}
                >
                  x
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  color: "var(--accent)",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}>
                  {selectedDraft.topic}
                </div>

                <h2 style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--text)",
                  lineHeight: 1.3,
                  marginBottom: 16,
                }}>
                  {selectedDraft.title}
                </h2>

                {selectedDraft.image && (
                  <img
                    src={selectedDraft.image}
                    alt={selectedDraft.title}
                    style={{
                      width: "100%",
                      height: 160,
                      objectFit: "cover",
                      borderRadius: 4,
                      marginBottom: 16,
                    }}
                  />
                )}

                <div style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: "var(--text)",
                  whiteSpace: "pre-wrap",
                  marginBottom: 20,
                }}>
                  {selectedDraft.description}
                </div>

                <div style={{
                  padding: "12px 14px",
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  marginBottom: 16,
                }}>
                  <div style={{
                    marginBottom: 6,
                    color: "var(--muted)",
                    fontSize: 9,
                    letterSpacing: "1px",
                  }}>
                    AGENT ANALYSIS
                  </div>
                  {selectedDraft.factScore !== null ? (
                    <div style={{
                      color: selectedDraft.factScore >= 80
                        ? "#4af0c4"
                        : selectedDraft.factScore >= 60
                        ? "#f5c542"
                        : "#ff4d4d",
                      marginBottom: 4,
                    }}>
                      FACT SCORE: {selectedDraft.factScore}/100
                    </div>
                  ) : (
                    <div style={{ color: "var(--muted)" }}>
                      FACT SCORE: not yet analysed
                    </div>
                  )}
                  {selectedDraft.biasAnalysis && (
                    <div style={{
                      color: "var(--muted)",
                      marginTop: 4,
                      fontSize: 10,
                      lineHeight: 1.5,
                    }}>
                      BIAS: {selectedDraft.biasAnalysis}
                    </div>
                  )}
                </div>

                <div style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 10,
                  color: "var(--muted)",
                  marginBottom: 20,
                }}>
                  {selectedDraft.description
                    ? `${selectedDraft.description.split(" ").length} words - ~${Math.ceil(selectedDraft.description.split(" ").length / 200)} min read`
                    : ""}
                </div>
              </div>

              <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
                <button
                  onClick={() => reanalyseDraft(selectedDraft.id)}
                  disabled={reanalysing}
                  style={{
                    width: "100%",
                    marginBottom: 8,
                    padding: "10px",
                    background: "transparent",
                    color: reanalysing ? "var(--muted)" : "var(--accent)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 700,
                    cursor: reanalysing ? "not-allowed" : "pointer",
                  }}
                >
                  {reanalysing ? "ANALYSING..." : "RE-ANALYSE WITH AI"}
                </button>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    onClick={() => publishArticle(selectedDraft.id)}
                    style={{
                      padding: "10px",
                      background: "var(--accent)",
                      color: "#000",
                      border: "none",
                      borderRadius: 4,
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    PUBLISH
                  </button>
                  <button
                    onClick={() => deleteDraft(selectedDraft.id)}
                    style={{
                      padding: "10px",
                      background: "transparent",
                      color: "var(--red)",
                      border: "1px solid var(--red)",
                      borderRadius: 4,
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    DISCARD
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 20,
            }}>
              <h3 style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                color: "var(--accent)",
                letterSpacing: "1px",
                marginBottom: 16,
              }}>
                AGENT ROSTER
              </h3>
              {[
                { name: "SCOUT", role: "Impact Evaluator", desc: "Scans RSS context and generates investigative draft reports." },
                { name: "FACT-CHECKER", role: "Truth Verifier", desc: "Scores factual consistency 0-100 based on source and content." },
                { name: "SPIN-DOCTOR", role: "Bias Analyst", desc: "Detects political, emotional, and corporate lean in reporting." },
                { name: "EDITORIAL-AI", role: "Lead Writer", desc: "Synthesizes balanced, professional multi-source reports." },
              ].map((agent) => (
                <div
                  key={agent.name}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 11,
                    color: "var(--accent)",
                    fontWeight: 700,
                  }}>
                    {agent.name}
                    <span style={{ color: "var(--muted)", fontWeight: 400, marginLeft: 8 }}>
                      {agent.role}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10,
                    color: "var(--muted)",
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}>
                    {agent.desc}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  )
}

function getDraftTime(draft: DraftArticle) {
  return new Date(draft.createdAt ?? draft.fetchedAt ?? draft.pubDate ?? 0)
}
