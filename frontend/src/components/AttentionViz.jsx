import React, { useState } from 'react'

export function AttentionHeatmap({ matrix = [], summarySentences = [], sourceSentences = [], onSelectCell }) {
  const [hovered, setHovered] = useState(null)

  if (!matrix || matrix.length === 0 || !matrix[0] || matrix[0].length === 0) {
    return (
      <div className="p-8 text-center text-sm font-mono text-neutral-500 bg-neutral-50 rounded-lg border border-neutral-200">
        No attention matrix data available for this candidate.
      </div>
    )
  }

  const nSummary = matrix.length
  const nSource = matrix[0].length

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-4">
        <div className="inline-block min-w-full">
          <div className="flex items-center gap-2 mb-2 text-xs font-mono text-neutral-500 uppercase tracking-wider">
            <span>Summary Sentences (rows) vs Source Premises (columns)</span>
          </div>

          <div
            className="grid gap-1.5 p-3 bg-neutral-50 rounded-xl border border-neutral-200 shadow-inner"
            style={{
              gridTemplateColumns: `repeat(${nSource}, minmax(36px, 1fr))`,
            }}
          >
            {matrix.map((row, rIdx) =>
              row.map((weight, cIdx) => {
                const intensity = Math.min(1, Math.max(0, weight))
                const bgR = Math.round(67 * intensity + 245 * (1 - intensity))
                const bgG = Math.round(56 * intensity + 244 * (1 - intensity))
                const bgB = Math.round(202 * intensity + 239 * (1 - intensity))
                const isSelected =
                  hovered && hovered.row === rIdx && hovered.col === cIdx

                return (
                  <button
                    key={`${rIdx}-${cIdx}`}
                    onMouseEnter={() => setHovered({ row: rIdx, col: cIdx, weight })}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onSelectCell && onSelectCell(rIdx, cIdx)}
                    style={{
                      backgroundColor: `rgb(${bgR}, ${bgG}, ${bgB})`,
                      color: intensity > 0.45 ? '#ffffff' : '#312e81',
                    }}
                    className={`h-9 rounded-md flex items-center justify-center font-mono text-[11px] font-semibold transition-transform duration-150 focus:ring-2 focus:ring-indigo ${
                      isSelected ? 'ring-2 ring-indigo scale-110 z-10 shadow-md' : 'hover:scale-105'
                    }`}
                    aria-label={`Summary ${rIdx + 1} to Source ${cIdx + 1}: ${roundWeight(weight)}`}
                  >
                    {(intensity * 100).toFixed(0)}%
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Interactive Tooltip Card */}
      {hovered ? (
        <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs space-y-1.5 animate-fadeIn">
          <div className="flex items-center justify-between font-mono uppercase text-indigo-900 tracking-wider">
            <span>
              Summary #{hovered.row + 1} ➔ Source #{hovered.col + 1}
            </span>
            <span className="font-bold text-sm">
              {(hovered.weight * 100).toFixed(1)}% Attention Weight
            </span>
          </div>
          <div className="text-neutral-700">
            <span className="font-semibold text-neutral-900">Summary: </span>
            {summarySentences[hovered.row]?.text || `Sentence ${hovered.row + 1}`}
          </div>
          <div className="text-neutral-700">
            <span className="font-semibold text-neutral-900">Source Premise: </span>
            {sourceSentences[hovered.col]?.text || `Sentence ${hovered.col + 1}`}
          </div>
        </div>
      ) : (
        <div className="text-xs text-neutral-500 font-mono tracking-wide p-2 bg-neutral-100 rounded text-center">
          Hover over any grid cell to preview sentence attribution and attention weights.
        </div>
      )}
    </div>
  )
}

function roundWeight(w) {
  return (w * 100).toFixed(1) + '%'
}

export function CoverageBar({ coverage = [], sourceSentences = [] }) {
  const [active, setActive] = useState(null)

  if (!coverage || coverage.length === 0) {
    return null
  }

  const maxVal = Math.max(...coverage, 0.001)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-neutral-600">
        <span>Source Document Coverage Distribution</span>
        <span>{coverage.length} source sentences</span>
      </div>

      <div className="flex items-end gap-1 h-20 p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg overflow-x-auto">
        {coverage.map((val, idx) => {
          const heightPct = Math.max(8, (val / maxVal) * 100)
          const isIgnored = val < 0.05
          const isSelected = active === idx

          return (
            <div
              key={idx}
              onMouseEnter={() => setActive(idx)}
              onMouseLeave={() => setActive(null)}
              className="flex-1 min-w-[14px] flex flex-col justify-end items-center h-full group relative cursor-pointer"
            >
              <div
                style={{ height: `${heightPct}%` }}
                className={`w-full rounded-t transition-all duration-200 ${
                  isIgnored
                    ? 'bg-neutral-300 hover:bg-neutral-400'
                    : isSelected
                    ? 'bg-indigo-600 scale-105'
                    : 'bg-indigo-500 hover:bg-indigo-600'
                }`}
              />
              <span className="text-[9px] font-mono text-neutral-400 mt-1">
                {idx + 1}
              </span>
            </div>
          )
        })}
      </div>

      {active !== null && (
        <div className="p-3 bg-white border border-neutral-200 rounded-md text-xs shadow-sm">
          <div className="font-mono text-[11px] uppercase tracking-wider text-indigo-700 font-semibold mb-1">
            Source Sentence #{active + 1} — Coverage Score: {coverage[active].toFixed(3)}
            {coverage[active] < 0.05 && ' (Largely Ignored / Omitted in Summary)'}
          </div>
          <div className="text-neutral-700">
            {sourceSentences[active]?.text || `Sentence ${active + 1}`}
          </div>
        </div>
      )}
    </div>
  )
}

export function SentenceEmbeddingScatter({ points = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null)

  if (!points || points.length === 0) {
    return (
      <div className="p-8 text-center text-sm font-mono text-neutral-500 bg-neutral-50 rounded-lg border border-neutral-200">
        Embedding projection requires at least 4 sentences.
      </div>
    )
  }

  // Normalize points to SVG coordinates [40, 560] x [40, 360]
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-neutral-600">
        <span>2D t-SNE Sentence Embeddings Projection</span>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-400 inline-block"></span>
            Source
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            Supported Summary
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            Flagged Summary
          </span>
        </div>
      </div>

      <div className="relative border border-neutral-200 bg-white rounded-xl p-4 shadow-sm">
        <svg viewBox="0 0 600 400" className="w-full h-80">
          {/* Subtle Grid */}
          <line x1="40" y1="200" x2="560" y2="200" stroke="#f0f0f0" strokeDasharray="4" />
          <line x1="300" y1="40" x2="300" y2="360" stroke="#f0f0f0" strokeDasharray="4" />

          {/* Points */}
          {points.map((p, idx) => {
            const cx = 50 + ((p.x - minX) / rangeX) * 500
            const cy = 50 + ((p.y - minY) / rangeY) * 300
            const isSource = p.kind === 'source'
            const isFlagged = p.status === 'flagged'

            let fill = '#9ca3af'
            let r = 5
            if (!isSource) {
              r = 8
              fill = isFlagged ? '#f59e0b' : '#10b981'
            }
            const isHovered = hoveredPoint && hoveredPoint.idx === idx

            return (
              <g key={idx}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? r + 3 : r}
                  fill={fill}
                  stroke={isHovered ? '#1e1b4b' : '#ffffff'}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  className="transition-all duration-150 cursor-pointer"
                  onMouseEnter={() => setHoveredPoint({ ...p, idx, cx, cy })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                {!isSource && (
                  <text
                    x={cx}
                    y={cy - 10}
                    textAnchor="middle"
                    className="text-[9px] font-mono fill-neutral-700 font-bold pointer-events-none"
                  >
                    S{p.index || idx + 1}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {hoveredPoint && (
          <div className="mt-2 p-3 bg-neutral-900 text-white rounded-lg text-xs font-mono space-y-1">
            <div className="flex items-center justify-between text-indigo-300">
              <span className="uppercase font-bold">
                {hoveredPoint.kind === 'source' ? 'Source Sentence' : 'Summary Sentence'} #{hoveredPoint.index || hoveredPoint.idx + 1}
              </span>
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-white">
                Status: {hoveredPoint.status}
              </span>
            </div>
            <p className="font-sans text-neutral-300 text-xs leading-relaxed">
              {hoveredPoint.text}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
