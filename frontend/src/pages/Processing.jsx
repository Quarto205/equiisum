import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  Clock,
  ArrowRight,
  RotateCcw,
  Cpu,
  XCircle,
} from 'lucide-react'
import { api } from '../api'

const STAGES = [
  { stage: 1, name: 'Reading document', desc: 'Tokenizing text and mapping sentence boundaries' },
  { stage: 2, name: 'Writing summary', desc: 'Drafting beam candidates with BART-base + LoRA' },
  { stage: 3, name: 'Finding evidence', desc: 'Teacher-forced cross-attention evidence extraction' },
  { stage: 4, name: 'Checking claims', desc: 'Attention-guided premise entailment via RoBERTa' },
  { stage: 5, name: 'Checking numbers and names', desc: 'Strict numeric, scale, currency & entity validation' },
  { stage: 6, name: 'Choosing the safest summary', desc: 'Hard-constraint reranking and fallback cascade' },
]

export function Processing() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [job, setJob] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [cancelling, setCancelling] = useState(false)
  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    let timer = null
    let pollInterval = null

    // Track elapsed seconds
    const startTs = Date.now()
    timer = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTs) / 1000))
    }, 1000)

    const checkStatus = async () => {
      try {
        const data = await api.getAnalysis(id)
        setJob(data)

        if (data.status === 'completed') {
          clearInterval(pollInterval)
          clearInterval(timer)
          // Automatically navigate to report
          const reportId = data.report_id || id
          setTimeout(() => {
            navigate(`/reports/${reportId}`)
          }, 600)
        } else if (data.status === 'failed') {
          clearInterval(pollInterval)
          clearInterval(timer)
        }
      } catch (err) {
        setFetchError(err.message)
      }
    }

    // Initial check and 1s polling interval
    checkStatus()
    pollInterval = setInterval(checkStatus, 1000)

    return () => {
      clearInterval(timer)
      clearInterval(pollInterval)
    }
  }, [id, navigate])

  const handleCancel = async () => {
    try {
      setCancelling(true)
      await api.cancelAnalysis(id)
      const data = await api.getAnalysis(id)
      setJob(data)
    } catch (err) {
      console.error('Cancel failed:', err)
    } finally {
      setCancelling(false)
    }
  }

  const currentStage = job?.stage || 1
  const progressPct = job?.progress || 5
  const isFailed = job?.status === 'failed'
  const isOOM = job?.error_code === 'GPU_OOM' || (job?.error && job.error.includes('out of memory'))

  return (
    <div className="min-h-screen bg-[#fcfbf9] pt-28 pb-20 px-6">
      <div className="max-w-3xl mx-auto space-y-10">
        {/* Header */}
        <div className="space-y-3 text-center">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
            Active Job {id}
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-normal text-dark">
            {isFailed ? 'Analysis Interrupted' : 'Verifying Document Claims'}
          </h1>
          <p className="text-neutral-600 font-sans text-sm max-w-xl mx-auto">
            {isFailed
              ? 'An error occurred during verification. Review details below.'
              : 'Deep learning inference is running locally. You can stay on this page or leave — your analysis will continue in the background.'}
          </p>
        </div>

        {/* Progress Card */}
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-8 shadow-sm space-y-8">
          {/* Progress Bar & Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider">
              <span className="text-neutral-600 font-medium">
                {isFailed ? 'Status: Failed' : `Stage ${currentStage} of 6: ${job?.stage_name || 'Processing'}`}
              </span>
              <div className="flex items-center gap-4 text-neutral-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {elapsed}s elapsed
                </span>
                <span className="font-bold text-indigo-700">{Math.round(progressPct)}%</span>
              </div>
            </div>

            <div className="w-full h-2.5 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200">
              <div
                style={{ width: `${Math.min(100, Math.max(5, progressPct))}%` }}
                className={`h-full transition-all duration-500 rounded-full ${
                  isFailed ? 'bg-rose-600' : 'bg-indigo-600'
                }`}
              />
            </div>
          </div>

          {/* 6 Stages List */}
          <div className="space-y-3 pt-2">
            {STAGES.map((s) => {
              const isPast = currentStage > s.stage || job?.status === 'completed'
              const isCurrent = currentStage === s.stage && !isFailed && job?.status !== 'completed'
              const isUpcoming = currentStage < s.stage

              return (
                <div
                  key={s.stage}
                  className={`flex items-start gap-4 p-3.5 rounded-xl border transition-colors ${
                    isCurrent
                      ? 'border-indigo-300 bg-indigo-50/40 text-dark'
                      : isPast
                      ? 'border-emerald-200 bg-emerald-50/20 text-neutral-800'
                      : 'border-transparent text-neutral-400'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isPast ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : isCurrent ? (
                      <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                    ) : (
                      <Circle className="w-5 h-5 text-neutral-300" />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <div className="font-sans text-sm font-semibold flex items-center gap-2">
                      <span>{s.name}</span>
                      <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest">
                        [Stage {s.stage}]
                      </span>
                    </div>
                    <div className="font-sans text-xs text-neutral-500">{s.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Failure Alert Box */}
          {isFailed && (
            <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Error Code: {job?.error_code || 'PROCESSING_FAILED'}</span>
              </div>
              <p className="text-xs font-sans text-rose-800 leading-relaxed">
                {job?.error || 'An unexpected error occurred during document verification.'}
              </p>

              <div className="pt-2 flex items-center gap-3">
                <Link
                  to="/new"
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white font-mono text-xs uppercase tracking-wider hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </Link>

                {isOOM && (
                  <button
                    onClick={() => navigate('/new')}
                    className="px-4 py-2 rounded-lg bg-indigo-700 text-white font-mono text-xs uppercase tracking-wider hover:bg-indigo-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Retry in CPU Mode</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cancel & Navigation Actions */}
          <div className="border-t border-neutral-100 pt-6 flex items-center justify-between">
            <Link
              to="/reports"
              className="text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-dark"
            >
              ← Back to My Reports
            </Link>

            {!isFailed && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="px-5 py-2 rounded-full border border-neutral-300 text-neutral-700 font-mono text-xs uppercase tracking-wider hover:border-rose-400 hover:text-rose-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Analysis'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
