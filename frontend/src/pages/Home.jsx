import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ShieldCheck,
  FileText,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Cpu,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { api } from '../api'
import { VerdictBadge } from '../components/VerdictBadge'

export function Home() {
  const navigate = useNavigate()
  const [recentReports, setRecentReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeAccordion, setActiveAccordion] = useState(0)

  useEffect(() => {
    async function loadReports() {
      try {
        const data = await api.listAnalyses({ sort: 'date_desc' })
        setRecentReports((data.reports || []).slice(0, 4))
      } catch (err) {
        console.error('Failed to load recent reports:', err)
      } finally {
        setLoading(false)
      }
    }
    loadReports()
  }, [])

  const accordionItems = [
    {
      title: 'Summarize',
      tag: '[BART + LoRA]',
      content:
        'A fine-tuned sequence-to-sequence model drafts diverse candidate summaries under strict length and boundary constraints, ensuring complete thoughts are never truncated mid-sentence.',
    },
    {
      title: 'Find the evidence',
      tag: '[Attention-guided]',
      content:
        'Teacher-forced cross-attention matrices map every generated summary sentence directly to the exact source premises the model was attending to when generating the claim.',
    },
    {
      title: 'Check the claims',
      tag: '[RoBERTa-large-MNLI]',
      content:
        'Natural Language Inference evaluates premise-to-hypothesis entailment, assigning rigorous mathematical probabilities (entailment, neutral, contradiction) to every single statement.',
    },
    {
      title: 'Check the numbers & names',
      tag: '[Regex Extraction Engine]',
      content:
        'Strict entity, scale multiplier ($1.2M vs $1.2B), currency symbol, percentage notation, and trend direction indicators (fell vs rose) are validated for zero factual corruption.',
    },
    {
      title: 'Choose the safest summary',
      tag: '[Hard-Constraint Reranker]',
      content:
        'A two-phase cascade rejects any candidate with factual issues, prunes unsupported sentences, or gracefully falls back to extractive source sentences rather than displaying hallucinated text.',
    },
  ]

  return (
    <div className="min-h-screen bg-[#fcfbf9] text-dark selection:bg-indigo-100 overflow-x-hidden">
      {/* 1. EXPRESSIVE HERO SECTION (min 100vh) */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-36 px-6 overflow-hidden bg-gradient-to-b from-[#f5f4ef] via-[#faf9f5] to-[#fcfbf9]">
        {/* Infinite Drifting Ambient Mesh */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
          <div className="absolute -top-[25%] -left-[15%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-tr from-indigo-200/50 via-purple-200/40 to-transparent blur-3xl animate-mesh-drift"></div>
          <div className="absolute -bottom-[20%] -right-[15%] w-[65vw] h-[65vw] rounded-full bg-gradient-to-bl from-purple-200/40 via-indigo-200/40 to-transparent blur-3xl animate-mesh-drift" style={{ animationDelay: '-15s' }}></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8 animate-scroll-reveal">


          <h1 className="font-display font-normal text-dark tracking-tight leading-[0.88] text-[11vw] sm:text-[9vw] lg:text-[7.5vw]">
            Understand documents. <br />
            <span className="italic font-bold text-indigo-950 font-display">
              Verify every claim.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-neutral-600 font-sans text-base sm:text-lg lg:text-xl font-normal leading-relaxed">
            EquiSumm summarizes complex legal, financial, and legislative texts, then
            mathematically audits every single sentence against the original source before you read it.
          </p>
        </div>

        {/* Concave Wave Container at the Bottom with Start Button at Crest */}
        <div className="wave-container">
          <div className="wave-curve flex flex-col items-center justify-start pt-8">
            <Link
              to="/new"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-indigo-700 text-white font-mono text-xs uppercase tracking-[0.2em] font-semibold hover:bg-indigo-800 transition-all duration-300 animate-btn-pulse shadow-lg hover:shadow-indigo-500/25 cursor-pointer z-20"
            >
              <span>Start New Analysis</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 2. RECENT REPORTS PORTFOLIO GRID */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 border-b border-[#e5e5e5] pb-6">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500 block mb-2">
              Audited Case Records
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-normal text-dark">
              Recent Analysis Reports
            </h2>
          </div>
          <Link
            to="/reports"
            className="mt-4 md:mt-0 font-mono text-xs uppercase tracking-widest text-indigo-700 hover:text-indigo-950 flex items-center gap-1 font-semibold"
          >
            <span>View All Records</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-72 rounded-2xl bg-neutral-100 animate-pulse border border-neutral-200"
              ></div>
            ))}
          </div>
        ) : recentReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {recentReports.map((report, idx) => (
              <div
                key={report.id}
                onClick={() => navigate(`/reports/${report.id}`)}
                className={`card-hover-lift group relative p-8 rounded-2xl border border-[#e5e5e5] bg-white cursor-pointer overflow-hidden ${idx % 2 === 1 ? 'md:mt-8' : ''
                  }`}
              >
                {/* Subtle tinted background & blurred color orb */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-indigo-100/60 blur-2xl group-hover:scale-125 transition-transform duration-700 pointer-events-none"></div>

                <div className="relative z-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">
                      [{report.domain || 'general'}]
                    </span>
                    <VerdictBadge status={report.outcome} size="sm" />
                  </div>

                  <div>
                    <h3 className="font-display text-2xl font-normal text-dark group-hover:text-indigo-950 transition-colors">
                      {report.title}
                    </h3>
                    <div className="mt-2 w-full h-[1px] bg-neutral-200 group-hover:bg-indigo-300 transition-colors"></div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-neutral-500 font-mono">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                    <span>{report.sentenceCount} Sentences Verified</span>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-neutral-600 font-sans">
                      {report.flaggedCount === 0 ? (
                        <span className="text-emerald-700 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 100% Verified claims
                        </span>
                      ) : (
                        <span className="text-amber-700 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> {report.flaggedCount} claims flagged
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded-full bg-neutral-900 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                      View Report →
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="p-12 text-center rounded-2xl border border-dashed border-neutral-300 bg-white max-w-xl mx-auto space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-indigo-50 flex items-center justify-center text-indigo-700">
              <FileText className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="font-display text-2xl font-normal text-dark">
                No analyses completed yet
              </h3>
              <p className="text-neutral-600 text-sm max-w-md mx-auto">
                Test the summarization and verification engine with one of our pre-packaged financial or legal benchmark documents.
              </p>
            </div>
            <Link
              to="/new"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-700 text-white font-mono text-xs uppercase tracking-widest font-semibold hover:bg-indigo-800 transition-colors"
            >
              <span>Try a Sample Document</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </section>

      {/* 3. HOW IT WORKS ACCORDION */}
      <section className="max-w-7xl mx-auto px-6 py-24 border-t border-[#e5e5e5]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left sticky serif headline */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-32 space-y-4">
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500 block">
                Verification Methodology
              </span>
              <h2 className="font-display text-4xl sm:text-5xl font-normal text-dark leading-tight">
                How EquiSumm <br />
                <span className="italic font-bold text-indigo-900">verifies every claim.</span>
              </h2>
              <p className="text-neutral-600 text-base leading-relaxed pt-2">
                Traditional ROUGE metrics only look at lexical word overlap. EquiSumm subjects
                every abstractive hypothesis to teacher-forced cross-attention tracing, NLI entailment,
                and numeric sanity checks.
              </p>
            </div>
          </div>

          {/* Right Accordion List */}
          <div className="lg:col-span-7 space-y-4">
            {accordionItems.map((item, idx) => {
              const isOpen = activeAccordion === idx
              return (
                <div
                  key={idx}
                  className={`border rounded-xl transition-all duration-300 overflow-hidden ${isOpen
                      ? 'border-indigo-300 bg-white shadow-sm'
                      : 'border-neutral-200 bg-white/60 hover:border-neutral-300'
                    }`}
                >
                  <button
                    onClick={() => setActiveAccordion(isOpen ? -1 : idx)}
                    className="w-full text-left p-6 flex items-center justify-between cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs text-neutral-400 font-semibold">
                        0{idx + 1}
                      </span>
                      <h3
                        className={`font-display text-xl sm:text-2xl transition-colors ${isOpen ? 'text-dark font-normal' : 'text-neutral-500 group-hover:text-dark'
                          }`}
                      >
                        {item.title}
                      </h3>
                      <span className="font-mono text-[11px] text-indigo-700 uppercase tracking-widest hidden sm:inline-block">
                        {item.tag}
                      </span>
                    </div>
                    <div className="text-neutral-400 group-hover:text-dark">
                      {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 pt-2 border-t border-neutral-100 text-neutral-700 font-sans leading-relaxed text-sm animate-fadeIn">
                      <p>{item.content}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 4. CURVED DARK FOOTER */}
      <footer className="mt-20 ml-2 bg-dark text-white rounded-t-[4rem] sm:rounded-t-[5rem] pt-20 pb-16 px-6 relative overflow-hidden">
        {/* Faint radial indigo glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-48 bg-indigo-900/20 blur-3xl rounded-full pointer-events-none"></div>

        <div className="relative z-10 max-w-7xl mx-auto space-y-16">
          {/* Large Serif Quote */}
          <div className="max-w-4xl border-b border-neutral-800 pb-16">
            <blockquote className="font-display italic text-2xl sm:text-4xl lg:text-5xl font-light text-neutral-200 leading-tight">
              “In high-stakes legal and financial analysis, a summary is worse than useless if you cannot verify the numbers behind it.”
            </blockquote>
          </div>

          {/* 3-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 font-sans text-sm">
            <div className="space-y-4">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-400 block">
                About EquiSumm
              </span>
              <p className="text-neutral-400 leading-relaxed">
                An editorial-tech verification platform built for attorneys, fiduciary analysts, and compliance officers who require verifiable factual grounding.
              </p>
            </div>

            <div className="space-y-4">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-400 block">
                Core ML Pipeline
              </span>
              <ul className="space-y-2 text-neutral-400 font-mono text-xs">
                <li>• BART-base + LoRA summarization</li>
                <li>• RoBERTa-large-MNLI entailment</li>
                <li>• Cross-attention evidence matrix</li>
                <li>• Hard-constraint fallback cascade</li>
              </ul>
            </div>

            <div className="space-y-4">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-400 block">
                Direct Actions
              </span>
              <ul className="space-y-2">
                <li>
                  <Link to="/new" className="text-indigo-400 hover:text-indigo-300 font-mono text-xs uppercase tracking-wider">
                    Start Analysis →
                  </Link>
                </li>
                <li>
                  <Link to="/reports" className="text-indigo-400 hover:text-indigo-300 font-mono text-xs uppercase tracking-wider">
                    Browse Reports →
                  </Link>
                </li>
                <li>
                  <Link to="/settings" className="text-indigo-400 hover:text-indigo-300 font-mono text-xs uppercase tracking-wider">
                    System Telemetry →
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Monospace Copyright */}
          <div className="pt-8 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between text-neutral-500 font-mono text-xs gap-4">
            <span>© 2026 EQUISUMM PLATFORM · ALL INFERENCE RUNS LOCALLY</span>
            <span>WCAG AA COMPLIANT · STRICT ZERO-CLOUD TELEMETRY</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
