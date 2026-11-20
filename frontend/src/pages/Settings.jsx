import React, { useEffect, useState } from 'react'
import {
  Sliders,
  Cpu,
  Activity,
  HardDrive,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Play,
  FileText,
  Upload,
} from 'lucide-react'
import { api } from '../api'

export function Settings() {
  const [config, setConfig] = useState(null)
  const [systemInfo, setSystemInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState(null)

  // Self-test state
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  // Flush cache state
  const [flushing, setFlushing] = useState(false)
  const [flushMessage, setFlushMessage] = useState(null)

  // Benchmark state
  const [evaluating, setEvaluating] = useState(false)
  const [evalResult, setEvalResult] = useState(null)
  const [evalSamples, setEvalSamples] = useState(5)

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [cfg, sys] = await Promise.all([api.settings(), api.system()])
        setConfig(cfg)
        setSystemInfo(sys)
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaveMessage(null)
    try {
      setSaving(true)
      const res = await api.saveSettings(config)
      setSaveMessage(res.message || 'Settings saved successfully.')
    } catch (err) {
      setSaveMessage('Error saving settings: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefaults = () => {
    setConfig((prev) => ({
      ...prev,
      entailment_threshold: 0.5,
      top_k_premise: 3,
      n_candidates: 4,
      reranker_weights: {
        seq_logprob: 0.25,
        entailment_mean: 0.35,
        entity_precision: 0.15,
        numeric_precision: 0.15,
        coverage_entropy: 0.1,
      },
    }))
  }

  const handleRunSelfTest = async () => {
    try {
      setTesting(true)
      setTestResult(null)
      const res = await api.selfTest()
      setTestResult({ success: true, message: res.message })
    } catch (err) {
      setTestResult({ success: false, message: err.message })
    } finally {
      setTesting(false)
    }
  }

  const handleFlushCache = async () => {
    try {
      setFlushing(true)
      setFlushMessage(null)
      const res = await api.flushCache()
      setFlushMessage(res.message)
      const sys = await api.system()
      setSystemInfo(sys)
    } catch (err) {
      setFlushMessage('Error flushing cache: ' + err.message)
    } finally {
      setFlushing(false)
    }
  }

  const handleRunBenchmark = async () => {
    try {
      setEvaluating(true)
      setEvalResult(null)
      const job = await api.evaluate({ max_samples: evalSamples, run_name: 'benchmark_suite' })

      // Poll benchmark
      const poll = setInterval(async () => {
        try {
          const status = await api.getEvaluation(job.id)
          if (status.status === 'completed') {
            clearInterval(poll)
            setEvaluating(false)
            setEvalResult(status.result)
          } else if (status.status === 'failed') {
            clearInterval(poll)
            setEvaluating(false)
            setEvalResult({ error: status.error || 'Benchmark failed.' })
          }
        } catch {
          clearInterval(poll)
          setEvaluating(false)
        }
      }, 1000)
    } catch (err) {
      setEvaluating(false)
      setEvalResult({ error: err.message })
    }
  }

  if (loading || !config) {
    return (
      <div className="min-h-screen bg-[#fcfbf9] pt-32 pb-20 px-6 flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-2 border-indigo-700 border-t-transparent rounded-full animate-spin"></div>
        <div className="font-mono text-xs uppercase tracking-widest text-neutral-500">
          Loading System Configuration...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fcfbf9] pt-28 pb-20 px-6">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <div className="space-y-2 border-b border-[#e5e5e5] pb-6">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
            Runtime Controls
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-normal text-dark">
            Settings & Telemetry
          </h1>
          <p className="text-neutral-600 font-sans text-sm max-w-2xl">
            Configure inference thresholds, inspect GPU memory allocation, and run offline self-tests.
          </p>
        </div>

        {/* SECTION 1: SYSTEM TELEMETRY & HARDWARE */}
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-2.5">
              <Activity className="w-5 h-5 text-indigo-700" />
              <h2 className="font-display text-xl text-dark">System & Hardware Telemetry</h2>
            </div>
            <button
              onClick={handleFlushCache}
              disabled={flushing}
              className="px-3.5 py-1.5 rounded-lg border border-neutral-300 text-xs font-mono uppercase tracking-wider hover:bg-neutral-50 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>{flushing ? 'Flushing...' : 'Flush GPU VRAM'}</span>
            </button>
          </div>

          {flushMessage && (
            <div className="p-3 bg-neutral-100 rounded-lg font-mono text-xs text-neutral-700">
              {flushMessage}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
              <span className="font-mono text-[10px] uppercase text-neutral-400 block">Execution Device</span>
              <span className="font-mono text-base font-bold text-dark uppercase">
                {systemInfo?.device || 'CPU'}
              </span>
              <span className="font-mono text-[10px] text-neutral-500 block">
                {systemInfo?.cuda_available ? 'NVIDIA CUDA Detected' : 'CPU ThreadPool Mode'}
              </span>
            </div>

            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
              <span className="font-mono text-[10px] uppercase text-neutral-400 block">Precision</span>
              <span className="font-mono text-base font-bold text-dark">
                {systemInfo?.precision || 'float32'}
              </span>
              <span className="font-mono text-[10px] text-neutral-500 block">Half-Precision Inference</span>
            </div>

            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
              <span className="font-mono text-[10px] uppercase text-neutral-400 block">GPU VRAM Allocated</span>
              <span className="font-mono text-base font-bold text-dark">
                {systemInfo?.allocated_mb ? `${systemInfo.allocated_mb} MB` : 'N/A (CPU)'}
              </span>
              <span className="font-mono text-[10px] text-neutral-500 block">
                Total: {systemInfo?.total_mb ? `${Math.round(systemInfo.total_mb / 1024)} GB` : 'Host Memory'}
              </span>
            </div>

            <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
              <span className="font-mono text-[10px] uppercase text-neutral-400 block">Offline Self-Test</span>
              <div>
                <button
                  type="button"
                  onClick={handleRunSelfTest}
                  disabled={testing}
                  className="px-3 py-1 bg-indigo-700 text-white rounded font-mono text-[11px] uppercase tracking-wider font-semibold hover:bg-indigo-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {testing ? 'Testing...' : 'Run Test'}
                </button>
              </div>
              <span className="font-mono text-[10px] text-neutral-500 block">Fact assertions test</span>
            </div>
          </div>

          {testResult && (
            <div
              className={`p-4 rounded-xl border font-mono text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* SECTION 2: VERIFICATION & MODEL SETTINGS */}
        <form onSubmit={handleSave} className="bg-white border border-[#e5e5e5] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-2.5">
              <Sliders className="w-5 h-5 text-indigo-700" />
              <h2 className="font-display text-xl text-dark">Verification & Reranker Configuration</h2>
            </div>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-dark flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-600 mb-1.5">
                Entailment Threshold: {config.entailment_threshold}
              </label>
              <input
                type="range"
                min="0.30"
                max="0.85"
                step="0.05"
                value={config.entailment_threshold}
                onChange={(e) =>
                  setConfig({ ...config, entailment_threshold: parseFloat(e.target.value) })
                }
                className="w-full accent-indigo-700"
              />
              <span className="text-[11px] text-neutral-400 font-sans block mt-1">
                Lower bound for NLI premise support.
              </span>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-600 mb-1.5">
                Top-K Premise Sentences: {config.top_k_premise}
              </label>
              <input
                type="number"
                min="1"
                max="8"
                value={config.top_k_premise}
                onChange={(e) =>
                  setConfig({ ...config, top_k_premise: parseInt(e.target.value, 10) })
                }
                className="w-full p-2 border border-neutral-300 rounded-lg text-sm bg-white"
              />
              <span className="text-[11px] text-neutral-400 font-sans block mt-1">
                Number of source sentences mapped per claim.
              </span>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-600 mb-1.5">
                Default Beam Candidates: {config.n_candidates}
              </label>
              <input
                type="number"
                min="2"
                max="8"
                value={config.n_candidates}
                onChange={(e) =>
                  setConfig({ ...config, n_candidates: parseInt(e.target.value, 10) })
                }
                className="w-full p-2 border border-neutral-300 rounded-lg text-sm bg-white"
              />
              <span className="text-[11px] text-neutral-400 font-sans block mt-1">
                Abstractive candidate beams generated.
              </span>
            </div>
          </div>

          {/* Path Guard (Read-Only) */}
          <div className="pt-4 border-t border-neutral-100 space-y-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-neutral-700 font-semibold">
              Storage & Cache Directory (Path Guard Enforced)
            </label>
            <input
              type="text"
              value={config.cache_root}
              readOnly
              className="w-full p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600 font-mono text-xs"
            />
            <p className="text-[11px] font-sans text-neutral-500 leading-relaxed">
              EquiSumm enforces a strict path guard to prevent primary system drive saturation. Model checkpoints and
              verification run logs are stored in the isolated cache partition.
            </p>
          </div>

          {saveMessage && (
            <div className="p-3 bg-neutral-100 rounded-lg font-mono text-xs text-neutral-800">
              {saveMessage}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-700 text-white font-mono text-xs uppercase tracking-widest font-semibold rounded-full hover:bg-indigo-800 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>

        {/* SECTION 3: ADVANCED BENCHMARK RUNNER */}
        <div className="bg-white border border-[#e5e5e5] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-indigo-700" />
              <div>
                <h2 className="font-display text-xl text-dark">Advanced Benchmark Evaluation</h2>
                <p className="text-xs text-neutral-500 font-sans">
                  Evaluate summarization accuracy across standard JSONL benchmark datasets.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-neutral-600 mb-1">
                Max Test Samples
              </label>
              <select
                value={evalSamples}
                onChange={(e) => setEvalSamples(Number(e.target.value))}
                className="p-2 border border-neutral-300 rounded-lg text-xs font-mono bg-white"
              >
                <option value={3}>3 Samples (Fast)</option>
                <option value={5}>5 Samples (Standard)</option>
                <option value={10}>10 Samples (Comprehensive)</option>
              </select>
            </div>

            <div className="pt-5">
              <button
                type="button"
                onClick={handleRunBenchmark}
                disabled={evaluating}
                className="px-5 py-2.5 bg-neutral-900 text-white rounded-lg font-mono text-xs uppercase tracking-wider font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{evaluating ? 'Running Benchmark...' : 'Run Benchmark'}</span>
              </button>
            </div>
          </div>

          {evalResult && (
            <div className="mt-4 p-5 rounded-xl border border-neutral-200 bg-neutral-50 space-y-3 font-mono text-xs">
              <div className="font-bold text-dark uppercase tracking-wider">
                Benchmark Results Summary
              </div>
              <pre className="p-3 bg-white border border-neutral-200 rounded text-[11px] overflow-x-auto text-neutral-800">
                {JSON.stringify(evalResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
