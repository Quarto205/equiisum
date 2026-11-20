import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Download,
  Share2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  Eye,
  Info,
  HelpCircle,
  Sparkles,
  Layers,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  BarChart2,
  FileSearch,
} from 'lucide-react'
import { api } from '../api'
import { VerdictBadge } from '../components/VerdictBadge'
import {
  AttentionHeatmap,
  CoverageBar,
  SentenceEmbeddingScatter,
} from '../components/AttentionViz'

export function Report() {
  const { id } = useParams()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Navigation tab
  const [activeTab, setActiveTab] = useState('summary') // 'overview' | 'summary' | 'audit' | 'attention' | 'comparison' | 'evaluation'

  // Signature interaction: selected summary sentence index
  const [selectedSentIdx, setSelectedSentIdx] = useState(0)

  // Reverse interaction: selected source sentence index
  const [selectedSourceIdx, setSelectedSourceIdx] = useState(null)

  // Full source document toggle
  const [showFullSource, setShowFullSource] = useState(false)

  // Audit filter & search
  const [auditFilter, setAuditFilter] = useState('ALL')
  const [auditSearch, setAuditSearch] = useState('')

  // Attention sub-tab
  const [attnSubTab, setAttnSubTab] = useState('matrix') // 'matrix' | 'tsne'

  const sourceSentRefs = useRef({})

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true)
        const data = await api.getReport(id)
        setReport(data)
        if (data.summary && data.summary.length > 0) {
          setSelectedSentIdx(0)
        }
      } catch (err) {
        setError(err.message || 'Failed to load report.')
      } finally {
        setLoading(false)
      }
    }
    loadReport()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfbf9] pt-32 pb-20 px-6 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-2 border-indigo-700 border-t-transparent rounded-full animate-spin"></div>
        <div className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          Loading Verified Report...
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-[#fcfbf9] pt-32 pb-20 px-6 max-w-xl mx-auto text-center space-y-6">
        <div className="p-8 bg-white border border-rose-200 rounded-2xl shadow-sm space-y-4">
          <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
          <h2 className="font-display text-2xl text-dark">Report Not Found</h2>
          <p className="text-neutral-600 text-sm font-sans">{error || 'Unable to locate report.'}</p>
          <Link
            to="/reports"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-neutral-900 text-white font-mono text-xs uppercase tracking-wider"
          >
            ← Return to Reports
          </Link>
        </div>
      </div>
    )
  }

  // Key Counts
  const totalSentences = report.summary.length
  const supportedCount = report.summary.filter((s) => s.status === 'SUPPORTED').length
  const flaggedCount = report.summary.filter((s) => s.status === 'FLAGGED').length
  const removedCount = report.summary.filter((s) => s.status === 'REMOVED').length

  const allFactChecks = report.summary.flatMap((s) => s.factChecks || [])
  const verifiedFacts = allFactChecks.filter((f) => f.result === 'VERIFIED').length
  const mismatchFacts = allFactChecks.filter((f) => f.result !== 'VERIFIED').length

  const activeSummarySentence = report.summary[selectedSentIdx] || report.summary[0]
  const evidenceIds = activeSummarySentence?.evidenceIds || []

  // Outcome banner copy
  const outcomeDetails = {
    ACCEPT: {
      headline: 'Candidate Accepted — Zero Factual Inconsistencies',
      copy: 'Every generated claim satisfies the strict entailment threshold and matches source entities and figures.',
      style: 'bg-emerald-50 border-emerald-300 text-emerald-950',
    },
    ACCEPT_PRUNED: {
      headline: 'Candidate Accepted with Flagged Claims Pruned',
      copy: 'Flagged or unverified statements were automatically removed to guarantee factual purity of the remaining summary.',
      style: 'bg-amber-50 border-amber-300 text-amber-950',
    },
    EXTRACTIVE_FALLBACK: {
      headline: 'Abstractive Candidate Diverged — Extractive Fallback Used',
      copy: 'Generated beams did not satisfy strict hard constraints. Salient source sentences were extracted instead.',
      style: 'bg-indigo-50 border-indigo-200 text-indigo-950',
    },
    ESCALATE: {
      headline: 'Document Escalated to Human Expert Review',
      copy: 'The document cannot be safely summarized without expert legal/fiduciary review. Verification confidence too low.',
      style: 'bg-rose-50 border-rose-300 text-rose-950',
    },
  }[report.outcome] || {
    headline: `Outcome: ${report.outcome}`,
    copy: 'Document processed by hard-constraint cascade.',
    style: 'bg-neutral-50 border-neutral-300 text-dark',
  }

  // Filtered Fact Audit rows
  const filteredFacts = allFactChecks.filter((f) => {
    const matchStatus = auditFilter === 'ALL' || f.result === auditFilter
    const matchQuery =
      !auditSearch ||
      f.value.toLowerCase().includes(auditSearch.toLowerCase()) ||
      f.explanation.toLowerCase().includes(auditSearch.toLowerCase())
    return matchStatus && matchQuery
  })

  return (
    <div className="min-h-screen bg-[#fcfbf9] pt-28 pb-24 px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Document Header & Metadata */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#e5e5e5] pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
                Analysis Report · {report.id}
              </span>
              <VerdictBadge status={report.outcome} size="sm" />
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-normal text-dark">
              {report.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-neutral-500 pt-1">
              <span>{new Date(report.createdAt).toLocaleString()}</span>
              <span>·</span>
              <span>{report.source.wordCount} Source Words</span>
              <span>·</span>
              <span>{report.source.sentences.length} Source Sentences</span>
              <span>·</span>
              <span>Duration: {(report.durationMs / 1000).toFixed(1)}s</span>
            </div>
          </div>

          {/* Export Menu */}
          <div className="flex items-center gap-2">
            <a
              href={api.exportUrl(report.id, 'markdown')}
              download
              className="px-4 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-mono uppercase tracking-wider text-neutral-800 hover:border-neutral-400 hover:shadow-sm transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Markdown</span>
            </a>
            <a
              href={api.exportUrl(report.id, 'csv')}
              download
              className="px-4 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-mono uppercase tracking-wider text-neutral-800 hover:border-neutral-400 hover:shadow-sm transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </a>
            <a
              href={api.exportUrl(report.id, 'json')}
              download
              className="px-4 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-mono uppercase tracking-wider text-neutral-800 hover:border-neutral-400 hover:shadow-sm transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JSON</span>
            </a>
          </div>
        </div>

        {/* Outcome Banner */}
        <div className={`p-6 rounded-2xl border ${outcomeDetails.style} space-y-2 shadow-sm`}>
          <div className="flex items-center gap-2.5 font-display text-xl font-medium">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <span>{outcomeDetails.headline}</span>
          </div>
          <p className="font-sans text-xs sm:text-sm leading-relaxed opacity-90 max-w-3xl">
            {outcomeDetails.copy}
          </p>
        </div>

        {/* Key Verification Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 bg-white border border-[#e5e5e5] rounded-xl shadow-sm space-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 block">
              Supported Claims
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-medium text-emerald-700">
                {supportedCount}
              </span>
              <span className="font-mono text-xs text-neutral-400">/ {totalSentences} sentences</span>
            </div>
            <div className="text-[11px] text-emerald-800 font-sans">
              Passed strict entailment threshold
            </div>
          </div>

          <div className="p-5 bg-white border border-[#e5e5e5] rounded-xl shadow-sm space-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 block">
              Flagged Claims
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-medium text-amber-700">
                {flaggedCount}
              </span>
              <span className="font-mono text-xs text-neutral-400">/ {totalSentences} sentences</span>
            </div>
            <div className="text-[11px] text-amber-800 font-sans">
              {flaggedCount === 0 ? 'Zero hallucinations detected' : 'Under premise threshold'}
            </div>
          </div>

          <div className="p-5 bg-white border border-[#e5e5e5] rounded-xl shadow-sm space-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 block">
              Verified Figures
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-medium text-dark">
                {verifiedFacts}
              </span>
              <span className="font-mono text-xs text-neutral-400">/ {allFactChecks.length} checked</span>
            </div>
            <div className="text-[11px] text-neutral-600 font-sans">
              Numbers, percentages & entities
            </div>
          </div>

          <div className="p-5 bg-white border border-[#e5e5e5] rounded-xl shadow-sm space-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 block">
              Scale Mismatches
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className={`font-display text-3xl font-medium ${
                  mismatchFacts > 0 ? 'text-rose-600' : 'text-neutral-900'
                }`}
              >
                {mismatchFacts}
              </span>
              <span className="font-mono text-xs text-neutral-400">conflicts</span>
            </div>
            <div className="text-[11px] text-neutral-600 font-sans">
              Direction or scale errors detected
            </div>
          </div>
        </div>

        {/* 6 Report Navigation Tabs (Grouped into Core and Advanced Insights) */}
        <div className="border-b border-[#e5e5e5] flex items-center justify-between overflow-x-auto">
          <div className="flex items-center gap-1 sm:gap-4 shrink-0">
            <button
              onClick={() => setActiveTab('summary')}
              className={`py-3 px-4 font-mono text-xs uppercase tracking-wider font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'summary'
                  ? 'border-indigo-700 text-indigo-700'
                  : 'border-transparent text-neutral-500 hover:text-dark'
              }`}
            >
              Verified Summary
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`py-3 px-4 font-mono text-xs uppercase tracking-wider font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'audit'
                  ? 'border-indigo-700 text-indigo-700'
                  : 'border-transparent text-neutral-500 hover:text-dark'
              }`}
            >
              Evidence & Verification
            </button>

            {/* Advanced Insights Divider / Label */}
            <span className="text-neutral-300 mx-2">|</span>

            <button
              onClick={() => setActiveTab('attention')}
              className={`py-3 px-4 font-mono text-xs uppercase tracking-wider font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'attention'
                  ? 'border-indigo-700 text-indigo-700'
                  : 'border-transparent text-neutral-500 hover:text-dark'
              }`}
            >
              Attention Explorer
            </button>

            <button
              onClick={() => setActiveTab('comparison')}
              className={`py-3 px-4 font-mono text-xs uppercase tracking-wider font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'comparison'
                  ? 'border-indigo-700 text-indigo-700'
                  : 'border-transparent text-neutral-500 hover:text-dark'
              }`}
            >
              Candidate Comparison
            </button>

            <button
              onClick={() => setActiveTab('evaluation')}
              className={`py-3 px-4 font-mono text-xs uppercase tracking-wider font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'evaluation'
                  ? 'border-indigo-700 text-indigo-700'
                  : 'border-transparent text-neutral-500 hover:text-dark'
              }`}
            >
              ROUGE Evaluation
            </button>
          </div>
        </div>

        {/* TAB 1: VERIFIED SUMMARY (THE SIGNATURE TWO-PANE INTERACTION) */}
        {activeTab === 'summary' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Pane: Summary Sentences with VerdictBadges */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-neutral-500 uppercase tracking-wider">
                <span>Summary Claims (Click any sentence to inspect proof)</span>
                <span>{report.summary.length} sentences</span>
              </div>

              <div className="space-y-3">
                {report.summary.map((sent, sIdx) => {
                  const isSelected = selectedSentIdx === sIdx
                  const isSupported = sent.status === 'SUPPORTED'

                  return (
                    <div
                      key={sIdx}
                      onClick={() => {
                        setSelectedSentIdx(sIdx)
                        setSelectedSourceIdx(null)
                      }}
                      className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'border-indigo-500 bg-white ring-2 ring-indigo-500/20 shadow-md'
                          : 'border-[#e5e5e5] bg-white hover:border-neutral-300 hover:bg-[#faf9f6]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="font-mono text-xs text-neutral-400 font-semibold">
                          Claim #{sIdx + 1}
                        </span>
                        <VerdictBadge status={sent.status} size="xs" />
                      </div>

                      <p className="font-sans text-sm leading-relaxed text-dark">
                        {sent.text}
                      </p>

                      <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-neutral-500 pt-2 border-t border-neutral-100">
                        <span>
                          NLI Entailment: {(sent.nli.entailment * 100).toFixed(0)}%
                        </span>
                        <span className="text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1">
                          View {sent.evidenceIds?.length || 0} Source Premises →
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right Pane: Evidence Panel for Selected Sentence */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-28">
              <div className="bg-white border border-[#e5e5e5] rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div className="space-y-0.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-indigo-700 font-semibold">
                      Proof for Claim #{selectedSentIdx + 1}
                    </span>
                    <h3 className="font-display text-lg text-dark">
                      Attention Evidence & Facts
                    </h3>
                  </div>
                  <VerdictBadge status={activeSummarySentence?.status} size="xs" />
                </div>

                {/* NLI Probabilities Bars */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-neutral-600">
                    <span className="flex items-center gap-1">
                      <span>NLI Inference</span>
                      <span
                        title="Entailment means the source document logically necessitates this summary statement."
                        className="cursor-help text-neutral-400"
                      >
                        <Info className="w-3 h-3" />
                      </span>
                    </span>
                    <span className="font-bold text-emerald-700">
                      {((activeSummarySentence?.nli.entailment || 0) * 100).toFixed(1)}% Entailment
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono">
                    <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                      <div className="text-neutral-500 uppercase text-[9px]">Entailment</div>
                      <div className="font-bold text-emerald-800">
                        {((activeSummarySentence?.nli.entailment || 0) * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="p-2 bg-neutral-50 rounded border border-neutral-200">
                      <div className="text-neutral-500 uppercase text-[9px]">Neutral</div>
                      <div className="font-bold text-neutral-700">
                        {((activeSummarySentence?.nli.neutral || 0) * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="p-2 bg-rose-50 rounded border border-rose-200">
                      <div className="text-neutral-500 uppercase text-[9px]">Contradiction</div>
                      <div className="font-bold text-rose-800">
                        {((activeSummarySentence?.nli.contradiction || 0) * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Supporting Source Premises */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-neutral-600">
                    <span>Ranked Source Evidence ({evidenceIds.length})</span>
                    <button
                      onClick={() => setShowFullSource(!showFullSource)}
                      className="text-indigo-600 hover:text-indigo-800 text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{showFullSource ? 'Hide Full Source' : 'Show Full Source'}</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {evidenceIds.map((srcId, rank) => {
                      const srcObj = report.source.sentences[srcId]
                      if (!srcObj) return null

                      return (
                        <div
                          key={srcId}
                          className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between font-mono text-[10px] text-neutral-500 uppercase tracking-wider">
                            <span className="font-bold text-indigo-900">
                              Rank #{rank + 1} · Source Sentence #{srcId + 1}
                            </span>
                            <span>Selected by Cross-Attention</span>
                          </div>
                          <p className="font-sans text-neutral-800 leading-relaxed">
                            {srcObj.text}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Fact Checks on this sentence */}
                {activeSummarySentence?.factChecks && activeSummarySentence.factChecks.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-neutral-100">
                    <span className="font-mono text-xs uppercase tracking-wider text-neutral-600 block">
                      Audited Figures in this Sentence
                    </span>
                    <div className="space-y-2">
                      {activeSummarySentence.factChecks.map((fc, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg border border-neutral-200 bg-white text-xs flex items-center justify-between"
                        >
                          <div className="space-y-0.5">
                            <div className="font-mono font-bold text-dark">
                              {fc.value}{' '}
                              <span className="text-[10px] text-neutral-400 font-normal">
                                [{fc.kind}]
                              </span>
                            </div>
                            <div className="text-[11px] text-neutral-500 font-sans">
                              {fc.explanation}
                            </div>
                          </div>
                          <VerdictBadge status={fc.result} size="xs" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Full Source Side View */}
              {showFullSource && (
                <div className="bg-white border border-[#e5e5e5] rounded-2xl p-6 shadow-sm space-y-3 animate-fadeIn max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                    <span className="font-mono text-xs uppercase tracking-wider text-neutral-700 font-bold">
                      Full Source Text
                    </span>
                    <span className="font-mono text-[10px] text-neutral-400">
                      {report.source.sentences.length} sentences
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-sans leading-relaxed text-neutral-700">
                    {report.source.sentences.map((src, i) => {
                      const isHighlighted = evidenceIds.includes(i)
                      return (
                        <p
                          key={i}
                          className={`p-1.5 rounded transition-colors ${
                            isHighlighted
                              ? 'bg-indigo-100/70 border-l-2 border-indigo-700 font-medium text-dark'
                              : 'hover:bg-neutral-50'
                          }`}
                        >
                          <span className="font-mono text-[10px] text-neutral-400 mr-2">
                            [{i + 1}]
                          </span>
                          {src.text}
                        </p>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: EVIDENCE & VERIFICATION AUDIT TABLE */}
        {activeTab === 'audit' && (
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
              <div>
                <h3 className="font-display text-2xl text-dark">Fact Verification Audit</h3>
                <p className="text-xs text-neutral-500 font-sans mt-0.5">
                  Side-by-side audit of all numbers, scale multipliers, percentages, currencies, and named entities.
                </p>
              </div>

              {/* Filter & Search Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Search numbers or entities..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-sans focus:border-indigo-600 bg-white"
                  />
                </div>

                <select
                  value={auditFilter}
                  onChange={(e) => setAuditFilter(e.target.value)}
                  className="p-1.5 rounded-lg border border-neutral-300 text-xs font-mono uppercase bg-white focus:border-indigo-600"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="VERIFIED">Verified Only</option>
                  <option value="SCALE_MISMATCH">Scale Mismatch</option>
                  <option value="DIRECTION_CONFLICT">Direction Conflict</option>
                  <option value="CURRENCY_MISMATCH">Currency Mismatch</option>
                  <option value="PERCENT_MISMATCH">Percent Mismatch</option>
                  <option value="UNSUPPORTED_ENTITY">Unsupported Entity</option>
                </select>
              </div>
            </div>

            {/* Audit Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-neutral-200 font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                    <th className="py-3 px-3">Claim</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Extracted Figure / Entity</th>
                    <th className="py-3 px-3">Audit Verdict</th>
                    <th className="py-3 px-3">Explanation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredFacts.map((row, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-neutral-600">
                        Claim #{idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono uppercase text-neutral-500 text-[11px]">
                        [{row.kind}]
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-dark">
                        {row.value}
                      </td>
                      <td className="py-3 px-3">
                        <VerdictBadge status={row.result} size="xs" />
                      </td>
                      <td className="py-3 px-3 text-neutral-600 font-sans max-w-md">
                        {row.explanation}
                      </td>
                    </tr>
                  ))}
                  {filteredFacts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-neutral-400 font-mono">
                        No figures or entities match the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ATTENTION EXPLORER & EMBEDDINGS */}
        {activeTab === 'attention' && (
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-6 sm:p-8 space-y-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
              <div>
                <h3 className="font-display text-2xl text-dark">Cross-Attention & Coverage</h3>
                <p className="text-xs text-neutral-500 font-sans mt-0.5">
                  Trace teacher-forced attention attribution from summary sentences to source premises.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAttnSubTab('matrix')}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
                    attnSubTab === 'matrix'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:text-dark'
                  }`}
                >
                  Attention Matrix & Coverage
                </button>
                <button
                  onClick={() => setAttnSubTab('tsne')}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
                    attnSubTab === 'tsne'
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:text-dark'
                  }`}
                >
                  t-SNE Sentence Embeddings
                </button>
              </div>
            </div>

            {attnSubTab === 'matrix' ? (
              <div className="space-y-8">
                {/* Heatmap */}
                <AttentionHeatmap
                  matrix={report.attention.matrix}
                  summarySentences={report.summary}
                  sourceSentences={report.source.sentences}
                  onSelectCell={(r, c) => {
                    setSelectedSentIdx(r)
                    setActiveTab('summary')
                  }}
                />

                {/* Source Coverage Bar */}
                <div className="pt-4 border-t border-neutral-100">
                  <CoverageBar
                    coverage={report.attention.coverage}
                    sourceSentences={report.source.sentences}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <SentenceEmbeddingScatter points={report.embeddings.points} />
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CANDIDATE COMPARISON & WHY NOT #1 */}
        {activeTab === 'comparison' && (
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-6 sm:p-8 space-y-8 shadow-sm">
            <div className="space-y-2 border-b border-neutral-100 pb-4">
              <h3 className="font-display text-2xl text-dark">
                Beam Candidate Comparison & Decision Log
              </h3>
              <p className="text-xs text-neutral-500 font-sans">
                EquiSumm generates diverse beam candidates and subjects each to hard constraints and soft scoring.
              </p>
            </div>

            {/* Why Not #1 Callout */}
            <div className="p-5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-indigo-950 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-indigo-700" />
                <span>Decision Transparency ("Why Not Candidate #1?")</span>
              </div>
              <p className="font-sans text-sm text-indigo-900 leading-relaxed">
                {report.whyNotFirst}
              </p>
            </div>

            {/* Candidates Side-by-Side Comparison Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {report.candidates.map((cand) => {
                const isChosen = cand.is_selected

                return (
                  <div
                    key={cand.cand_id}
                    className={`p-6 rounded-2xl border transition-all ${
                      isChosen
                        ? 'border-emerald-400 bg-emerald-50/20 shadow-md ring-1 ring-emerald-300'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-700">
                        Beam Candidate #{cand.cand_id}
                      </span>
                      {isChosen ? (
                        <span className="font-mono text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-600 text-white font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Selected Summary
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">
                          Alternative
                        </span>
                      )}
                    </div>

                    <p className="font-sans text-sm text-neutral-800 leading-relaxed mb-6">
                      {cand.text}
                    </p>

                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-neutral-100 text-center font-mono text-xs">
                      <div className="p-2 bg-neutral-50 rounded">
                        <div className="text-[9px] uppercase text-neutral-400">Log-Prob</div>
                        <div className="font-semibold text-neutral-800">{cand.seq_logprob}</div>
                      </div>
                      <div className="p-2 bg-neutral-50 rounded">
                        <div className="text-[9px] uppercase text-neutral-400">NLI Mean</div>
                        <div className="font-semibold text-neutral-800">{cand.entailment_mean}</div>
                      </div>
                      <div className="p-2 bg-neutral-50 rounded">
                        <div className="text-[9px] uppercase text-neutral-400">Fact Issues</div>
                        <div
                          className={`font-semibold ${
                            cand.fact_issues > 0 ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {cand.fact_issues}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TAB 5: ROUGE VS FACTUALITY EVALUATION */}
        {activeTab === 'evaluation' && (
          <div className="bg-white border border-[#e5e5e5] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="space-y-2 border-b border-neutral-100 pb-4">
              <h3 className="font-display text-2xl text-dark">
                ROUGE vs. Factuality Metric Divergence
              </h3>
              <p className="text-xs text-neutral-500 font-sans">
                Compares surface n-gram lexical overlap against deep natural language inference and numeric truth.
              </p>
            </div>

            {/* ROUGE Divergence Warning Callout */}
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-950">
              <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>The Lexical Overlap Fallacy</span>
              </div>
              <p className="font-sans text-xs sm:text-sm leading-relaxed text-amber-900">
                Standard ROUGE metrics reward matching words regardless of truth. A summary stating
                “revenue fell 8%” can achieve 90%+ ROUGE against “revenue rose 8%”, while inverting
                the document’s meaning. EquiSumm enforces factual entailment over blind word matching.
              </p>
            </div>

            {/* Metrics Grid */}
            {report.evaluation && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-2">
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-center space-y-1">
                  <span className="font-mono text-[10px] uppercase text-neutral-500 block">ROUGE-1</span>
                  <span className="font-display text-2xl font-bold text-neutral-900">
                    {(report.evaluation.rouge1 * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono block">Unigram Overlap</span>
                </div>

                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-center space-y-1">
                  <span className="font-mono text-[10px] uppercase text-neutral-500 block">ROUGE-2</span>
                  <span className="font-display text-2xl font-bold text-neutral-900">
                    {(report.evaluation.rouge2 * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono block">Bigram Overlap</span>
                </div>

                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-center space-y-1">
                  <span className="font-mono text-[10px] uppercase text-neutral-500 block">ROUGE-L</span>
                  <span className="font-display text-2xl font-bold text-neutral-900">
                    {(report.evaluation.rougeL * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono block">Longest Common Subseq</span>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center space-y-1">
                  <span className="font-mono text-[10px] uppercase text-emerald-700 block">Entailment Mean</span>
                  <span className="font-display text-2xl font-bold text-emerald-800">
                    {(report.evaluation.entailmentMean * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-emerald-600 font-mono block">Premise Support</span>
                </div>

                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center space-y-1">
                  <span className="font-mono text-[10px] uppercase text-emerald-700 block">Factual Precision</span>
                  <span className="font-display text-2xl font-bold text-emerald-800">
                    {(report.evaluation.factualPrecision * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-emerald-600 font-mono block">Entities & Numbers</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
