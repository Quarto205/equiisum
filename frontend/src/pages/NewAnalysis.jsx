import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload,
  FileText,
  Sparkles,
  ArrowRight,
  Sliders,
  CheckCircle,
  AlertCircle,
  FileUp,
} from 'lucide-react'
import { api } from '../api'

export function NewAnalysis() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('upload') // 'upload' | 'paste' | 'samples'
  const [file, setFile] = useState(null)
  const [text, setText] = useState('')
  const [domain, setDomain] = useState('general')
  const [nCandidates, setNCandidates] = useState(4)
  const [device, setDevice] = useState('auto')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [samples, setSamples] = useState([])
  const [loadingSamples, setLoadingSamples] = useState(false)

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    async function fetchSamples() {
      try {
        setLoadingSamples(true)
        const list = await api.samples()
        setSamples(list.slice(0, 4)) // 4 bundled starter samples
      } catch (err) {
        console.error('Failed to load samples:', err)
      } finally {
        setLoadingSamples(false)
      }
    }
    fetchSamples()
  }, [])

  const handleFileDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0])
    }
  }

  const handleFileSelected = (selectedFile) => {
    setError(null)
    const suffix = selectedFile.name.split('.').pop().toLowerCase()
    if (!['txt', 'pdf'].includes(suffix)) {
      setError('Unsupported file type. Please upload a .txt or .pdf file.')
      return
    }
    if (selectedFile.size > 20 * 1024 * 1024) {
      setError('File exceeds 20 MB size limit.')
      return
    }
    setFile(selectedFile)

    // Quick text preview for .txt
    if (suffix === 'txt') {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setText(ev.target.result || '')
      }
      reader.readAsText(selectedFile)
    } else {
      setText(`[PDF Document: ${selectedFile.name} — ${Math.round(selectedFile.size / 1024)} KB]`)
    }
  }

  const loadSample = async (sampleId, sampleDomain) => {
    setError(null)
    setFile(null)
    setDomain(sampleDomain || 'general')
    try {
      const data = await api.sample(sampleId)
      setText(data.text)
      setTab('paste')
    } catch (err) {
      setError('Failed to load sample: ' + err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!file && !text.trim()) {
      setError('Please provide text or upload a .txt or .pdf document.')
      return
    }

    try {
      setSubmitting(true)
      let res
      if (file) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('domain', domain)
        formData.append('n_candidates', nCandidates)
        if (device !== 'auto') formData.append('device', device)
        res = await api.createAnalysis(formData)
      } else {
        res = await api.createAnalysis({
          text,
          domain,
          n_candidates: nCandidates,
          device: device !== 'auto' ? device : undefined,
        })
      }

      if (res && res.id) {
        navigate(`/processing/${res.id}`)
      } else {
        throw new Error('No analysis ID returned from backend.')
      }
    } catch (err) {
      setError(err.message || 'Failed to submit analysis.')
    } finally {
      setSubmitting(false)
    }
  }

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0

  return (
    <div className="min-h-screen bg-[#fcfbf9] pt-28 pb-20 px-6">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header */}
        <div className="space-y-2 border-b border-[#e5e5e5] pb-6">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
            Document Ingestion
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-normal text-dark">
            Start New Analysis
          </h1>
          <p className="text-neutral-600 font-sans text-sm max-w-2xl leading-relaxed">
            Upload a legal contract, financial earnings release, or legislative text. EquiSumm
            will draft candidates and verify every claim against the source.
          </p>
        </div>

        {/* 4 Bundled Samples Quick Starters */}
        <div className="space-y-3">
          <span className="font-mono text-xs uppercase tracking-wider text-neutral-500 block">
            Or Quick-Load a Bundled Benchmark Document:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {samples.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loadSample(s.id, s.domain)}
                className="p-3 text-left bg-white border border-[#e5e5e5] rounded-xl hover:border-indigo-400 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="font-mono text-[10px] text-indigo-700 uppercase tracking-widest mb-1">
                  [{s.domain}]
                </div>
                <div className="font-sans text-xs font-semibold text-neutral-900 group-hover:text-indigo-900 line-clamp-1">
                  {s.name}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tabs: Upload / Paste */}
        <div className="bg-white border border-[#e5e5e5] rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-[#e5e5e5] bg-[#faf9f6]">
            <button
              type="button"
              onClick={() => setTab('upload')}
              className={`flex-1 py-4 px-6 text-xs font-mono uppercase tracking-widest font-semibold flex items-center justify-center gap-2 border-r border-[#e5e5e5] transition-colors cursor-pointer ${
                tab === 'upload'
                  ? 'bg-white text-indigo-700 border-b-2 border-b-indigo-700'
                  : 'text-neutral-600 hover:text-dark'
              }`}
            >
              <FileUp className="w-4 h-4" />
              <span>Upload Document (.txt, .pdf)</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('paste')}
              className={`flex-1 py-4 px-6 text-xs font-mono uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                tab === 'paste'
                  ? 'bg-white text-indigo-700 border-b-2 border-b-indigo-700'
                  : 'text-neutral-600 hover:text-dark'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Paste Text Directly</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {tab === 'upload' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : file
                    ? 'border-emerald-300 bg-emerald-50/30'
                    : 'border-neutral-300 hover:border-neutral-400 bg-[#faf9f6]/50'
                }`}
              >
                <input
                  type="file"
                  id="doc-upload"
                  accept=".txt,.pdf"
                  onChange={(e) => e.target.files && handleFileSelected(e.target.files[0])}
                  className="hidden"
                />
                <label htmlFor="doc-upload" className="cursor-pointer space-y-3 block">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  {file ? (
                    <div className="space-y-1">
                      <div className="font-mono text-xs uppercase tracking-wider text-emerald-700 font-semibold flex items-center justify-center gap-1.5">
                        <CheckCircle className="w-4 h-4" /> File Selected: {file.name}
                      </div>
                      <div className="text-xs text-neutral-500 font-mono">
                        {(file.size / 1024).toFixed(1)} KB · Ready for analysis
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="font-sans text-sm font-medium text-dark">
                        Drag and drop your document here, or <span className="text-indigo-700 underline">browse files</span>
                      </div>
                      <div className="text-xs font-mono text-neutral-500">
                        Supports PDF and plain text up to 20 MB
                      </div>
                    </div>
                  )}
                </label>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                  <label htmlFor="doc-text" className="uppercase tracking-wider">
                    Source Document Text
                  </label>
                  <span>{wordCount} Words</span>
                </div>
                <textarea
                  id="doc-text"
                  rows={10}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste legal contract clauses, earnings release statements, or legislative bills here..."
                  className="w-full p-4 rounded-xl border border-neutral-300 font-sans text-sm leading-relaxed focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 bg-white"
                />
              </div>
            )}

            {/* Document Details & Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-600 mb-1.5">
                  Document Domain
                </label>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-neutral-300 text-sm font-sans bg-white focus:border-indigo-600"
                >
                  <option value="financial">Financial (Earnings / Form 10-Q)</option>
                  <option value="legal">Legal (Contract / Master Agreement)</option>
                  <option value="general">Legislative / General Public Policy</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-600 mb-1.5">
                  Beam Search Candidates
                </label>
                <select
                  value={nCandidates}
                  onChange={(e) => setNCandidates(Number(e.target.value))}
                  className="w-full p-2.5 rounded-lg border border-neutral-300 text-sm font-sans bg-white focus:border-indigo-600"
                >
                  <option value={2}>2 Candidates (Fastest)</option>
                  <option value={4}>4 Candidates (Recommended)</option>
                  <option value={6}>6 Candidates (Deep Beam)</option>
                </select>
              </div>
            </div>

            {/* Advanced Disclosure */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs font-mono uppercase tracking-wider text-neutral-500 hover:text-dark flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{showAdvanced ? 'Hide Advanced Settings' : 'Advanced Settings'}</span>
              </button>

              {showAdvanced && (
                <div className="mt-3 p-4 bg-[#faf9f6] rounded-xl border border-neutral-200 text-xs font-mono space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span>Inference Execution Device</span>
                    <select
                      value={device}
                      onChange={(e) => setDevice(e.target.value)}
                      className="p-1.5 border border-neutral-300 rounded bg-white text-xs"
                    >
                      <option value="auto">Auto (CUDA if available)</option>
                      <option value="cpu">CPU Mode Only (Safest VRAM)</option>
                      <option value="cuda">Force GPU (CUDA)</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-neutral-500 font-sans">
                    All processing occurs locally on this machine under strict path isolation.
                  </p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-mono flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Action */}
            <div className="pt-4 flex items-center justify-end">
              <button
                type="submit"
                disabled={submitting || (!file && !text.trim())}
                className="px-8 py-3.5 rounded-full bg-indigo-700 text-white font-mono text-xs uppercase tracking-widest font-semibold hover:bg-indigo-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer shadow-md hover:shadow-indigo-500/20"
              >
                <span>{submitting ? 'Submitting Job...' : 'Start Verification Analysis'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
