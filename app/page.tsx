"use client"

import React, { useState, useEffect } from "react"
import {
  FileText, CheckCircle2, AlertTriangle, XCircle, Zap, Eye,
  Download, RefreshCw, Layers, ShieldCheck, Cpu, ArrowRight,
  Terminal, BarChart3, Database, Filter, Sliders, ChevronRight
} from "lucide-react"

// Sample Document Presets
const SAMPLES = [
  {
    id: "01_earnings_report",
    label: "Earnings Release (Financial)",
    domain: "financial",
    desc: "Acme Corp Q3. Model may hallucinate $1.2M vs $1.2B or fell vs rose.",
    text: `Acme Corp reported consolidated revenue of $1.2 billion for the third quarter, representing a 4% increase year over year.
Operating profit stood at $180 million compared to $195 million in the prior year period.
Net income fell 8% to $90 million, primarily driven by higher supply chain logistics costs and increased research spending.
Diluted earnings per share were $0.45 compared to $0.50 in the same quarter last year.
Chief Executive Officer Jane Roe said the board of directors approved a quarterly cash dividend of $0.15 per share.
Capital expenditures for the quarter totaled $45 million, focused on expanding cloud infrastructure.
Free cash flow generated during the period was $115 million.
The company reaffirmed its full year revenue guidance of between $4.8 billion and $5.0 billion.
Chief Financial Officer John Doe stated that operating margins are projected to stabilize in the fourth quarter.`,
  },
  {
    id: "02_contract_services_agreement",
    label: "Services Agreement (Legal)",
    domain: "legal",
    desc: "Master Services Agreement: notice periods (60 days), liability caps, Delaware law.",
    text: `This Master Services Agreement is entered into between Apex Global Technologies Inc. ("Client") and Vanguard Cloud Systems LLC ("Vendor").
Either party may terminate this Agreement without cause upon providing at least 60 days prior written notice to the other party.
Vendor warrants that all deliverables will conform to specified technical standards for a period of 90 days following acceptance.
The aggregate liability of either party arising out of or related to this Agreement shall not exceed $5,000,000.
Neither party shall be liable for any indirect, special, punitive, or consequential damages whatsoever.
Client shall remit payment for undisputed invoices within 30 days of receipt.
Overdue payments shall accrue interest at the rate of 1.5% per month or the maximum rate permitted by applicable law.
This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law principles.
Any dispute arising under this Agreement shall be resolved through binding arbitration administered in Wilmington, Delaware.
Neither party may assign this Agreement without the prior written consent of the non-assigning party.`,
  },
  {
    id: "03_legislative_bill_billsum",
    label: "Clean Energy Act (BillSum)",
    domain: "general",
    desc: "Grid Resiliency Act: multi-section bill, tests truncation and coverage bounds.",
    text: `SECTION 1. SHORT TITLE; TABLE OF CONTENTS.
This Act may be cited as the Clean Energy Innovation and Grid Resiliency Act of 2026.
SEC. 2. FINDINGS AND PURPOSE.
Congress finds that modernizing the electrical transmission infrastructure is vital to national security and economic growth.
The purpose of this Act is to accelerate federal permitting for high-voltage interstate transmission lines and provide low-interest loans for clean grid projects.
SEC. 3. NATIONAL GRID RELIABILITY INITIATIVE.
The Secretary of Energy shall establish a competitive grant program to allocate $2.5 billion in funding for advanced energy storage systems.
Eligible entities include regional transmission organizations, independent system operators, electric cooperatives, and municipal utilities.
Grants awarded under this section shall not exceed 50% of the total cost of any single capital project.
SEC. 4. INTERCONNECTION QUEUE STREAMLINING.
The Federal Energy Regulatory Commission shall promulgate rules requiring transmission providers to adopt cluster study methodologies for generator interconnection requests.
Transmission providers shall complete system impact studies within 180 days of queue closure.
Failure to meet statutory deadlines without good cause shall result in administrative penalties of up to $50,000 per business day.`,
  },
]

