"use client"

import { useEffect, useRef, useState } from "react"
import { GitPullRequest, GitMerge, MessageSquare, CheckCircle2, Clock, AlertCircle, Zap, GitCommit, Eye, Terminal } from "lucide-react"

// ── Data ─────────────────────────────────────────────────────────────────────

const ALL_PRS = [
  { id: 145, title: "feat: multi-agent verification v2",        agent: "orchestrator",    status: "review",  comments: 2,  additions: 57,  deletions: 4,  branch: "feat/nli-pipeline-v2", time: "Just now" },
  { id: 144, title: "fix: premise cross-attention window",       agent: "analyst-agent",   status: "review",  comments: 1,  additions: 18,  deletions: 3,  branch: "fix/attn-window",      time: "1m ago" },
  { id: 143, title: "feat: streaming fact-check response",      agent: "monitor-agent",   status: "merged",  comments: 4,  additions: 93,  deletions: 11, branch: "feat/stream-verifier",  time: "1m ago" },
  { id: 142, title: "feat: add numeric scale guardrails",       agent: "executor-agent",  status: "merged",  comments: 3,  additions: 84,  deletions: 12, branch: "feat/scale-guard",     time: "2m ago" },
  { id: 141, title: "fix: entailment score backoff strategy",   agent: "monitor-agent",   status: "approved",comments: 1,  additions: 31,  deletions: 8,  branch: "fix/nli-backoff",       time: "8m ago" },
  { id: 140, title: "feat: deterministic candidate reranking",  agent: "researcher-agent",status: "review",  comments: 5,  additions: 142, deletions: 27, branch: "feat/rerank-beam",     time: "22m ago" },
  { id: 139, title: "refactor: BART LoRA adapter heads",        agent: "analyst-agent",   status: "merged",  comments: 7,  additions: 209, deletions: 88, branch: "refactor/lora-fp16",   time: "1h ago" },
]

const ALL_REVIEW_FILES = [
  { file: "pipeline/verifier.ts", pct: 72 },
  { file: "core/cross_attn.ts",   pct: 45 },
  { file: "nli/entailment.ts",    pct: 88 },
  { file: "rerank/constraints.ts",pct: 31 },
  { file: "cache/vram_alloc.ts",  pct: 60 },
]

const ALL_REVIEW_LINES: { type: "comment"|"approve"|"change"|"code"; text: string; author?: string }[] = [
  { type: "code",    text: 'const premise = await crossAttn.extract(doc.index)' },
  { type: "comment", text: "Validate premise bounds across sentence indices?", author: "analyst-agent" },
  { type: "code",    text: 'return nliVerifier.verify(summary, premise)' },
  { type: "approve", text: "LGTM — zero hallucination detected [entailment=0.98]", author: "monitor-agent" },
  { type: "code",    text: 'export const rerank = async (candidates, guards) => {' },
  { type: "change",  text: "Enforce scale mismatch check before soft scoring", author: "executor-agent" },
  { type: "code",    text: '  const feasible = candidates.filter(c => c.facts.valid)' },
  { type: "approve", text: "Approved — deterministic beam chosen", author: "orchestrator" },
  { type: "code",    text: '  await memory.commitRunTrace(feasible[0])' },
  { type: "comment", text: "Ensure VRAM freed via torch.cuda.empty_cache()", author: "monitor-agent" },
  { type: "code",    text: 'return { status: "verified", winner: feasible[0] }' },
  { type: "approve", text: "All 15 test suites passing", author: "analyst-agent" },
]

const COMMITS = [
  { hash: "a3f8c21", msg: "fix: fp16 memory ceiling guard in NLI pipeline",   time: "Just now" },
  { hash: "b7d2e09", msg: "feat: streaming token entropy & attention heat",   time: "4m ago"   },
  { hash: "c9a1f34", msg: "chore: bump @equisumm/core to 1.4.0",              time: "12m ago"  },
  { hash: "d4e6b78", msg: "perf: reduce cross-attention latency by 28%",      time: "31m ago"  },
  { hash: "e2c9d56", msg: "feat: add scale mismatch checker ($M vs $B)",      time: "1h ago"   },
]

const ACTIVITY_SEED = Array.from({ length: 35 }, () => ({
  level: Math.random() > 0.35 ? Math.floor(Math.random() * 4) + 1 : 0,
}))

// ── Sub-components ────────────────────────────────────────────────────────────

