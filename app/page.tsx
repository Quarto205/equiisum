"use client"

import React, { useRef, useEffect, useState, useCallback } from "react"
import { IntroAnimation, INTRO_DURATION_MS, HERO_REVEAL_MS } from "@/components/intro-animation"
import { AgentInterface } from "@/components/agent-interface"
import { PixelIcon } from "@/components/pixel-icon"
import { LiveAgentFeed, LiveAgentCounter } from "@/components/live-agent-feed"
import { RevealText } from "@/components/reveal-text"
import { StackingAgentCards } from "@/components/stacking-agent-cards"
import { MobileNav } from "@/components/mobile-nav"
import { DevExSection } from "@/components/devex-section"

// ─── Intersection Observer hook ──────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

// ─── Animated counter ────────────────────────────────────────────────────────
function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const { ref, inView } = useInView()
  useEffect(() => {
    if (!inView) return
    let start = 0
    const duration = 1800
    const step = 16
    const increment = end / (duration / step)
    const timer = setInterval(() => {
      start += increment
      if (start >= end) { setCount(end); clearInterval(timer) }
      else setCount(Math.floor(start))
    }, step)
    return () => clearInterval(timer)
  }, [inView, end])
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

// ─── Bento card ──────────────────────────────────────────────────────────────
function BentoCard({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, inView } = useInView(0.1)
  return (
    <div
      ref={ref}
      className={`group relative rounded-2xl border border-white/10 bg-[#0c0e14] overflow-hidden transition-all duration-700 hover:border-emerald-500/40 hover:bg-[#10131c] hover:shadow-[0_0_25px_rgba(74,222,128,0.12)] ${className}`}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms, border-color 0.3s ease, background-color 0.3s ease`,
      }}
    >
      {/* Hover glow spot */}
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: "radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(74,222,128,0.06), transparent 70%)" }}
      />
      {children}
    </div>
  )
}

// ─── Pill tag ─────────────────────────────────────────────────────────────────
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono tracking-widest text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 uppercase">
      {children}
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AgenticPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [heroReady, setHeroReady] = useState(false)
  const [videoReady, setVideoReady] = useState(false)

  const handleIntroDone = useCallback(() => {
    setHeroReady(true)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setVideoReady(true), HERO_REVEAL_MS)
    return () => clearTimeout(t)
  }, [])

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`)
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`)
  }

  return (
    <div className="bg-[#050505] text-[#e5e5e5] min-h-screen font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-300">

      {/* ── INTRO ANIMATION ───────────────────────────────────────────────── */}
      <IntroAnimation onDone={handleIntroDone} />

      {/* ── STICKY NAV ────────────────────────────────────────────────────── */}
      <MobileNav />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen overflow-hidden cyber-grid flex flex-col justify-between pt-24 pb-16">

        {/* Ambient radial green glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

        {/* Video background if available, smoothly faded */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-25 mix-blend-screen"
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/agentic-hero-9yW3wnTNMfn2U6lsVhTTZSJFEvAoSj.mp4"
          style={{
            transform: videoReady ? "scale(1.05)" : "scale(0.85)",
            transition: "transform 2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />

        {/* Progressive dark gradient masks */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent" />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#050505] via-transparent to-[#050505]" />

        {/* Hero Title & Metrics */}
        <div className="relative z-20 px-6 md:px-12 max-w-5xl mx-auto w-full pt-12 md:pt-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-[11px] font-mono tracking-widest text-emerald-400 mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#4ade80]" />
            AUTONOMOUS AGENT ORCHESTRATION & VERIFICATION
          </div>

          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light text-white leading-[1.02] tracking-tight mb-10 font-mono"
            style={{
              opacity: heroReady ? 1 : 0,
              filter: heroReady ? "blur(0px)" : "blur(24px)",
              transform: heroReady ? "translateY(0px)" : "translateY(32px)",
              transition: "opacity 1s cubic-bezier(0.16,1,0.3,1) 0ms, filter 1s cubic-bezier(0.16,1,0.3,1) 0ms, transform 1s cubic-bezier(0.16,1,0.3,1) 0ms",
            }}
          >
            Build &amp; orchestrate<br />
            <span className="text-emerald-400 font-semibold drop-shadow-[0_0_35px_rgba(74,222,128,0.35)]">AI agents</span> while<br />
            you sleep.
          </h1>

          {/* Staggered metrics */}
          <div className="flex flex-wrap gap-8 sm:gap-14 border-t border-white/10 pt-8 max-w-2xl">
            {[
              { value: "50M+", label: "Verified Tasks" },
              { value: "99.9%", label: "Pipeline Uptime" },
              { value: "180+", label: "Edge Regions" },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  opacity: heroReady ? 1 : 0,
                  filter: heroReady ? "blur(0px)" : "blur(16px)",
                  transform: heroReady ? "translateY(0px)" : "translateY(20px)",
                  transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${120 + i * 80}ms, filter 0.8s cubic-bezier(0.16,1,0.3,1) ${120 + i * 80}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${120 + i * 80}ms`,
                }}
              >
                <div className="text-3xl sm:text-4xl text-white font-mono font-bold tracking-tight text-emerald-400">{stat.value}</div>
                <div className="text-xs font-mono text-white/40 tracking-widest uppercase mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Interactive Terminal / Dashboard Preview */}
        <div className="relative z-20 w-full max-w-6xl mx-auto px-4 md:px-8 mt-14">
          <AgentInterface revealDelay={HERO_REVEAL_MS + 200} />
        </div>
      </section>

      {/* ── PLATFORM OVERVIEW (bento) ──────────────────────────────────────── */}
      <section id="platform" className="py-28 px-6 md:px-12 lg:px-20 border-t border-white/10 cyber-grid relative">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <PixelIcon type="platform" size={40} />
            <div className="mt-4"><Tag>CORE ARCHITECTURE</Tag></div>
            <RevealText className="mt-5 text-4xl md:text-5xl lg:text-6xl font-mono text-white font-light tracking-tight leading-[1.05]">
              {"Everything you need\nto deploy verified agents."}
            </RevealText>
          </div>

          <div className="grid grid-cols-12 gap-4" onMouseMove={handleMouse}>
            {/* Big feature card */}
            <BentoCard className="col-span-12 p-8 md:p-10 min-h-[260px] flex flex-col justify-between relative overflow-hidden" delay={0}>
              <img
                src="/images/arc.png"
                alt="Architecture Arc"
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover opacity-35"
                style={{ objectPosition: "center 70%" }}
              />
              <div className="absolute inset-0" style={{
                background: "linear-gradient(to bottom, rgba(12,14,20,0.4) 0%, rgba(12,14,20,0.95) 85%)",
              }} />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl border border-emerald-500/30 bg-emerald-950/40 flex items-center justify-center mb-6 text-emerald-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><path d="m4.93 4.93 2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/></svg>
                </div>
                <h3 className="text-2xl font-mono text-white font-medium mb-3">Visual Agent Builder & Graph Editor</h3>
                <p className="text-sm font-sans text-white/60 leading-relaxed max-w-lg">
                  Drag, connect, and configure multi-agent pipelines with deterministic routing. Connect BART-base LoRA summarization, cross-attention extraction, and premise alignment with zero glue code.
                </p>
              </div>
            </BentoCard>

            {/* Bottom 3 bento cards */}
            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[220px]" delay={120}>
              <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center mb-5 text-emerald-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <h3 className="text-lg font-mono text-white font-medium mb-2">Real-time Telemetry</h3>
              <p className="text-sm text-white/50 leading-relaxed">Trace every premise token. Debug with attention heatmaps, token entropy, and live NLI entailment scores.</p>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[220px]" delay={160}>
              <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center mb-5 text-emerald-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 10h8M8 14h5"/></svg>
              </div>
              <h3 className="text-lg font-mono text-white font-medium mb-2">Memory & Context Index</h3>
              <p className="text-sm text-white/50 leading-relaxed">Source token indexing with byte-level alignment. Sentence boundaries preserved across multi-paragraph documents.</p>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[220px]" delay={200}>
              <div className="w-10 h-10 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center mb-5 text-emerald-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h3 className="text-lg font-mono text-white font-medium mb-2">Guardrails & Constraints</h3>
              <p className="text-sm text-white/50 leading-relaxed">Scale mismatch protection ($M vs $B), numeric discrepancy checks, and automated sentence pruning fallbacks.</p>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── AGENT TYPES (Stacking Cards) ─────────────────────────────────── */}
      <section id="agents" className="py-28 px-6 md:px-12 lg:px-20 border-t border-white/10 cyber-grid relative">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16">
            <div>
              <PixelIcon type="agents" size={40} />
              <div className="mt-4"><Tag>SPECIALIZED AGENT ARCHETYPES</Tag></div>
              <RevealText className="mt-5 text-4xl md:text-5xl font-mono text-white font-light tracking-tight leading-[1.05]">
                {"Plug-and-play agents\nready to deploy."}
              </RevealText>
            </div>
            <p className="text-sm font-sans text-white/50 leading-relaxed max-w-sm">
              Deploy pre-trained autonomous agents or compose customized verification routines. Fully observable, audited, and deterministic.
            </p>
          </div>

          <StackingAgentCards />
        </div>
      </section>

      {/* ── WORKFLOW ──────────────────────────────────────────────────────── */}
      <section id="workflow" className="py-28 px-6 md:px-12 lg:px-20 border-t border-white/10 cyber-grid relative overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <PixelIcon type="workflow" size={40} />
            <div className="mt-4"><Tag>DETERMINISTIC PIPELINE</Tag></div>
            <RevealText className="mt-5 text-4xl md:text-5xl font-mono text-white font-light tracking-tight leading-[1.05]">
              {"From document ingest to verified\nsummary in four steps."}
            </RevealText>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4" onMouseMove={handleMouse}>
            {[
              { n: "01", title: "Ingest & Index", desc: "Build source token index with sentence boundaries and token span alignments.", delay: 0,   img: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/define-5aafAmGBrxZpOqJ3XLHY3n3qzC2I5K.png" },
              { n: "02", title: "Generate Beams", desc: "Sample N beam candidates using BART LoRA with sequence log-probability tracking.", delay: 80,  img: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/compose-5RT5VR4f1Y3GoFmovqTKLTG4UXp3g2.png" },
              { n: "03", title: "Extract & NLI",  desc: "Cross-attention pulls top-k premise lines; NLI classifies entailment vs contradiction.", delay: 140, img: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/test-zm8guZwxJHtwWsJ7XO4B0CF7GzlNK8.png" },
              { n: "04", title: "Rerank & Prune", desc: "Hard constraints filter errors; fallback prunes unverified claims before final verdict.", delay: 200, img: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/deploy-an8fgHSLzniojkcmRyGGIFQUJF9T5J.png" },
            ].map((step) => (
              <BentoCard key={step.n} className="relative overflow-hidden flex flex-col min-h-[340px]" delay={step.delay}>
                <div className="absolute inset-x-0 top-0 h-48 pointer-events-none opacity-50">
                  <img
                    src={step.img}
                    alt={step.title}
                    className="w-full h-full object-cover object-top"
                    style={{
                      maskImage: "linear-gradient(to bottom, black 0%, black 20%, transparent 85%)",
                      WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 20%, transparent 85%)",
                    }}
                  />
                </div>
                <div className="relative z-10 p-6">
                  <span className="font-mono text-xs text-emerald-400 tracking-widest block font-bold">{step.n} // STEP</span>
                </div>
                <div className="relative z-10 px-6 pb-6 mt-auto pt-16">
                  <h3 className="text-xl font-mono text-white font-medium mb-2">{step.title}</h3>
                  <p className="text-xs text-white/50 leading-relaxed font-sans">{step.desc}</p>
                </div>
              </BentoCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTEGRATIONS ──────────────────────────────────────────────────── */}
      <section id="integrations" className="py-28 px-6 md:px-12 lg:px-20 border-t border-white/10 cyber-grid relative">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16">
            <div>
              <PixelIcon type="integrations" size={40} />
              <div className="mt-4"><Tag>SYSTEM INTEGRATIONS</Tag></div>
              <RevealText className="mt-5 text-4xl md:text-5xl font-mono text-white font-light tracking-tight leading-[1.05]">
                {"Connect any tool.\nVerify any workflow."}
              </RevealText>
            </div>
            <p className="text-sm font-sans text-white/50 leading-relaxed max-w-sm">
              200+ native connectors. From internal vector stores to live Slack alerts and Python ML services.
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden border border-white/10 flex flex-col md:block md:relative bg-[#090b10] shadow-[0_0_40px_rgba(0,0,0,0.8)]" onMouseMove={handleMouse}>
            <div className="relative w-full h-[280px] md:h-[480px] shrink-0">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Org%20Arc%20-%20Upscaled-Sk90jShfu7nltLnhoQbaMJC1YaQKuU.png"
                alt="Agent orchestration architecture"
                className="absolute inset-0 w-full h-full object-cover object-center opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#090b10] via-transparent to-transparent" />
            </div>

            {/* Overlaid glass code cards */}
            <div className="flex flex-col gap-3 p-4 md:absolute md:bottom-6 md:right-6 md:p-0 md:w-80">
              <div
                className="rounded-xl border border-white/15 p-5 bg-[#0a0d14]/90 backdrop-blur-xl shadow-2xl"
              >
                <Tag>TOOL INTERFACE</Tag>
                <h3 className="mt-3 text-base font-mono text-white font-medium mb-1">Define Custom Verifiers</h3>
                <p className="text-xs text-white/50 leading-relaxed mb-3">Expose any Python or TS function as a verified tool with deterministic contracts.</p>
                <div className="bg-[#05070a] rounded-lg border border-white/10 p-3 font-mono text-[11px] text-gray-300 leading-relaxed">
                  <span className="text-gray-500">// tool definition</span><br />
                  <span className="text-cyan-400">defineTool</span>{"({"}<br />
                  {"  "}<span className="text-amber-300">name</span>: <span className="text-emerald-400">&apos;checkFact&apos;</span>,<br />
                  {"  "}<span className="text-amber-300">run</span>: <span className="text-purple-400">async (claim) </span>={">"}<br />
                  {"    "}<span className="text-cyan-400">verifier</span>.verify(claim)<br />
                  {"})"}
                </div>
              </div>

              <div
                className="rounded-xl border border-white/15 p-5 bg-[#0a0d14]/90 backdrop-blur-xl shadow-2xl"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#4ade80]" />
                  <span className="text-xs font-mono text-emerald-400 tracking-widest font-semibold">LIVE WEBSOCKET STREAM</span>
                </div>
                <p className="text-xs font-sans text-white/50">Bidirectional token streaming with attention coordinates directly to client frontend.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECURITY & OBSERVABILITY ──────────────────────────────────────── */}
      <section id="security" className="py-28 px-6 md:px-12 lg:px-20 border-t border-white/10 cyber-grid relative">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <PixelIcon type="platform" size={40} />
            <div className="mt-4"><Tag>ENTERPRISE COMPLIANCE</Tag></div>
            <RevealText className="mt-5 text-4xl md:text-5xl font-mono text-white font-light tracking-tight leading-[1.05]">
              {"Deterministic auditability\nfrom day one."}
            </RevealText>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left side */}
            <div className="space-y-6">
              <p className="text-sm font-sans text-white/60 leading-relaxed">
                Every premise extraction is indexed, every token probability logged, and every fact check verified. Built for legal and financial compliance without compromise.
              </p>

              <div className="space-y-4">
                {[
                  { label: "SOC 2 Type II Certified", desc: "Independently audited security controls and zero-leakage sandbox execution" },
                  { label: "Full Decision Lineage", desc: "Every summary claim is tied directly to source sentence indices" },
                  { label: "Deterministic Fallbacks", desc: "Auto-pruning or extractive backup when entailment falls below threshold" },
                ].map((item) => (
                  <div key={item.label} className="flex gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                    <div className="w-1 bg-emerald-400 rounded-full shrink-0 shadow-[0_0_8px_#4ade80]" />
                    <div>
                      <h3 className="text-sm font-mono text-white font-medium mb-1">{item.label}</h3>
                      <p className="text-xs font-sans text-white/50 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex flex-wrap gap-2">
                {["SOC 2 TYPE II", "GDPR COMPLIANT", "HIPAA READY", "ISO 27001", "FP16 LOCAL VRAM"].map((badge) => (
                  <span key={badge} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-mono text-white/60 bg-white/[0.04] border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            {/* Right side — live audit log */}
            <BentoCard className="p-6 bg-[#0a0c10] border-white/10 shadow-2xl" delay={0}>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <span className="text-xs font-mono text-white/50 tracking-widest uppercase">Live Audit Trail</span>
                <span className="flex items-center gap-2 text-[10px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  REAL-TIME EMIT
                </span>
              </div>
              <div className="space-y-2">
                {[
                  { time: "12:34:21.042", action: "nli_premise_verified", status: "entailed", score: "0.982" },
                  { time: "12:34:18.891", action: "scale_mismatch_check", status: "passed", score: "valid" },
                  { time: "12:34:15.630", action: "cross_attention_top_k", status: "extracted", score: "k=3" },
                  { time: "12:34:12.412", action: "beam_candidate_rerank", status: "winner_#1", score: "best" },
                  { time: "12:34:09.118", action: "vram_cleanup_cycle", status: "cuda_empty", score: "4.1GB" },
                ].map((log, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors border border-white/[0.04] group cursor-pointer"
                  >
                    <span className="text-[10px] text-white/35 font-mono min-w-[75px]">{log.time}</span>
                    <span className="text-[11px] text-white/80 font-mono flex-1">{log.action}</span>
                    <span className="text-[10px] text-emerald-400 font-mono px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30">{log.score}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#4ade80]" />
                  </div>
                ))}
              </div>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── DEVELOPER EXPERIENCE ──────────────────────────────────────────── */}
      <DevExSection />

      {/* ── MARQUEE CAPABILITIES ──────────────────────────────────────────── */}
      <section className="py-0 border-t border-white/10 overflow-hidden select-none bg-[#07090d]">
        <div className="flex border-b border-white/10" style={{ animation: "marqueeLeft 28s linear infinite" }}>
          {[...Array(3)].map((_, rep) => (
            <div key={rep} className="flex shrink-0">
              {["10-K Earnings Audit", "BART LoRA Generation", "Cross-Attention Heatmaps", "NLI Entailment Checks", "Scale Mismatch Detection", "Token Span Indexing", "ROUGE vs Fact Benchmarks", "Deterministic Pruning"].map((cap) => (
                <div key={cap} className="flex items-center gap-6 px-10 py-4 border-r border-white/10 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#4ade80] shrink-0" />
                  <span className="text-xs font-mono text-white/70 whitespace-nowrap tracking-wider">{cap}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex" style={{ animation: "marqueeRight 22s linear infinite" }}>
          {[...Array(3)].map((_, rep) => (
            <div key={rep} className="flex shrink-0">
              {["Legal Contract Digests", "Legislative Bill Summaries", "Directional Conflict Flags", "Fiduciary Audit Reviews", "Entity Extraction Precision", "Sub-60s Local GPU Inference", "WebSocket Event Streaming", "Zero-Hallucination Guardrails"].map((cap) => (
                <div key={cap} className="flex items-center gap-6 px-10 py-4 border-r border-white/10 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  <span className="text-xs font-mono text-white/50 whitespace-nowrap tracking-wider">{cap}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── LIVE AGENTS ───────────────────────────────────────────────────── */}
      <section id="live" className="py-28 px-6 md:px-12 lg:px-20 border-t border-white/10 cyber-grid relative">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <PixelIcon type="agents" size={40} />
              <div className="mt-4"><Tag>GLOBAL FLEET TELEMETRY</Tag></div>
              <RevealText className="mt-5 text-4xl md:text-5xl lg:text-6xl font-mono text-white font-light tracking-tight leading-[1.05]">
                {"Agents working\n24 / 7, autonomously."}
              </RevealText>
              <p className="mt-6 text-sm font-sans text-white/50 leading-relaxed max-w-md">
                Around the clock, thousands of verification agents process documents, inspect premise tokens, and execute deterministic guardrails without human fatigue.
              </p>
              <div className="mt-10 flex items-end gap-3">
                <LiveAgentCounter />
                <span className="text-white/40 font-mono text-xs mb-2 tracking-widest uppercase">agents active globally</span>
              </div>
            </div>
            <div className="relative">
              <LiveAgentFeed />
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-28 px-6 md:px-12 lg:px-20 border-t border-white/10 cyber-grid relative">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 flex flex-col items-center">
            <PixelIcon type="pricing" size={40} />
            <div className="mt-4"><Tag>INFRASTRUCTURE TIERS</Tag></div>
            <RevealText className="mt-5 text-4xl md:text-5xl font-mono text-white font-light tracking-tight leading-[1.05]">
              {"Pay as your agent fleet scales."}
            </RevealText>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" onMouseMove={handleMouse}>
            {[
              {
                name: "DEVELOPER // SANDBOX",
                price: "$0",
                sub: "Local testing & research",
                features: ["5 concurrent agents", "10,000 token index lines", "Offline fact tests", "Local fp16 GPU support", "Community Discord"],
                delay: 0,
              },
              {
                name: "BUILDER // FLEET",
                price: "$49",
                period: "/mo",
                sub: "For teams shipping to prod",
                features: ["50 concurrent agents", "Full NLI cross-attention", "Automated sentence pruning", "WebSocket stream API", "Priority GPU fleet", "Custom fact schemas"],
                highlight: true,
                delay: 80,
              },
              {
                name: "ENTERPRISE // AIR-GAPPED",
                price: "Custom",
                sub: "Dedicated enterprise clusters",
                features: ["Unlimited agent fleet", "On-prem air-gapped deploy", "SOC 2 & HIPAA SLAs", "Custom fine-tuned adapters", "24/7 dedicated support", "Audit compliance sign-off"],
                delay: 140,
              },
            ].map((plan) => (
              <BentoCard
                key={plan.name}
                className={`p-8 flex flex-col ${plan.highlight ? "border-emerald-500/50 bg-[#0d121c] shadow-[0_0_30px_rgba(74,222,128,0.18)]" : ""}`}
                delay={plan.delay}
              >
                <div className="mb-8">
                  <div className="font-mono text-[11px] tracking-widest text-emerald-400 mb-3">{plan.name}</div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-4xl font-mono font-bold text-white">{plan.price}</span>
                    {plan.period && <span className="text-white/40 text-sm font-mono">{plan.period}</span>}
                  </div>
                  <p className="text-xs font-sans text-white/50">{plan.sub}</p>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-3 text-xs font-mono text-white/70">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#4ade80] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button className={`w-full py-3 rounded-xl text-xs font-mono tracking-widest transition-all duration-200 cursor-pointer ${
                  plan.highlight
                    ? "bg-emerald-400 text-black font-bold hover:bg-emerald-300 shadow-[0_0_15px_rgba(74,222,128,0.4)]"
                    : "border border-white/10 text-white/70 hover:border-emerald-500/40 hover:text-white hover:bg-white/[0.04]"
                }`}>
                  {plan.name.includes("ENTERPRISE") ? "SCHEDULE AUDIT" : "GET STARTED"}
                </button>
              </BentoCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="relative py-32 px-6 md:px-12 lg:px-20 border-t border-white/10 overflow-hidden cyber-grid">
        <img
          src="/images/footer.png"
          alt=""
          aria-hidden="true"
          className="absolute bottom-0 left-0 w-full object-cover object-bottom pointer-events-none select-none opacity-30 mix-blend-screen"
        />
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent" />

        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-[10px] font-mono tracking-widest text-emerald-400 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            READY FOR DEPLOYMENT
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-mono text-white font-light tracking-tight leading-[1.05] mb-6">
            Start deploying your<br /><span className="text-emerald-400 font-semibold">agent fleet.</span>
          </h2>
          <p className="text-sm font-sans text-white/50 leading-relaxed mb-10 max-w-lg mx-auto">
            Join engineering teams deploying verified autonomous AI agents with cross-attention auditing and zero hallucinations.
          </p>

          {!submitted ? (
            <form
              onSubmit={e => { e.preventDefault(); if (email) setSubmitted(true) }}
              className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto"
            >
              <input
                type="email"
                placeholder="developer@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="flex-1 bg-[#0b0e14] border border-white/15 rounded-xl px-4 py-3 text-sm font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-400 transition-colors shadow-inner"
              />
              <button
                type="submit"
                className="px-8 py-3 bg-emerald-400 text-black text-xs font-mono font-bold rounded-xl hover:bg-emerald-300 transition-all tracking-widest shadow-[0_0_15px_rgba(74,222,128,0.4)] cursor-pointer"
              >
                REQUEST ACCESS
              </button>
            </form>
          ) : (
            <div className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 text-sm font-mono shadow-[0_0_20px_rgba(74,222,128,0.2)]">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {"Access credentials verified. Check your inbox."}
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="py-12 px-6 md:px-12 lg:px-20 border-t border-white/10 bg-[#040507]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#4ade80]" />
            <span className="font-mono text-xs tracking-[0.25em] text-white">AGENTIC // EQUISUMM</span>
          </div>

          {/* Nav sections */}
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 font-mono text-xs">
            {[
              { label: "Platform",     href: "#platform" },
              { label: "Agents",       href: "#agents" },
              { label: "Workflow",     href: "#workflow" },
              { label: "Integrations", href: "#integrations" },
              { label: "Security",     href: "#security" },
              { label: "Pricing",      href: "#pricing" },
            ].map(l => (
              <a key={l.label} href={l.href} className="text-white/40 hover:text-emerald-400 transition-colors tracking-wider">{l.label}</a>
            ))}
          </div>

          {/* Legal / docs links */}
          <div className="flex items-center gap-6 font-mono text-xs">
            {[
              { label: "Privacy", href: "#" },
              { label: "Docs",    href: "#" },
              { label: "GitHub",  href: "https://github.com/Quarto205/equiisum.git" },
            ].map(l => (
              <a key={l.label} href={l.href} className="text-white/30 hover:text-white/70 transition-colors tracking-wider">{l.label}</a>
            ))}
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono text-white/30">
          <span>© 2026 Agentic & EquiSumm Core. All rights reserved.</span>
          <span className="text-[10px] text-emerald-400/80">LATENCY: 22ms // STATUS: NOMINAL</span>
        </div>
      </footer>
    </div>
  )
}
