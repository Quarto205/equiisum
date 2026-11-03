"use client"

import { useState, useEffect } from "react"

const STEPS = [
  {
    num: "01",
    title: "Install SDK",
    desc: "Single-command developer bootstrap",
    file: "bash: terminal",
    lang: "bash",
    code: [
      { type: "comment", text: "# Install the EquiSumm / Agentic SDK" },
      { type: "command", text: "npm install @agentic/sdk @equisumm/core" },
      { type: "gap" },
      { type: "comment", text: "# Initialize verification runtime and config" },
      { type: "command", text: "npx agentic init --preset=cyberpunk" },
      { type: "gap" },
      { type: "output", text: "✓ Pipeline initialized [fp16 mode active]" },
      { type: "output", text: "✓ NLI cross-attention models indexed" },
      { type: "output", text: "✓ Runtime ready for autonomous execution" },
    ],
  },
  {
    num: "02",
    title: "Define Agent",
    desc: "Typed verification & reasoning pipeline",
    file: "agents/verifier.ts",
    lang: "typescript",
    code: [
      { type: "comment", text: "// agents/verifier.ts" },
      { type: "keyword", text: "import", after: " { Agent, Tool } ", keyword2: "from", string: " '@agentic/sdk'" },
      { type: "keyword", text: "import", after: " { NLIVerifier } ", keyword2: "from", string: " '@equisumm/core'" },
      { type: "gap" },
      { type: "keyword", text: "const", after: " nliVerify ", keyword2: "=", keyword3: " new ", fn: "Tool", args: "('nli-verify', async (doc) => ...)" },
      { type: "gap" },
      { type: "keyword", text: "export const", after: " verifier ", keyword2: "=", keyword3: " new ", fn: "Agent", args: "({" },
      { type: "prop", key: "  name", val: "'equisumm-analyst'" },
      { type: "prop", key: "  model", val: "'bart-lora-r16'" },
      { type: "prop", key: "  tools", val: "[nliVerify]" },
      { type: "prop", key: "  deterministic", val: "true" },
      { type: "plain", text: "});" },
    ],
  },
  {
    num: "03",
    title: "Add Memory & Constraints",
    desc: "Cross-attention context & fact guardrails",
    file: "agents/guardrails.ts",
    lang: "typescript",
    code: [
      { type: "comment", text: "// Configure deterministic reranking & fact checks" },
      { type: "keyword", text: "import", after: " { FactVerifier } ", keyword2: "from", string: " '@equisumm/verifier'" },
      { type: "gap" },
      { type: "keyword", text: "const", after: " guard ", keyword2: "=", keyword3: " new ", fn: "FactVerifier", args: "({" },
      { type: "prop", key: "  enforceScaleCheck", val: "true" },
      { type: "prop", key: "  entailmentThreshold", val: "0.85" },
      { type: "plain", text: "})" },
      { type: "gap" },
      { type: "comment", text: "// Attach guardrail to agent instance" },
      { type: "plain", text: "verifier.enforce(guard)" },
    ],
  },
  {
    num: "04",
    title: "Deploy Globally",
    desc: "Single-command edge deployment",
    file: "bash: terminal",
    lang: "bash",
    code: [
      { type: "comment", text: "# Deploy to Agentic Edge Fleet" },
      { type: "command", text: "agentic deploy --env=production --verify" },
      { type: "gap" },
      { type: "output", text: "  Synthesizing container matrix..." },
      { type: "output", text: "  Validating zero-leakage sandbox..." },
      { type: "output", text: "  Distributing to 180+ edge regions..." },
      { type: "gap" },
      { type: "success", text: "✓ agent active: https://agents.agentic.dev/v1" },
      { type: "url", text: "  → latency: 28ms | throughput: 12,000 req/sec" },
    ],
  },
]

function CodeLine({ line }: { line: (typeof STEPS)[0]["code"][0] }) {
  if (line.type === "gap") return <div className="h-2" />
  if (line.type === "comment") return <div className="text-gray-500 font-mono italic">{line.text}</div>
  if (line.type === "output") return <div className="text-gray-400 font-mono">{line.text}</div>
  if (line.type === "success") return <div className="text-emerald-400 font-mono font-medium drop-shadow-[0_0_6px_rgba(74,222,128,0.4)]">{line.text}</div>
  if (line.type === "url") return <div className="text-cyan-400 font-mono underline decoration-cyan-500/40">{line.text}</div>
  if (line.type === "command") return (
    <div className="font-mono">
      <span className="text-emerald-400 font-bold">$ </span>
      <span className="text-white font-medium">{line.text}</span>
    </div>
  )
  if (line.type === "plain") return <div className="text-gray-300 font-mono">{line.text}</div>
  if (line.type === "prop") return (
    <div className="font-mono">
      <span className="text-sky-400">{line.key}</span>
      <span className="text-gray-400">: </span>
      <span className="text-emerald-300">{line.val}</span>
      <span className="text-gray-400">,</span>
    </div>
  )
  if (line.type === "keyword") return (
    <div className="font-mono">
      <span className="text-purple-400 font-semibold">{line.text}</span>
      <span className="text-gray-200">{line.after}</span>
      <span className="text-purple-400 font-semibold">{line.keyword2}</span>
      {line.keyword3 && <span className="text-purple-400 font-semibold">{line.keyword3}</span>}
      {line.fn && <span className="text-amber-400 font-semibold">{line.fn}</span>}
      {line.args && <span className="text-gray-300">{line.args}</span>}
      {line.string && <span className="text-emerald-300">{line.string}</span>}
    </div>
  )
  return null
}

