"use client"

import { useEffect, useState, useRef } from "react"

const AGENT_NAMES = [
  "analyst-7f2a", "executor-3b1c", "monitor-9d4e", "researcher-2c8f",
  "planner-5a3d", "writer-1e9b", "auditor-4f2c", "coder-8d1a",
  "reviewer-6b3e", "scheduler-0c7f",
]

const TASKS = [
  "Auditing 10-K financial disclosures for scale mismatches",
  "Verifying premise entailment in legal liability clause",
  "Extracting cross-attention weights across 80 sentences",
  "Synthesizing ROUGE-free factuality benchmark suite",
  "Running deterministic sentence reranker [beam=4]",
  "Flagging unsupported entity names in summary candidate",
  "Streaming NLI contradiction checks to client WebSocket",
  "Monitoring GPU VRAM allocations [4.2GB / 6.0GB]",
  "Refactoring BART-base LoRA adapter attention heads",
  "Executing offline token index boundary validation",
]

const REGIONS = ["us-east", "eu-west", "ap-south", "us-west", "eu-central"]
const STATUSES = [
  { label: "running",  color: "#4ade80" },
  { label: "running",  color: "#4ade80" },
  { label: "verified", color: "#34d399" },
  { label: "queued",   color: "#facc15" },
  { label: "complete", color: "#60a5fa" },
]

type AgentRow = {
  id: string
  name: string
  task: string
  region: string
  status: typeof STATUSES[number]
  progress: number
  elapsed: string
  key: number
}

function randomRow(key: number): AgentRow {
  return {
    id: Math.random().toString(36).slice(2, 8).toUpperCase(),
    name: AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)],
    task: TASKS[Math.floor(Math.random() * TASKS.length)],
    region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
    status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
    progress: Math.floor(Math.random() * 85 + 10),
    elapsed: `${Math.floor(Math.random() * 14 + 1)}m ${Math.floor(Math.random() * 59)}s`,
    key,
  }
}

// Animated neon progress bar
function ProgressBar({ initial }: { initial: number }) {
  const [pct, setPct] = useState(initial)
  const rafRef = useRef<number>(0)
  const pctRef = useRef(initial)

  useEffect(() => {
    const tick = () => {
      pctRef.current = Math.min(99, pctRef.current + 0.02)
      setPct(Math.round(pctRef.current))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div style={{ width: "100%", height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 9, overflow: "hidden" }}>
      <div style={{
        height: "100%", borderRadius: 9,
        width: `${pct}%`,
        background: "linear-gradient(90deg, #22c55e, #4ade80)",
        boxShadow: "0 0 8px rgba(74,222,128,0.5)",
        transition: "width 0.5s linear",
      }} />
    </div>
  )
}

const SEED_ROWS: AgentRow[] = [
  { id: "A1B2C3", name: "analyst-7f2a",    task: "Auditing 10-K financial disclosures for scale mismatches", region: "us-east",    status: STATUSES[0], progress: 42, elapsed: "3m 12s", key: 0 },
  { id: "D4E5F6", name: "executor-3b1c",   task: "Running deterministic sentence reranker [beam=4]",        region: "eu-west",    status: STATUSES[0], progress: 67, elapsed: "7m 48s", key: 1 },
  { id: "G7H8I9", name: "researcher-2c8f", task: "Extracting cross-attention weights across 80 sentences", region: "us-west",    status: STATUSES[3], progress: 18, elapsed: "1m 05s", key: 2 },
  { id: "J0K1L2", name: "planner-5a3d",    task: "Verifying premise entailment in legal liability clause",   region: "eu-central", status: STATUSES[0], progress: 55, elapsed: "5m 30s", key: 3 },
  { id: "M3N4O5", name: "coder-8d1a",      task: "Refactoring BART-base LoRA adapter attention heads",       region: "ap-south",   status: STATUSES[0], progress: 80, elapsed: "11m 22s", key: 4 },
  { id: "P6Q7R8", name: "monitor-9d4e",    task: "Monitoring GPU VRAM allocations [4.2GB / 6.0GB]",          region: "us-east",    status: STATUSES[4], progress: 99, elapsed: "14m 01s", key: 5 },
]

export function LiveAgentFeed() {
  const [rows, setRows] = useState<AgentRow[]>(SEED_ROWS)
  const keyRef = useRef(100)

  useEffect(() => {
    setRows(Array.from({ length: 6 }, (_, i) => randomRow(i)))

    const t = setInterval(() => {
      keyRef.current++
      setRows(prev => [...prev.slice(1), randomRow(keyRef.current)])
    }, 2800)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 16,
      overflow: "hidden",
      background: "rgba(10, 12, 17, 0.9)",
      boxShadow: "0 0 35px rgba(0,0,0,0.7), 0 0 15px rgba(74,222,128,0.06)",
    }}>
      {/* Table header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "85px 1fr 75px 80px",
        padding: "10px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(15, 18, 25, 0.95)",
      }}>
        {["AGENT", "TASK / VERIFICATION", "REGION", "STATUS"].map(h => (
          <span key={h} style={{ fontSize: 8.5, letterSpacing: "0.14em", color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ overflow: "hidden" }}>
        {rows.map((row, i) => (
          <div
            key={row.key}
            style={{
              display: "grid",
              gridTemplateColumns: "85px 1fr 75px 80px",
              padding: "10px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              gap: 8,
              alignItems: "center",
              animation: i === rows.length - 1 ? "rowSlideIn 0.4s cubic-bezier(0.16,1,0.3,1) both" : "none",
            }}
          >
            {/* Agent */}
            <div>
              <div style={{ fontSize: 9.5, fontFamily: "monospace", color: "#f3f4f6", fontWeight: 600, marginBottom: 1 }}>{row.name}</div>
              <div style={{ fontSize: 8, fontFamily: "monospace", color: "#4ade80" }}>#{row.id}</div>
            </div>

            {/* Task + progress */}
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 9.5, color: "rgba(255,255,255,0.75)", lineHeight: 1.35, marginBottom: 6,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                fontFamily: "monospace",
              }}>{row.task}</div>
              <ProgressBar initial={row.progress} />
            </div>

            {/* Region */}
            <div style={{ fontSize: 8.5, fontFamily: "monospace", color: "rgba(255,255,255,0.4)" }}>{row.region}</div>

            {/* Status */}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: row.status.color,
                boxShadow: `0 0 8px ${row.status.color}`,
                animation: row.status.label === "running" ? "statusPulse 2s ease-in-out infinite" : "none",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 8.5, fontFamily: "monospace", color: row.status.color, textTransform: "uppercase" }}>{row.status.label}</span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes rowSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

export function LiveAgentCounter() {
  const [count, setCount] = useState(14892)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const t = setInterval(() => {
      setCount(v => v + Math.floor(Math.random() * 5 - 2))
    }, 1200)
    return () => clearInterval(t)
  }, [])

  return (
    <span style={{
      fontFamily: "monospace",
      fontSize: "clamp(3rem, 6vw, 5rem)",
      fontWeight: 700,
      color: "#4ade80",
      lineHeight: 1,
      letterSpacing: "-0.02em",
      textShadow: "0 0 30px rgba(74,222,128,0.4)",
    }}>
      {mounted ? count.toLocaleString("en-US") : "14,892"}
    </span>
  )
}