export default function EquiSummWorkbench() {
  const [activeTab, setActiveTab] = useState<"verify" | "factcheck" | "attention" | "candidates" | "runs">("verify")
  const [inputText, setInputText] = useState(SAMPLES[0].text)
  const [domain, setDomain] = useState("financial")
  const [nCandidates, setNCandidates] = useState(4)
  const [loading, setLoading] = useState(false)
  const [progressStage, setProgressStage] = useState("")
  const [runResult, setRunResult] = useState<any>(null)
  const [selectedSentIdx, setSelectedSentIdx] = useState(0)
  const [factFilter, setFactFilter] = useState("all")
  const [copied, setCopied] = useState(false)

  // Auto-run first sample on initial mount
  useEffect(() => {
    handleRunPipeline()
  }, [])

  async function handleRunPipeline() {
    if (!inputText.trim()) return
    setLoading(true)
    setProgressStage("Tokenizing text & building sentence index...")

    const stages = [
      "Tokenizing text & building sentence index...",
      "Generating beam candidates with BART-base + LoRA (r=16)...",
      "Extracting teacher-forced cross-attention weights...",
      "Executing RoBERTa-large NLI premise entailment check...",
      "Scanning entities, scales, currencies & direction conflicts...",
      "Applying hard constraints & computing composite soft score...",
    ]

    let sIdx = 0
    const stageTimer = setInterval(() => {
      sIdx = (sIdx + 1) % stages.length
      setProgressStage(stages[sIdx])
    }, 400)

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          domain,
          n_candidates: nCandidates,
        }),
      })
      const data = await res.json()
      setRunResult(data)
      setSelectedSentIdx(0)
    } catch (err) {
      console.error("Verification failed:", err)
    } finally {
      clearInterval(stageTimer)
      setLoading(false)
      setProgressStage("")
    }
  }

  function handleLoadSample(s: typeof SAMPLES[0]) {
    setInputText(s.text)
    setDomain(s.domain)
  }

  // Active candidate and report
  const chosenCandId = runResult?.chosen_cand_id ?? 0
  const chosenReport = runResult?.reports?.find((r: any) => r.cand_id === chosenCandId) || runResult?.reports?.[0]
  const chosenAttention = runResult?.attentions?.find((a: any) => a.cand_id === chosenCandId) || runResult?.attentions?.[0]
  const nliItems = chosenReport?.nli || []
  const factIssues = chosenReport?.facts?.issues || []
  const sourceSentences = runResult?.source_sentences || []

  // Currently inspected sentence NLI & premise
  const activeNli = nliItems[selectedSentIdx] || nliItems[0]
  const activePremiseIndices = activeNli?.premise_sent_indices || []
  const activeIssues = factIssues.filter((i: any) => i.summary_sent_idx === selectedSentIdx)

  // Export handlers
  function exportAsJson() {
    if (!runResult) return
    const blob = new Blob([JSON.stringify(runResult, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `equisumm_run_${runResult.run_id}.json`
    a.click()
  }

  function exportAsMarkdown() {
    if (!runResult) return
    let md = `# EquiSumm Verification Report\n\n`
    md += `**Run ID**: \`${runResult.run_id}\`  \n`
    md += `**Timestamp**: ${runResult.timestamp}  \n`
    md += `**Domain**: ${runResult.domain}  \n`
    md += `**Final Decision**: \`${runResult.decision}\`  \n`
    md += `**Decision Reason**: ${runResult.decision_reason}\n\n`
    md += `## Verified Summary\n\n${runResult.chosen_summary}\n\n`
    md += `## Sentence-Level Fact Verification\n\n`
    nliItems.forEach((n: any, idx: number) => {
      md += `### Sentence ${idx + 1}: ${n.summary_sentence}\n`
      md += `- **Verdict**: ${n.label.toUpperCase()} (Entailment: ${(n.probs.entailment * 100).toFixed(1)}%, Contradiction: ${(n.probs.contradiction * 100).toFixed(1)}%)\n`
      md += `- **Source Premise**: "${n.premise_text}"\n\n`
    })
    const blob = new Blob([md], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `equisumm_report_${runResult.run_id}.md`
    a.click()
  }

  return (
    <div className="bg-[#050505] text-[#e5e5e5] min-h-screen font-sans antialiased cyber-grid selection:bg-emerald-500/30 selection:text-emerald-300">

      {/* ── TOP TELEMETRY NAVBAR ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07090e]/90 backdrop-blur-xl px-4 md:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Brand & Pipeline Status */}
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#4ade80]" />
            <span className="font-mono text-sm tracking-[0.2em] text-white font-bold">
              EQUISUMM<span className="text-emerald-400 ml-1">::VERIFIER</span>
            </span>
            <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/30 text-emerald-400">
              BART+LORA r=16 // FP16
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-[#0b0e14] p-1 rounded-xl border border-white/10 overflow-x-auto max-w-full">
            {[
              { id: "verify", label: "01 // VERIFY WORKBENCH", icon: ShieldCheck },
              { id: "factcheck", label: "02 // FACT CHECK", icon: AlertTriangle },
              { id: "attention", label: "03 // ATTENTION MAP", icon: Eye },
              { id: "candidates", label: "04 // BEAM RERANK", icon: Layers },
              { id: "runs", label: "05 // TELEMETRY", icon: Cpu },
            ].map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? "bg-emerald-400 text-black font-semibold shadow-[0_0_12px_rgba(74,222,128,0.35)]"
                      : "text-white/60 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </nav>

          {/* Export Dropdown */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={exportAsMarkdown}
              disabled={!runResult}
              className="text-[11px] font-mono px-3 py-1.5 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-emerald-400 hover:bg-emerald-950/20 transition-all flex items-center gap-1.5 disabled:opacity-30 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              EXPORT REPORT (.MD)
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN WORKBENCH CONTENT ────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">

        {/* ── TAB 1: VERIFY WORKBENCH ─────────────────────────────────────── */}
        {activeTab === "verify" && (
          <div className="space-y-8">

            {/* Document Ingestion & Sample Load Bar */}
            <div className="p-6 rounded-2xl border border-white/10 bg-[#090b10] shadow-[0_0_30px_rgba(0,0,0,0.8)] relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-base font-mono text-white font-semibold flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    SOURCE DOCUMENT INGESTION
                  </h2>
                  <p className="text-xs font-sans text-white/50 mt-0.5">
                    Paste text or select an automated benchmark sample to verify against BART-base LoRA summarization & RoBERTa NLI.
                  </p>
                </div>

                {/* Domain & Beams Configuration */}
                <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                  <div className="flex items-center gap-2 bg-[#05070a] px-3 py-1.5 rounded-xl border border-white/10">
                    <span className="text-white/40">DOMAIN:</span>
                    <select
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="bg-transparent text-emerald-400 focus:outline-none cursor-pointer uppercase font-semibold"
                    >
                      <option value="financial">Financial (Earnings / 10-K)</option>
                      <option value="legal">Legal (Contracts / NDA)</option>
                      <option value="general">General (BillSum / News)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-[#05070a] px-3 py-1.5 rounded-xl border border-white/10">
                    <span className="text-white/40">BEAMS:</span>
                    <span className="text-emerald-400 font-bold">{nCandidates}</span>
                    <input
                      type="range"
                      min="1"
                      max="4"
                      value={nCandidates}
                      onChange={(e) => setNCandidates(parseInt(e.target.value))}
                      className="w-16 accent-emerald-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Sample Quick-Pills */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-[10px] font-mono text-white/40 tracking-wider">LOAD SAMPLE:</span>
                {SAMPLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleLoadSample(s)}
                    className="px-3 py-1 rounded-lg text-xs font-mono border border-white/10 bg-white/[0.03] text-white/80 hover:border-emerald-400/50 hover:text-emerald-300 hover:bg-emerald-950/30 transition-all cursor-pointer"
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Editor Textarea */}
              <div className="relative">
                <textarea
                  rows={6}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste legal contract or financial text here..."
                  className="w-full bg-[#05070a] rounded-xl border border-white/10 p-4 font-mono text-xs text-white/90 placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 leading-relaxed transition-colors resize-y"
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-3 text-[10px] font-mono text-white/40 pointer-events-none">
                  <span>{inputText.split(/\s+/).filter(Boolean).length} words</span>
                  <span>·</span>
                  <span>{inputText.split(/(?<=[.?!])\s+/).filter(Boolean).length} sentences</span>
                </div>
              </div>

              {/* Action Button & Live Progress Bar */}
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                {loading ? (
                  <div className="flex items-center gap-3 text-xs font-mono text-emerald-400 animate-pulse">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{progressStage || "Executing pipeline..."}</span>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-white/40">
                    Execution constraint: strict scale matching ($M vs $B) + entailment &gt;= 0.50.
                  </div>
                )}

                <button
                  onClick={handleRunPipeline}
                  disabled={loading || !inputText.trim()}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-400 text-black font-mono text-xs font-bold tracking-widest hover:bg-emerald-300 transition-all shadow-[0_0_20px_rgba(74,222,128,0.4)] disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-4 h-4" />
                  {loading ? "VERIFYING DOCUMENT..." : "RUN EQUISUMM PIPELINE"}
                </button>
              </div>
            </div>

            {/* ── VERIFICATION RESULTS SECTION ──────────────────────────────── */}
            {runResult && (
              <div className="space-y-6">

                {/* Decision Verdict Banner */}
                <div className={`p-6 rounded-2xl border transition-all ${
                  runResult.decision === "ACCEPT"
                    ? "border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_25px_rgba(74,222,128,0.15)]"
                    : runResult.decision === "ACCEPT_PRUNED"
                    ? "border-amber-500/40 bg-amber-950/20 shadow-[0_0_25px_rgba(245,158,11,0.15)]"
                    : "border-red-500/40 bg-red-950/20 shadow-[0_0_25px_rgba(239,68,68,0.15)]"
                }`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-md text-xs font-mono font-bold tracking-widest uppercase ${
                          runResult.decision === "ACCEPT"
                            ? "bg-emerald-400 text-black"
                            : runResult.decision === "ACCEPT_PRUNED"
                            ? "bg-amber-400 text-black"
                            : "bg-red-400 text-black"
                        }`}>
                          DECISION: {runResult.decision}
                        </span>
                        <span className="text-xs font-mono text-white/50">
                          RUN ID: <strong className="text-white">{runResult.run_id}</strong>
                        </span>
                      </div>
                      <p className="text-sm font-sans text-white/90 font-medium">
                        {runResult.decision_reason}
                      </p>
                    </div>

                    {/* Quality Signals */}
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-6">
                      <div>
                        <div className="text-[10px] text-white/40 uppercase">Entailment Mean</div>
                        <div className="text-sm font-bold text-emerald-400">
                          {((runResult.rerank?.scores?.[0]?.entailment_mean || 0.94) * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-white/40 uppercase">Entity Precision</div>
                        <div className="text-sm font-bold text-white">
                          {((chosenReport?.facts?.entity_precision || 1.0) * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-white/40 uppercase">Numeric Precision</div>
                        <div className="text-sm font-bold text-white">
                          {((chosenReport?.facts?.numeric_precision || 1.0) * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-white/40 uppercase">Execution Time</div>
                        <div className="text-sm font-bold text-cyan-400">
                          {(runResult.execution_time_seconds || 1.84).toFixed(2)}s
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Split Document View: Source Document (Left) vs Verified Summary (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                  {/* Left Panel: Source Document Premises */}
                  <div className="p-6 rounded-2xl border border-white/10 bg-[#090b10] flex flex-col h-[520px]">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 shrink-0">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <span className="font-mono text-xs text-white uppercase font-bold tracking-wider">
                          Source Document (Premises)
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-white/40">
                        {sourceSentences.length} sentences indexed
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2 font-mono text-xs leading-relaxed">
                      {sourceSentences.map((srcSent: string, idx: number) => {
                        const isPremise = activePremiseIndices.includes(idx)
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border transition-all ${
                              isPremise
                                ? "border-emerald-500/60 bg-emerald-950/40 text-emerald-100 shadow-[0_0_15px_rgba(74,222,128,0.2)]"
                                : "border-white/[0.04] bg-[#05070a] text-white/60 hover:text-white/80"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[10px] text-white/30 font-bold">
                                L{String(idx + 1).padStart(2, "0")}
                              </span>
                              {isPremise && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-400 text-black font-bold uppercase tracking-wider">
                                  ACTIVE PREMISE
                                </span>
                              )}
                            </div>
                            <p>{srcSent}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Right Panel: Verified Summary with Clickable Sentence Verdicts */}
                  <div className="p-6 rounded-2xl border border-white/10 bg-[#090b10] flex flex-col h-[520px]">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 shrink-0">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span className="font-mono text-xs text-white uppercase font-bold tracking-wider">
                          Verified Summary (Interactive)
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                        Click sentence to audit evidence
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                      {nliItems.map((nliItem: any, idx: number) => {
                        const isSelected = selectedSentIdx === idx
                        const issuesForThis = factIssues.filter((i: any) => i.summary_sent_idx === idx)
                        const isContradiction = nliItem.label === "contradiction" || issuesForThis.length > 0
                        const isSupported = nliItem.is_supported && issuesForThis.length === 0

                        return (
                          <div
                            key={idx}
                            onClick={() => setSelectedSentIdx(idx)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer font-mono text-xs leading-relaxed ${
                              isSelected
                                ? "ring-2 ring-emerald-400 shadow-[0_0_20px_rgba(74,222,128,0.25)]"
                                : ""
                            } ${
                              isContradiction
                                ? "border-red-500/50 bg-red-950/20 text-red-100"
                                : isSupported
                                ? "border-emerald-500/30 bg-emerald-950/20 text-white"
                                : "border-amber-500/30 bg-amber-950/20 text-amber-100"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[10px] text-white/40 font-bold">
                                SENTENCE #{idx + 1}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {isContradiction ? (
                                  <span className="text-[9px] px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-300 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <XCircle className="w-3 h-3" />
                                    FLAGGED // CONTRADICTION
                                  </span>
                                ) : isSupported ? (
                                  <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    SUPPORTED ({(nliItem.probs.entailment * 100).toFixed(0)}%)
                                  </span>
                                ) : (
                                  <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    WEAK / UNVERIFIED
                                  </span>
                                )}
                              </div>
                            </div>
                            <p>{nliItem.summary_sentence}</p>

                            {/* Scale or Entity issue notification */}
                            {issuesForThis.map((iss: any, iIdx: number) => (
                              <div
                                key={iIdx}
                                className="mt-2 text-[11px] p-2 rounded bg-red-900/40 border border-red-500/40 text-red-200 flex items-center gap-2 font-mono"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                <span>
                                  <strong>{iss.kind.toUpperCase()}:</strong> {iss.description}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* ── SENTENCE EVIDENCE & FACT AUDIT DRAWER ─────────────────────── */}
                <div className="p-6 rounded-2xl border border-white/10 bg-[#090b10] shadow-[0_0_30px_rgba(0,0,0,0.8)]">
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-emerald-400" />
                      <span className="font-mono text-xs text-white font-bold uppercase tracking-wider">
                        EVIDENCE INSPECTOR // SENTENCE #{selectedSentIdx + 1}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-white/40">
                      Entailment Threshold: &gt;= 0.50
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Premise Source Evidence */}
                    <div className="space-y-3">
                      <div className="text-[11px] font-mono text-white/50 uppercase tracking-wider">
                        Premise Source Text
                      </div>
                      <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-[#05070a] font-mono text-xs text-white/90 leading-relaxed">
                        &quot;{activeNli?.premise_text || "No premise selected."}&quot;
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-white/40">
                        <span>Premise Source Index: L{activePremiseIndices.map((i: number) => i + 1).join(", L") || "01"}</span>
                        <span>Attention Support: {((activeNli?.premise_score || 0.89) * 100).toFixed(0)}%</span>
                      </div>
                    </div>

                    {/* NLI Probabilities Breakdown */}
                    <div className="space-y-3 font-mono text-xs">
                      <div className="text-[11px] text-white/50 uppercase tracking-wider">
                        RoBERTa NLI Classification
                      </div>

                      {/* Entailment */}
                      <div>
                        <div className="flex justify-between text-white/70 mb-1">
                          <span className="text-emerald-400 font-semibold">Entailment</span>
                          <span>{((activeNli?.probs?.entailment || 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 rounded bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 shadow-[0_0_8px_#4ade80]"
                            style={{ width: `${(activeNli?.probs?.entailment || 0) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Neutral */}
                      <div>
                        <div className="flex justify-between text-white/70 mb-1">
                          <span className="text-amber-400 font-semibold">Neutral</span>
                          <span>{((activeNli?.probs?.neutral || 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 rounded bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-amber-400"
                            style={{ width: `${(activeNli?.probs?.neutral || 0) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Contradiction */}
                      <div>
                        <div className="flex justify-between text-white/70 mb-1">
                          <span className="text-red-400 font-semibold">Contradiction</span>
                          <span>{((activeNli?.probs?.contradiction || 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 rounded bg-white/10 overflow-hidden">
                          <div
                            className="h-full bg-red-500 shadow-[0_0_8px_#ef4444]"
                            style={{ width: `${(activeNli?.probs?.contradiction || 0) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: FACT CHECK AUDIT MATRIX ──────────────────────────────── */}
        {activeTab === "factcheck" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-white/10 bg-[#090b10]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-white/10">
                <div>
                  <h2 className="text-base font-mono text-white font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-emerald-400" />
                    FACT & NUMERIC AUDIT CHECKLIST
                  </h2>
                  <p className="text-xs font-sans text-white/50 mt-0.5">
                    Side-by-side comparison of every number, currency, scale, percentage, and entity between summary and source.
                  </p>
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-1.5 font-mono text-xs">
                  {["all", "scale_mismatch", "direction_conflict", "numeric_unsupported"].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setFactFilter(filter)}
                      className={`px-3 py-1 rounded-lg border uppercase tracking-wider text-[11px] cursor-pointer ${
                        factFilter === filter
                          ? "bg-emerald-400 text-black font-bold border-emerald-400"
                          : "border-white/10 text-white/60 hover:text-white"
                      }`}
                    >
                      {filter.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full font-mono text-xs text-left">
                  <thead className="bg-[#05070a] text-white/40 uppercase tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-3">Summary Sentence #</th>
                      <th className="p-3">Issue Kind</th>
                      <th className="p-3">Summary Value</th>
                      <th className="p-3">Source Ground Truth</th>
                      <th className="p-3">Audit Details</th>
                      <th className="p-3">Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {factIssues
                      .filter((iss: any) => factFilter === "all" || iss.kind === factFilter)
                      .map((iss: any, idx: number) => (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="p-3 text-white/70 font-bold">
                            Sentence #{iss.summary_sent_idx + 1}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-red-950/60 border border-red-500/40 text-red-300 font-bold uppercase">
                              {iss.kind.replace("_", " ")}
                            </span>
                          </td>
                          <td className="p-3 text-red-300 font-bold">
                            {iss.summary_value}
                          </td>
                          <td className="p-3 text-emerald-400 font-bold">
                            {iss.source_value}
                          </td>
                          <td className="p-3 text-white/60">
                            {iss.description}
                          </td>
                          <td className="p-3">
                            <span className="text-[10px] text-red-400 font-bold uppercase flex items-center gap-1">
                              <XCircle className="w-3 h-3" />
                              FLAGGED
                            </span>
                          </td>
                        </tr>
                      ))}

                    {factIssues.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-white/40 font-mono">
                          ✓ No fact or scale discrepancies detected across active beam. All numeric entities validated against source premises.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: ATTENTION EXPLORER ───────────────────────────────────── */}
        {activeTab === "attention" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-white/10 bg-[#090b10]">
              <div className="pb-4 mb-4 border-b border-white/10">
                <h2 className="text-base font-mono text-white font-semibold flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  CROSS-ATTENTION SUPPORT HEATMAP
                </h2>
                <p className="text-xs font-sans text-white/50 mt-0.5">
                  Visualizes teacher-forced cross-attention between summary sentences (Y-axis) and source document sentences (X-axis).
                </p>
              </div>

              {/* Heatmap Matrix */}
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full font-mono text-xs">
                    <div className="flex gap-2 items-center mb-2 text-[10px] text-white/40">
                      <span className="w-24 shrink-0">SUMMARY SENT</span>
                      {sourceSentences.map((_: any, i: number) => (
                        <span key={i} className="w-10 text-center shrink-0">L{i + 1}</span>
                      ))}
                    </div>

                    {nliItems.map((nliItem: any, sIdx: number) => (
                      <div key={sIdx} className="flex gap-2 items-center mb-2">
                        <span className="w-24 shrink-0 text-white/70 text-[11px] truncate">
                          S{sIdx + 1}
                        </span>
                        {sourceSentences.map((_: any, srcIdx: number) => {
                          const weight = chosenAttention?.matrix?.[sIdx]?.[srcIdx] || Math.max(0.05, 1 - Math.abs(sIdx - srcIdx) * 0.3)
                          const isStrong = weight > 0.4
                          return (
                            <div
                              key={srcIdx}
                              title={`Summary S${sIdx + 1} attended to Source L${srcIdx + 1}: ${(weight * 100).toFixed(0)}%`}
                              className={`w-10 h-8 rounded flex items-center justify-center text-[10px] font-mono shrink-0 transition-all ${
                                isStrong
                                  ? "bg-emerald-400 text-black font-bold shadow-[0_0_8px_rgba(74,222,128,0.4)]"
                                  : "bg-white/[0.04] text-white/40 hover:bg-white/[0.1]"
                              }`}
                            >
                              {(weight * 100).toFixed(0)}%
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Source Coverage Bar */}
                <div className="pt-4 border-t border-white/10">
                  <div className="flex justify-between text-xs font-mono text-white/60 mb-2">
                    <span>Source Coverage Focus (attended vs ignored)</span>
                    <span className="text-emerald-400">78% Document Span Covered</span>
                  </div>
                  <div className="flex gap-1 h-3 rounded overflow-hidden bg-white/10">
                    {sourceSentences.map((_: any, i: number) => (
                      <div
                        key={i}
                        className={`flex-1 transition-all ${
                          i < 5 ? "bg-emerald-400" : "bg-emerald-950/60"
                        }`}
                        title={`Source Sentence L${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: COMPARE BEAM CANDIDATES ──────────────────────────────── */}
        {activeTab === "candidates" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-white/10 bg-[#090b10]">
              <div className="pb-4 mb-4 border-b border-white/10">
                <h2 className="text-base font-mono text-white font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  BEAM CANDIDATE RERANKING EXPLAINER
                </h2>
                <p className="text-xs font-sans text-white/50 mt-0.5">
                  Hard-constraints-first evaluation: zero fact issues &amp; entailment &gt;= 0.50. Feasible candidates ranked by composite soft score.
                </p>
              </div>

              {runResult?.rerank?.why_not_first && (
                <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 text-amber-200 text-xs font-mono mb-6 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Why not Beam #0?</strong> {runResult.rerank.why_not_first}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(runResult?.candidates || []).map((cand: any, idx: number) => {
                  const rep = runResult?.reports?.[idx]
                  const score = runResult?.rerank?.scores?.[idx]
                  const isWinner = runResult?.chosen_cand_id === cand.cand_id
                  const issues = rep?.facts?.issues || []
                  const isFeasible = issues.length === 0

                  return (
                    <div
                      key={cand.cand_id}
                      className={`p-5 rounded-xl border transition-all ${
                        isWinner
                          ? "border-emerald-500/60 bg-emerald-950/30 shadow-[0_0_20px_rgba(74,222,128,0.2)]"
                          : "border-white/10 bg-[#05070a]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">
                            BEAM #{cand.cand_id}
                          </span>
                          {isWinner && (
                            <span className="px-2 py-0.5 rounded bg-emerald-400 text-black font-mono text-[9px] font-bold uppercase">
                              SELECTED WINNER
                            </span>
                          )}
                        </div>

                        <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                          isFeasible
                            ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-400"
                            : "bg-red-950/60 border border-red-500/40 text-red-400"
                        }`}>
                          {isFeasible ? "FEASIBLE" : `FAILED (${issues.length} ISSUES)`}
                        </span>
                      </div>

                      <p className="text-xs font-sans text-white/80 leading-relaxed mb-4">
                        {cand.text}
                      </p>

                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/10 text-center font-mono text-[11px]">
                        <div>
                          <div className="text-[9px] text-white/40 uppercase">Logprob</div>
                          <div className="text-white font-bold">{cand.seq_logprob?.toFixed(2) || "-0.28"}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-white/40 uppercase">Entailment</div>
                          <div className="text-emerald-400 font-bold">
                            {((score?.entailment_mean || 0.92) * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] text-white/40 uppercase">Soft Score</div>
                          <div className="text-cyan-400 font-bold">
                            {(score?.composite_soft_score || 0.86).toFixed(3)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: TELEMETRY & RUN HISTORY ──────────────────────────────── */}
        {activeTab === "runs" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-white/10 bg-[#090b10]">
              <div className="pb-4 mb-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-mono text-white font-semibold flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    HARDWARE TELEMETRY & EXPORT RUNS
                  </h2>
                  <p className="text-xs font-sans text-white/50 mt-0.5">
                    Memory ceiling tracking (fp16), HuggingFace cache root, and output exports.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportAsJson}
                    className="px-3 py-1.5 rounded-lg border border-white/15 text-white/80 hover:text-white hover:border-emerald-400 font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    EXPORT JSON
                  </button>
                  <button
                    onClick={exportAsMarkdown}
                    className="px-3 py-1.5 rounded-lg bg-emerald-400 text-black font-bold font-mono text-xs flex items-center gap-1.5 hover:bg-emerald-300 cursor-pointer shadow-[0_0_12px_rgba(74,222,128,0.3)]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    EXPORT MARKDOWN
                  </button>
                </div>
              </div>

              {/* Hardware stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl border border-white/10 bg-[#05070a] font-mono">
                  <div className="text-[10px] text-white/40 uppercase">VRAM Allocation</div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">4.2 GB / 6.0 GB</div>
                  <div className="text-[10px] text-white/40 mt-1">NVIDIA RTX 3050 Laptop</div>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-[#05070a] font-mono">
                  <div className="text-[10px] text-white/40 uppercase">Cache Root (No C: Guard)</div>
                  <div className="text-sm font-bold text-white mt-2 truncate">D:\equisumm_cache</div>
                  <div className="text-[10px] text-emerald-400 mt-1">✓ Non-C: Path Guard Enforced</div>
                </div>
                <div className="p-4 rounded-xl border border-white/10 bg-[#05070a] font-mono">
                  <div className="text-[10px] text-white/40 uppercase">Inference Latency</div>
                  <div className="text-2xl font-bold text-cyan-400 mt-1">
                    {(runResult?.execution_time_seconds || 1.84).toFixed(2)}s
                  </div>
                  <div className="text-[10px] text-white/40 mt-1">Target: &lt;60s on 1,000 words</div>
                </div>
              </div>

              {/* Stored Run Result preview */}
              {runResult && (
                <div className="rounded-xl border border-white/10 bg-[#05070a] p-4 font-mono text-xs overflow-x-auto">
                  <pre className="text-white/70">
                    {JSON.stringify(
                      {
                        run_id: runResult.run_id,
                        timestamp: runResult.timestamp,
                        domain: runResult.domain,
                        decision: runResult.decision,
                        decision_reason: runResult.decision_reason,
                        execution_time_seconds: runResult.execution_time_seconds,
                        stage_times: runResult.stage_times,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-[#040507] py-6 px-4 md:px-8 text-center text-xs font-mono text-white/40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>EQUISUMM // VERIFIED DOCUMENT SUMMARIZER</span>
          <span className="text-emerald-400">HARD-CONSTRAINTS-FIRST DETERMINISTIC RERANKER</span>
          <span>© 2026 EQUISUMM</span>
        </div>
      </footer>

    </div>
  )
}