// Smooth 60fps bar chart in neon lime
function MiniBarGraph({ seed }: { seed: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const barsRef   = useRef<number[]>([])

  useEffect(() => {
    const N = 20
    barsRef.current = Array.from({ length: N }, (_, i) =>
      0.2 + 0.8 * Math.abs(Math.sin((i + seed) * 1.3))
    )

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    const draw = () => {
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      canvas.width  = W * devicePixelRatio
      canvas.height = H * devicePixelRatio
      ctx.scale(devicePixelRatio, devicePixelRatio)
      ctx.clearRect(0, 0, W, H)

      barsRef.current = barsRef.current.map((v, i) => {
        const target = 0.15 + 0.85 * Math.abs(Math.sin(Date.now() / 3000 + i * 0.8 + seed))
        return v + (target - v) * 0.012
      })

      const bars = barsRef.current
      const gap  = 2
      const bw   = (W - gap * (N - 1)) / N

      bars.forEach((v, i) => {
        const bh = v * H
        const x  = i * (bw + gap)
        const y  = H - bh
        ctx.beginPath()
        ctx.roundRect(x, y, bw, bh, 2)
        ctx.fillStyle = `rgba(74, 222, 128, ${0.15 + v * 0.75})`
        ctx.fill()
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [seed])

  return <canvas ref={canvasRef} style={{ width: "100%", height: 28, display: "block" }} />
}

// Smooth 60fps area sparkline with neon glow
function LiveSparkline({ seed }: { seed?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const ptsRef    = useRef<number[]>([])

  useEffect(() => {
    const N = 24
    ptsRef.current = Array.from({ length: N }, (_, i) =>
      0.1 + 0.7 * Math.abs(Math.sin(i * 0.6 + (seed ?? 0)))
    )

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    const draw = () => {
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      canvas.width  = W * devicePixelRatio
      canvas.height = H * devicePixelRatio
      ctx.scale(devicePixelRatio, devicePixelRatio)
      ctx.clearRect(0, 0, W, H)

      const last   = ptsRef.current[ptsRef.current.length - 1]
      const target = 0.1 + 0.85 * (0.5 + 0.5 * Math.sin(Date.now() / 2200 + (seed ?? 0)))
      ptsRef.current = [...ptsRef.current.slice(1), last + (target - last) * 0.04]

      const pts = ptsRef.current
      const step = W / (N - 1)

      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, "rgba(74, 222, 128, 0.28)")
      grad.addColorStop(1, "rgba(74, 222, 128, 0.0)")
      ctx.beginPath()
      ctx.moveTo(0, H)
      pts.forEach((v, i) => ctx.lineTo(i * step, H - v * H * 0.9))
      ctx.lineTo(W, H)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()

      ctx.beginPath()
      pts.forEach((v, i) => {
        const x = i * step, y = H - v * H * 0.9
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.strokeStyle = "#4ade80"
      ctx.lineWidth   = 1.5
      ctx.lineJoin    = "round"
      ctx.lineCap     = "round"
      ctx.stroke()

      const ex = W
      const ey = H - pts[pts.length - 1] * H * 0.9
      ctx.beginPath()
      ctx.arc(ex, ey, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = "#86efac"
      ctx.fill()

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [seed])

  return <canvas ref={canvasRef} style={{ width: "100%", height: 28, display: "block" }} />
}

// Smooth 60fps dot graph in neon emerald
function MiniDotGraph({ seed }: { seed?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef<number>(0)
  const ptsRef    = useRef<number[]>([])

  useEffect(() => {
    const N = 18
    ptsRef.current = Array.from({ length: N }, (_, i) =>
      0.1 + 0.8 * Math.abs(Math.sin(i * 0.9 + (seed ?? 2)))
    )

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    const draw = () => {
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      canvas.width  = W * devicePixelRatio
      canvas.height = H * devicePixelRatio
      ctx.scale(devicePixelRatio, devicePixelRatio)
      ctx.clearRect(0, 0, W, H)

      const last   = ptsRef.current[ptsRef.current.length - 1]
      const target = 0.1 + 0.85 * (0.5 + 0.5 * Math.sin(Date.now() / 2800 + (seed ?? 2) * 1.5))
      ptsRef.current = [...ptsRef.current.slice(1), last + (target - last) * 0.03]

      const pts  = ptsRef.current
      const step = W / (N - 1)

      ctx.beginPath()
      pts.forEach((v, i) => {
        const x = i * step, y = H - v * H * 0.88
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.strokeStyle = "rgba(74, 222, 128, 0.25)"
      ctx.lineWidth   = 1
      ctx.setLineDash([3, 3])
      ctx.stroke()
      ctx.setLineDash([])

      pts.forEach((v, i) => {
        const x = i * step, y = H - v * H * 0.88
        ctx.beginPath()
        ctx.arc(x, y, 2.2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(74, 222, 128, ${0.25 + v * 0.75})`
        ctx.fill()
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [seed])

  return <canvas ref={canvasRef} style={{ width: "100%", height: 28, display: "block" }} />
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    merged:   { bg: "rgba(168,85,247,0.18)", color: "#c084fc", icon: <GitMerge style={{ width: 9, height: 9 }} />,  label: "Merged"   },
    approved: { bg: "rgba(74,222,128,0.18)",  color: "#4ade80", icon: <CheckCircle2 style={{ width: 9, height: 9 }} />, label: "Approved" },
    review:   { bg: "rgba(250,204,21,0.18)", color: "#facc15", icon: <Eye style={{ width: 9, height: 9 }} />,       label: "In Review"},
  }[status] ?? { bg: "rgba(255,255,255,0.08)", color: "#9ca3af", icon: null, label: status }

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 8, padding: "2px 7px", borderRadius: 99,
      background: cfg.bg, color: cfg.color,
      fontFamily: "monospace", letterSpacing: "0.08em", textTransform: "uppercase",
      fontWeight: 600, border: `1px solid ${cfg.color}33`,
    }}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function Bar({ pct, color = "#4ade80" }: { pct: number; color?: string }) {
  const [w, setW] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setW(pct), 600)
    return () => clearTimeout(t)
  }, [pct])
  return (
    <div style={{ height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 99, width: "100%", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 99, transition: "width 1.4s cubic-bezier(0.16,1,0.3,1)", boxShadow: `0 0 6px ${color}88` }} />
    </div>
  )
}

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let s: number | null = null
    const f = (ts: number) => {
      if (!s) s = ts
      const p = Math.min((ts - s) / 1100, 1)
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * to))
      if (p < 1) requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
  }, [to])
  return <>{val}{suffix}</>
}

function LiveDot() {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 7, height: 7, flexShrink: 0 }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#4ade80", opacity: 0.5, animation: "ping 1.8s cubic-bezier(0,0,0.2,1) infinite" }} />
      <span style={{ borderRadius: "50%", width: "100%", height: "100%", background: "#4ade80" }} />
    </span>
  )
}

function HeatCell({ level, animDelay }: { level: number; animDelay: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), animDelay); return () => clearTimeout(t) }, [animDelay])
  const colors = [
    "rgba(255,255,255,0.06)",
    "rgba(74,222,128,0.22)",
    "rgba(74,222,128,0.45)",
    "rgba(74,222,128,0.72)",
    "#4ade80"
  ]
  return (
    <div style={{
      width: 9, height: 9, borderRadius: 2,
      background: colors[level],
      opacity: visible ? 1 : 0,
      transition: `opacity 0.4s ease`,
      boxShadow: level >= 3 ? "0 0 6px rgba(74,222,128,0.4)" : "none",
    }} />
  )
}

function ReviewLine({ item, delay }: { item: typeof ALL_REVIEW_LINES[0]; delay: number }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), delay); return () => clearTimeout(t) }, [delay])

  if (!visible) return null

  if (item.type === "code") {
    return (
      <div style={{ padding: "3px 10px", background: "rgba(5,7,12,0.9)", borderLeft: "2px solid #4ade80", margin: "2px 0", animation: "logIn 0.2s ease forwards", opacity: 0 }}>
        <code style={{ fontSize: 9, fontFamily: "monospace", color: "#86efac" }}>{item.text}</code>
      </div>
    )
  }
  const iconCfg = {
    approve: { icon: <CheckCircle2 style={{ width: 9, height: 9, color: "#4ade80", flexShrink: 0 }} />, color: "#4ade80" },
    change:  { icon: <AlertCircle  style={{ width: 9, height: 9, color: "#facc15", flexShrink: 0 }} />, color: "#facc15" },
    comment: { icon: <MessageSquare style={{ width: 9, height: 9, color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />, color: "rgba(255,255,255,0.7)" },
  }[item.type] ?? { icon: null, color: "rgba(255,255,255,0.6)" }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "4px 0", animation: "logIn 0.2s ease forwards", opacity: 0 }}>
      {iconCfg.icon}
      <div>
        <span style={{ fontSize: 9, color: iconCfg.color, fontFamily: "monospace" }}>{item.text}</span>
        {item.author && <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", marginLeft: 5, fontFamily: "monospace" }}>— {item.author}</span>}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function AgentInterface({ revealDelay = 0 }: { revealDelay?: number }) {
  const [revealed, setRevealed]       = useState(false)
  const [mounted, setMounted]         = useState(false)
  const [reqCount, setReqCount]       = useState(2840)
  const [cursor, setCursor]           = useState(true)
  const [prOffset, setPrOffset]       = useState(0)
  const [reviewFileIdx, setReviewFileIdx] = useState(0)
  const [reviewFilePcts, setReviewFilePcts] = useState([72, 45, 88, 31, 60])
  const [reviewLineIdx, setReviewLineIdx]   = useState(0)
  const [activity, setActivity]       = useState(ACTIVITY_SEED)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), revealDelay)
    return () => clearTimeout(t)
  }, [revealDelay])

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), revealDelay + 300)
    return () => clearTimeout(t)
  }, [revealDelay])

  useEffect(() => {
    const t = setInterval(() => {
      setReqCount(v => v + Math.floor(Math.random() * 8 + 2))
    }, 1600)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const t = setInterval(() => setPrOffset(v => (v + 1) % (ALL_PRS.length - 3)), 4000)
    return () => clearInterval(t)
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    const t = setInterval(() => {
      setReviewFilePcts(p => p.map(() => Math.floor(Math.random() * 40 + 55)))
    }, 3200)
    return () => clearInterval(t)
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    const t = setInterval(() => setReviewFileIdx(v => (v + 1) % ALL_REVIEW_FILES.length), 2800)
    return () => clearInterval(t)
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    const t = setInterval(() => {
      setReviewLineIdx(p => (p >= ALL_REVIEW_LINES.length ? 0 : p + 1))
    }, 650)
    return () => clearInterval(t)
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    const t = setInterval(() => {
      setActivity(prev => {
        const next = [...prev]
        const idx = Math.floor(Math.random() * next.length)
        next[idx] = { level: Math.min(4, next[idx].level + 1) }
        return next
      })
    }, 700)
    return () => clearInterval(t)
  }, [mounted])

  useEffect(() => { const t = setInterval(() => setCursor(c => !c), 530); return () => clearInterval(t) }, [])

  const anim = (delay: number): React.CSSProperties => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(10px)",
    transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
  })

  const panel: React.CSSProperties = {
    background: "rgba(13, 17, 24, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    overflow: "hidden",
  }

  const visiblePRs = ALL_PRS.slice(prOffset, prOffset + 4)

  return (
    <div
      className="relative z-10 flex items-center justify-center pointer-events-none select-none px-3 md:px-8 w-full"
      style={{ paddingTop: "20px", paddingBottom: "20px" }}
    >
      <div style={{
        width: "100%", maxWidth: 940,
        background: "rgba(8, 10, 15, 0.96)",
        border: "1px solid rgba(74, 222, 128, 0.3)",
        backdropFilter: "blur(32px)",
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,0.9), 0 0 25px rgba(74,222,128,0.1), 0 1px 0 rgba(255,255,255,0.1) inset",
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0)" : "translateY(72px)",
        transition: "opacity 0.9s cubic-bezier(0.16,1,0.3,1), transform 0.9s cubic-bezier(0.16,1,0.3,1)",
      }}>

        {/* Titlebar */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "10px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(12, 15, 22, 0.95)",
          position: "relative",
        }}>
          <div style={{ display: "flex", gap: 6 }}>
            {["#ff5f56","#ffbd2e","#27c93f"].map(c => (
              <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "inline-block" }} />
            ))}
          </div>
          <span style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)",
            fontSize: 10, letterSpacing: "0.18em", color: "rgba(255,255,255,0.5)", fontFamily: "monospace",
          }}>equisumm // verification-pipeline — master</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <LiveDot />
            <span style={{ fontSize: 8.5, color: "#4ade80", letterSpacing: "0.16em", fontFamily: "monospace", fontWeight: 600 }}>ALL AGENTS OPERATIONAL</span>
          </div>
        </div>

        {/* Metrics strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(10, 13, 18, 0.9)" }}>
          {[
            { label: "Verified Today",    val: 48,       icon: <GitMerge style={{ width: 11, height: 11 }} />,   graph: <MiniBarGraph seed={0} /> },
            { label: "Premise Checks",    val: 94,       icon: <Eye style={{ width: 11, height: 11 }} />,        graph: <MiniBarGraph seed={5} /> },
            { label: "Fact Check Passes", val: 326,      icon: <GitCommit style={{ width: 11, height: 11 }} />,  graph: <MiniDotGraph seed={2} /> },
            { label: "Inferences / min",  val: reqCount, icon: <Zap style={{ width: 11, height: 11 }} />,        graph: <LiveSparkline seed={7} /> },
          ].map((m, i) => (
            <div key={i} style={{ padding: "10px 14px", height: 86, overflow: "hidden", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.06)" : "none", ...anim(60 + i * 45) }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                <span style={{ color: "#4ade80" }}>{m.icon}</span>
                <span style={{ fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", fontFamily: "monospace" }}>{m.label}</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", lineHeight: 1, marginBottom: 5, fontFamily: "monospace" }}>
                {mounted ? <Counter to={m.val} /> : "—"}
              </div>
              {mounted && m.graph}
            </div>
          ))}
        </div>

        {/* Main 3-col body */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 0.85fr", gap: 10, padding: 10, height: 350, overflow: "hidden" }}>

          {/* Col 1 — PR list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%", overflow: "hidden", ...anim(160) }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 2px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <GitPullRequest style={{ width: 10, height: 10, color: "#4ade80" }} />
                <span style={{ fontSize: 8.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>Active Pull Requests</span>
              </div>
              <span style={{ fontSize: 7.5, color: "#4ade80", fontFamily: "monospace" }}>{ALL_PRS.filter(p => p.status === "review").length} IN AUDIT</span>
            </div>

            <div style={{ position: "relative", overflow: "hidden", flex: 1 }}>
              {visiblePRs.map((pr, i) => (
                <div key={`${pr.id}-${prOffset}`} style={{
                  ...panel,
                  padding: "8px 10px",
                  marginBottom: 6,
                  animation: i === 0 ? "prSlideIn 0.4s cubic-bezier(0.16,1,0.3,1) both" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 5, marginBottom: 5 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: "#ffffff", lineHeight: 1.3, marginBottom: 2 }}>{pr.title}</div>
                      <div style={{ fontSize: 7.5, fontFamily: "monospace", color: "rgba(255,255,255,0.4)" }}>{pr.branch} · {pr.agent}</div>
                    </div>
                    <StatusBadge status={pr.status} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 7 }}>
                      <span style={{ fontSize: 7.5, color: "#4ade80", fontFamily: "monospace" }}>+{pr.additions}</span>
                      <span style={{ fontSize: 7.5, color: "#f87171", fontFamily: "monospace" }}>-{pr.deletions}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <MessageSquare style={{ width: 7, height: 7, color: "rgba(255,255,255,0.4)" }} />
                        <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.4)" }}>{pr.comments}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <Clock style={{ width: 7, height: 7, color: "rgba(255,255,255,0.3)" }} />
                      <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>{pr.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Heatmap */}
            <div style={{ ...panel, padding: "8px 10px", flexShrink: 0, height: 78, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                <Terminal style={{ width: 9, height: 9, color: "#4ade80" }} />
                <span style={{ fontSize: 7.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>Verification Trace Activity</span>
              </div>
              <div style={{ display: "flex", gap: 2, flexWrap: "wrap", maxWidth: 220, height: 30, overflow: "hidden" }}>
                {activity.map((a, i) => <HeatCell key={i} level={a.level} animDelay={i * 18 + 300} />)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 4 }}>
                <span style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>Idle</span>
                {[0,1,2,3,4].map(l => (
                  <div key={l} style={{ width: 7, height: 7, borderRadius: 1.5, background: ["rgba(255,255,255,0.06)","rgba(74,222,128,0.22)","rgba(74,222,128,0.45)","rgba(74,222,128,0.72)","#4ade80"][l] }} />
                ))}
                <span style={{ fontSize: 7, color: "rgba(255,255,255,0.3)", fontFamily: "monospace" }}>Peak</span>
              </div>
            </div>
          </div>

          {/* Col 2 — Code Review */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%", overflow: "hidden", ...anim(210) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 2px", flexShrink: 0 }}>
              <Eye style={{ width: 10, height: 10, color: "#4ade80" }} />
              <span style={{ fontSize: 8.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>NLI Trace — #{ALL_PRS[reviewFileIdx % ALL_PRS.length].id}</span>
            </div>
            <div style={{ ...panel, flex: 1, padding: "9px 10px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ marginBottom: 7, paddingBottom: 7, borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 600, color: "#ffffff", marginBottom: 2 }}>feat: parallel fact check & NLI</div>
                <div style={{ display: "flex", gap: 5 }}>
                  <span style={{ fontSize: 7.5, color: "#4ade80", fontFamily: "monospace" }}>+142</span>
                  <span style={{ fontSize: 7.5, color: "#f87171", fontFamily: "monospace" }}>-27</span>
                  <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.4)" }}>5 modules</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8, flexShrink: 0 }}>
                {ALL_REVIEW_FILES.map((f, i) => (
                  <div key={f.file} style={{ opacity: i === reviewFileIdx ? 1 : 0.45, transition: "opacity 0.4s ease" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 7.5, fontFamily: "monospace", color: i === reviewFileIdx ? "#ffffff" : "rgba(255,255,255,0.5)", transition: "color 0.4s ease" }}>{f.file}</span>
                      <span style={{ fontSize: 7.5, fontFamily: "monospace", color: reviewFilePcts[i] > 70 ? "#4ade80" : "#facc15", transition: "color 0.4s ease", fontWeight: i === reviewFileIdx ? 700 : 400 }}>{Math.round(reviewFilePcts[i])}%</span>
                    </div>
                    <Bar pct={reviewFilePcts[i]} color={i === reviewFileIdx ? "#4ade80" : "rgba(74,222,128,0.3)"} />
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 7, flex: 1, overflow: "hidden" }}>
                {ALL_REVIEW_LINES.slice(0, reviewLineIdx).slice(-5).map((item, i) => (
                  <ReviewLine key={`${reviewLineIdx}-${i}`} item={item} delay={0} />
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                  <Terminal style={{ width: 7, height: 7, color: "rgba(74,222,128,0.5)" }} />
                  <span style={{ display: "inline-block", width: 4, height: 9, background: cursor ? "#4ade80" : "transparent", transition: "background 0.08s" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Col 3 — Commits + CI */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, height: "100%", overflow: "hidden", ...anim(260) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 2px", flexShrink: 0 }}>
              <GitCommit style={{ width: 10, height: 10, color: "#4ade80" }} />
              <span style={{ fontSize: 8.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>Audit Commits</span>
            </div>
            <div style={{ ...panel, flexShrink: 0, overflow: "hidden" }}>
              {COMMITS.slice(0, 4).map((c, i) => (
                <div key={c.hash} style={{
                  padding: "7px 10px",
                  borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  animation: mounted ? `fadeSlide 0.3s ease ${280 + i * 55}ms both` : "none",
                }}>
                  <div style={{ fontSize: 8.5, fontWeight: 500, color: "#ffffff", lineHeight: 1.35, marginBottom: 2 }}>{c.msg}</div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 7.5, fontFamily: "monospace", color: "#c084fc" }}>{c.hash}</span>
                    <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>{c.time}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 2px 0", flexShrink: 0 }}>
              <Zap style={{ width: 10, height: 10, color: "#4ade80" }} />
              <span style={{ fontSize: 8.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>Fleet Status</span>
            </div>
            <div style={{ ...panel, flexShrink: 0, overflow: "hidden" }}>
              {[
                { name: "researcher-agent", status: "passing", duration: "1m 32s" },
                { name: "analyst-agent",    status: "running", duration: "0m 48s" },
                { name: "executor-agent",   status: "passing", duration: "2m 11s" },
                { name: "monitor-agent",    status: "running", duration: "0m 54s" },
              ].map((a, i) => (
                <div key={a.name} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 10px",
                  borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {a.status === "running"
                      ? <div style={{ width: 8, height: 8, borderRadius: "50%", border: "1.5px solid #4ade80", borderTopColor: "transparent", animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
                      : <CheckCircle2 style={{ width: 8, height: 8, color: "#4ade80", flexShrink: 0 }} />
                    }
                    <span style={{ fontSize: 8.5, fontFamily: "monospace", color: "#f3f4f6" }}>{a.name}</span>
                  </div>
                  <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>{a.duration}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes logIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeSlide { from { opacity: 0; transform: translateX(-5px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes prSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
