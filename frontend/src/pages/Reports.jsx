import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FileText,
  Search,
  Filter,
  Trash2,
  Download,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import { api } from '../api'
import { VerdictBadge } from '../components/VerdictBadge'

export function Reports() {
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [verdictFilter, setVerdictFilter] = useState('ALL')
  const [sortOrder, setSortOrder] = useState('date_desc')
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const loadReports = async () => {
    try {
      setLoading(true)
      const data = await api.listAnalyses({
        q: search,
        verdict: verdictFilter !== 'ALL' ? verdictFilter : undefined,
        sort: sortOrder,
      })
      setReports(data.reports || [])
    } catch (err) {
      console.error('Failed to load reports:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [sortOrder, verdictFilter])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    loadReports()
  }

  const handleDelete = async (id) => {
    try {
      setDeleting(true)
      await api.deleteAnalysis(id)
      setDeleteConfirmId(null)
      loadReports()
    } catch (err) {
      alert('Failed to delete report: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#fcfbf9] pt-28 pb-20 px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#e5e5e5] pb-6">
          <div className="space-y-2">
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-neutral-500">
              Audit Archives
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-normal text-dark">
              My Reports
            </h1>
            <p className="text-neutral-600 font-sans text-sm max-w-xl">
              Persisted verification audits, claim proofs, and exported compliance records.
            </p>
          </div>

          <Link
            to="/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-700 text-white font-mono text-xs uppercase tracking-widest font-semibold hover:bg-indigo-800 transition-colors shadow-sm"
          >
            <span>Start New Analysis</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports by title or content..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-300 text-xs font-sans focus:border-indigo-600 bg-white"
            />
          </form>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={verdictFilter}
              onChange={(e) => setVerdictFilter(e.target.value)}
              className="p-2 border border-neutral-300 rounded-lg text-xs font-mono uppercase bg-white focus:border-indigo-600"
            >
              <option value="ALL">All Outcomes</option>
              <option value="ACCEPT">Accept Only</option>
              <option value="ACCEPT_PRUNED">Accept (Pruned)</option>
              <option value="EXTRACTIVE_FALLBACK">Extractive Fallback</option>
              <option value="ESCALATE">Escalated</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="p-2 border border-neutral-300 rounded-lg text-xs font-mono uppercase bg-white focus:border-indigo-600"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="title">Alphabetical (Title)</option>
            </select>
          </div>
        </div>

        {/* Reports List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-white border border-neutral-200 animate-pulse"></div>
            ))}
          </div>
        ) : reports.length > 0 ? (
          <div className="space-y-4">
            {reports.map((r) => (
              <div
                key={r.id}
                className="p-6 bg-white border border-[#e5e5e5] rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div
                  onClick={() => navigate(`/reports/${r.id}`)}
                  className="space-y-2 cursor-pointer flex-1"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-400">
                      [{r.domain || 'general'}] · {r.id}
                    </span>
                    <VerdictBadge status={r.outcome} size="xs" />
                  </div>

                  <h3 className="font-display text-xl text-dark hover:text-indigo-900 transition-colors">
                    {r.title}
                  </h3>

                  <div className="flex items-center gap-6 text-xs font-mono text-neutral-500">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      {new Date(r.createdAt).toLocaleDateString()} at{' '}
                      {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>·</span>
                    <span>{r.sentenceCount} Claims Verified</span>
                    <span>·</span>
                    <span>{(r.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <a
                    href={api.exportUrl(r.id, 'markdown')}
                    download
                    title="Export Markdown"
                    className="p-2 border border-neutral-200 rounded-lg text-neutral-600 hover:text-dark hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => setDeleteConfirmId(r.id)}
                    title="Delete Report"
                    className="p-2 border border-neutral-200 rounded-lg text-neutral-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <Link
                    to={`/reports/${r.id}`}
                    className="px-4 py-2 rounded-lg bg-neutral-900 text-white font-mono text-xs uppercase tracking-wider hover:bg-neutral-800 transition-colors"
                  >
                    View Report →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-16 text-center rounded-2xl border border-dashed border-neutral-300 bg-white max-w-lg mx-auto space-y-4">
            <FileText className="w-10 h-10 text-neutral-400 mx-auto" />
            <h3 className="font-display text-2xl text-dark">No reports match your filters</h3>
            <p className="text-neutral-500 text-sm">
              Try adjusting your search terms or generate a new analysis from a document.
            </p>
            <Link
              to="/new"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-indigo-700 text-white font-mono text-xs uppercase tracking-widest font-semibold hover:bg-indigo-800 transition-colors"
            >
              Start New Analysis
            </Link>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-6 z-50 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-neutral-200 shadow-xl">
              <h3 className="font-display text-xl text-dark">Confirm Deletion</h3>
              <p className="text-sm font-sans text-neutral-600 leading-relaxed">
                Are you sure you want to permanently delete report <span className="font-mono font-bold text-dark">{deleteConfirmId}</span>? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg border border-neutral-300 text-xs font-mono uppercase tracking-wider text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-mono uppercase tracking-wider hover:bg-rose-700 cursor-pointer disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Report'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
