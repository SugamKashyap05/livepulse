"use client"

import { useEffect, useState } from "react"
import { Activity, Clock, Terminal, Server, CheckCircle2, AlertCircle } from "lucide-react"

type Job = {
  id: string
  title: string
  status: string
  type: string
  updatedAt: string
}

type AgentActivity = {
  id: string
  agent: string
  action: string
  status: string
  content: string | null
  createdAt: string
}

type AiLog = {
  id: string
  action: string
  model: string
  success: boolean
  createdAt: string
  ms: number | null
}

export default function TelemetryClient() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [activities, setActivities] = useState<AgentActivity[]>([])
  const [logs, setLogs] = useState<AiLog[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const eventSource = new EventSource("/api/admin/ai-manager/telemetry/stream")

    eventSource.onopen = () => {
      setIsConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === "init") {
          setJobs(data.jobs)
          setActivities(data.activities)
          setLogs(data.logs)
        } else if (data.type === "update") {
          if (data.jobs && data.jobs.length > 0) {
            setJobs((prev) => {
              const updated = [...prev]
              data.jobs.forEach((newJob: Job) => {
                const idx = updated.findIndex((j) => j.id === newJob.id)
                if (idx !== -1) updated[idx] = newJob
                else updated.unshift(newJob)
              })
              return updated.slice(0, 50)
            })
          }

          if (data.activities && data.activities.length > 0) {
            setActivities((prev) => {
              const updated = [...data.activities, ...prev]
              // Unique by ID to prevent duplicates if any
              const seen = new Set()
              return updated.filter((item) => {
                if (seen.has(item.id)) return false
                seen.add(item.id)
                return true
              }).slice(0, 50)
            })
          }

          if (data.logs && data.logs.length > 0) {
            setLogs((prev) => {
              const updated = [...data.logs, ...prev]
              const seen = new Set()
              return updated.filter((item) => {
                if (seen.has(item.id)) return false
                seen.add(item.id)
                return true
              }).slice(0, 50)
            })
          }
        }
      } catch (err) {
        console.error("Failed to parse SSE data", err)
      }
    }

    eventSource.onerror = (err) => {
      console.error("SSE Error", err)
      setIsConnected(false)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Connection Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontFamily: "var(--font-mono)" }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: isConnected ? "var(--green, #22c55e)" : "var(--red, #ef4444)",
          boxShadow: isConnected ? "0 0 8px var(--green, #22c55e)" : "none"
        }} />
        <span style={{ color: isConnected ? "var(--green, #22c55e)" : "var(--red, #ef4444)" }}>
          {isConnected ? "LIVE STREAM ACTIVE" : "DISCONNECTED"}
        </span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 24
      }}>
        {/* Column 1: Active Jobs */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16,
          display: "flex", flexDirection: "column", height: 600
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "var(--text)" }}>
            <Server size={20} color="var(--accent)" />
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, margin: 0 }}>Active Jobs</h2>
          </div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 8 }}>
            {jobs.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--muted)", fontFamily: "var(--font-mono)", margin: 0 }}>No active jobs.</p>
            ) : (
              jobs.map((job) => (
                <div key={job.id} style={{ padding: 12, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", borderRadius: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginRight: 8 }}>{job.title}</span>
                    <span style={{ padding: "2px 6px", borderRadius: 9999, fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", background: "rgba(59, 130, 246, 0.1)", color: "#60a5fa" }}>
                      {job.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                    <span>{job.type}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={12} />
                      {new Date(job.updatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Agent Activities */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16,
          display: "flex", flexDirection: "column", height: 600
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "var(--text)" }}>
            <Activity size={20} color="#a855f7" />
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, margin: 0 }}>Agent Thought Stream</h2>
          </div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 8 }}>
            {activities.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--muted)", fontFamily: "var(--font-mono)", margin: 0 }}>No recent activity.</p>
            ) : (
              activities.map((activity) => (
                <div key={activity.id} style={{ padding: 12, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", borderLeft: "3px solid #a855f7", borderRadius: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: "#d8b4fe", fontFamily: "var(--font-mono)" }}>[{activity.agent}]</span>
                    <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Clock size={12} />
                      {new Date(activity.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text)", marginBottom: 8, fontWeight: 500 }}>{activity.action}</div>
                  {activity.content && (
                    <div style={{ fontSize: 12, color: "var(--muted)", background: "var(--surface)", padding: 8, borderRadius: 4, border: "1px solid var(--border)", fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {activity.content}
                    </div>
                  )}
                  <div style={{ marginTop: 8, textAlign: "right" }}>
                     <span style={{
                       fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", padding: "2px 6px", borderRadius: 4,
                       background: activity.status === 'thinking' ? "rgba(234, 179, 8, 0.1)" : "rgba(34, 197, 94, 0.1)",
                       color: activity.status === 'thinking' ? "#eab308" : "#22c55e"
                     }}>
                      {activity.status}
                     </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Raw AI Logs */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16,
          display: "flex", flexDirection: "column", height: 600
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "var(--text)" }}>
            <Terminal size={20} color="var(--green, #22c55e)" />
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, margin: 0 }}>LLM Invocations</h2>
          </div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 8 }}>
            {logs.length === 0 ? (
              <p style={{ fontSize: 14, color: "var(--muted)", fontFamily: "var(--font-mono)", margin: 0 }}>No logs available.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} style={{ padding: 8, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", borderRadius: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 4 }}>
                      {log.success ? (
                        <CheckCircle2 size={12} color="var(--green, #22c55e)" />
                      ) : (
                        <AlertCircle size={12} color="var(--red, #ef4444)" />
                      )}
                      {log.action}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                       {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)" }}>
                    <span style={{ background: "var(--surface)", padding: "2px 4px", borderRadius: 4 }}>{log.model}</span>
                    {log.ms && <span>{log.ms}ms</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