export function DevExSection() {
  const [active, setActive] = useState(0)
  const [visible, setVisible] = useState(true)

  function selectStep(i: number) {
    if (i === active) return
    setVisible(false)
    setTimeout(() => {
      setActive(i)
      setVisible(true)
    }, 150)
  }

  // Auto-advance
  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setActive(prev => (prev + 1) % STEPS.length)
        setVisible(true)
      }, 150)
    }, 4500)
    return () => clearInterval(t)
  }, [])

  const step = STEPS[active]

  return (
    <section id="devex" className="py-24 px-6 md:px-12 lg:px-20 border-t border-white/10 cyber-grid relative">
      <div className="max-w-6xl mx-auto">
        <div className="mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-[10px] font-mono tracking-widest text-emerald-400 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Developer Experience
          </div>
          <h2 className="mt-4 text-3xl md:text-5xl font-mono text-white font-light tracking-tight leading-[1.1]">
            Engineered for developers.<br />
            <span className="text-emerald-400 font-normal">Deterministic by design.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          {/* Left — 4 clickable step buttons */}
          <div className="flex flex-col gap-3">
            {STEPS.map((s, i) => (
              <button
                key={s.num}
                onClick={() => selectStep(i)}
                className="flex-1 text-left rounded-xl border transition-all duration-200 p-5 group cursor-pointer"
                style={{
                  background: active === i ? "rgba(74, 222, 128, 0.08)" : "rgba(12, 15, 20, 0.65)",
                  borderColor: active === i ? "rgba(74, 222, 128, 0.4)" : "rgba(255, 255, 255, 0.08)",
                  boxShadow: active === i ? "0 0 15px rgba(74, 222, 128, 0.12)" : "none",
                }}
              >
                <div className="flex gap-4 items-start">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-xs font-mono font-bold shrink-0 transition-colors duration-200"
                    style={{
                      background: active === i ? "rgba(74, 222, 128, 0.2)" : "rgba(255, 255, 255, 0.05)",
                      color: active === i ? "#4ade80" : "rgba(255, 255, 255, 0.4)",
                    }}
                  >
                    {s.num}
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-sm font-mono font-medium transition-colors duration-200"
                      style={{ color: active === i ? "#ffffff" : "rgba(255, 255, 255, 0.7)" }}
                    >
                      {s.title}
                    </p>
                    <p className="text-xs font-sans mt-0.5" style={{ color: "rgba(255, 255, 255, 0.4)" }}>{s.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Right — terminal code panel */}
          <div
            className="lg:col-span-2 rounded-2xl border border-white/10 p-6 flex flex-col bg-[#090b10] shadow-[0_0_30px_rgba(0,0,0,0.8)] relative overflow-hidden"
            style={{ minHeight: "360px" }}
          >
            {/* Window title bar */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                <span className="ml-2 font-mono text-[11px] text-white/50 tracking-wider uppercase">
                  {step.file}
                </span>
              </div>
              <div className="flex gap-1.5">
                {[0, 1, 2, 3].map(d => (
                  <div
                    key={d}
                    className="w-2 h-2 rounded-full transition-all duration-300"
                    style={{
                      background: d === active ? "#4ade80" : "rgba(255, 255, 255, 0.15)",
                      boxShadow: d === active ? "0 0 6px #4ade80" : "none",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Code block body */}
            <div className="flex-1 rounded-xl p-5 overflow-x-auto bg-[#040507] border border-white/[0.06]">
              <div
                className="font-mono text-[12px] leading-relaxed"
                style={{
                  opacity: visible ? 1 : 0,
                  filter: visible ? "blur(0px)" : "blur(4px)",
                  transform: visible ? "translateY(0)" : "translateY(4px)",
                  transition: "opacity 180ms ease, filter 180ms ease, transform 180ms ease",
                }}
              >
                {step.code.map((line, i) => (
                  <CodeLine key={i} line={line} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
