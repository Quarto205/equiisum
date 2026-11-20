import React from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Scissors,
  FileSearch,
  Flag,
  MinusCircle,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'

export function VerdictBadge({ status, size = 'sm', className = '' }) {
  const norm = String(status || '').toUpperCase()

  let icon = <CheckCircle2 className="w-3.5 h-3.5" />
  let label = norm
  let styleClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200'

  if (norm === 'SUPPORTED' || norm === 'VERIFIED') {
    icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
    label = norm === 'VERIFIED' ? 'Verified' : 'Supported'
    styleClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200'
  } else if (norm === 'FLAGGED' || norm === 'WEAK_SUPPORT') {
    icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
    label = 'Flagged'
    styleClasses = 'bg-amber-50 text-amber-900 border-amber-200'
  } else if (norm === 'REMOVED') {
    icon = <MinusCircle className="w-3.5 h-3.5 text-rose-600" />
    label = 'Removed'
    styleClasses = 'bg-rose-50 text-rose-800 border-rose-200 line-through'
  } else if (norm === 'CONTRADICTED' || norm === 'DIRECTION_CONFLICT') {
    icon = <XCircle className="w-3.5 h-3.5 text-rose-600" />
    label = norm === 'DIRECTION_CONFLICT' ? 'Direction Conflict' : 'Contradicted'
    styleClasses = 'bg-rose-50 text-rose-800 border-rose-200'
  } else if (norm === 'SCALE_MISMATCH') {
    icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
    label = 'Scale Mismatch'
    styleClasses = 'bg-amber-50 text-amber-900 border-amber-200'
  } else if (norm === 'CURRENCY_MISMATCH') {
    icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
    label = 'Currency Mismatch'
    styleClasses = 'bg-amber-50 text-amber-900 border-amber-200'
  } else if (norm === 'PERCENT_MISMATCH') {
    icon = <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
    label = 'Percent Mismatch'
    styleClasses = 'bg-amber-50 text-amber-900 border-amber-200'
  } else if (norm === 'UNSUPPORTED_ENTITY' || norm === 'NUMERIC_UNSUPPORTED') {
    icon = <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
    label = norm === 'UNSUPPORTED_ENTITY' ? 'Unsupported Entity' : 'Unsupported Number'
    styleClasses = 'bg-amber-50 text-amber-900 border-amber-200'
  } else if (norm === 'ACCEPT') {
    icon = <ShieldCheck className="w-4 h-4 text-emerald-600" />
    label = 'Accept (Verified)'
    styleClasses = 'bg-emerald-50 text-emerald-900 border-emerald-300 font-medium'
  } else if (norm === 'ACCEPT_PRUNED') {
    icon = <Scissors className="w-4 h-4 text-amber-600" />
    label = 'Accept (Pruned)'
    styleClasses = 'bg-amber-50 text-amber-950 border-amber-300 font-medium'
  } else if (norm === 'EXTRACTIVE_FALLBACK') {
    icon = <FileSearch className="w-4 h-4 text-indigo-600" />
    label = 'Extractive Fallback'
    styleClasses = 'bg-indigo-50 text-indigo-950 border-indigo-200 font-medium'
  } else if (norm === 'ESCALATE') {
    icon = <ShieldAlert className="w-4 h-4 text-rose-700" />
    label = 'Escalate for Review'
    styleClasses = 'bg-rose-50 text-rose-950 border-rose-300 font-medium'
  }

  const sizeClasses =
    size === 'lg'
      ? 'px-3 py-1.5 text-sm gap-2'
      : size === 'xs'
      ? 'px-1.5 py-0.5 text-[11px] gap-1'
      : 'px-2.5 py-1 text-xs gap-1.5'

  return (
    <span
      className={`inline-flex items-center font-mono uppercase tracking-wider rounded-md border ${styleClasses} ${sizeClasses} ${className}`}
    >
      {icon}
      <span>{label}</span>
    </span>
  )
}

export default VerdictBadge

