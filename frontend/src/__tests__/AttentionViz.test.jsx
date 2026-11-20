import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { AttentionHeatmap, CoverageBar, SentenceEmbeddingScatter } from '../components/AttentionViz'

describe('AttentionViz components', () => {
  it('renders fallback when matrix is empty', () => {
    render(<AttentionHeatmap matrix={[]} />)
    expect(screen.getByText(/No attention matrix data available/i)).toBeInTheDocument()
  })

  it('renders AttentionHeatmap with cells', () => {
    const matrix = [
      [0.9, 0.1],
      [0.2, 0.8],
    ]
    render(
      <AttentionHeatmap
        matrix={matrix}
        summarySentences={[{ text: 'Sum 1' }, { text: 'Sum 2' }]}
        sourceSentences={[{ text: 'Src 1' }, { text: 'Src 2' }]}
      />
    )
    expect(screen.getByText(/Summary Sentences \(rows\) vs Source Premises/i)).toBeInTheDocument()
  })

  it('renders CoverageBar with items', () => {
    const coverage = [0.85, 0.12, 0.02]
    render(
      <CoverageBar
        coverage={coverage}
        sourceSentences={[{ text: 'P1' }, { text: 'P2' }, { text: 'P3' }]}
      />
    )
    expect(screen.getByText(/Source Document Coverage Distribution/i)).toBeInTheDocument()
    expect(screen.getByText(/3 source sentences/i)).toBeInTheDocument()
  })

  it('renders SentenceEmbeddingScatter with points', () => {
    const points = [
      { x: 10, y: 15, kind: 'source', text: 'Src sentence 1', status: 'source' },
      { x: 20, y: 25, kind: 'summary', text: 'Sum sentence 1', status: 'supported', index: 1 },
      { x: 30, y: 35, kind: 'summary', text: 'Sum sentence 2', status: 'flagged', index: 2 },
      { x: 40, y: 45, kind: 'source', text: 'Src sentence 2', status: 'source' },
    ]
    render(<SentenceEmbeddingScatter points={points} />)
    expect(screen.getByText(/2D t-SNE Sentence Embeddings Projection/i)).toBeInTheDocument()
    expect(screen.getByText('S1')).toBeInTheDocument()
    expect(screen.getByText('S2')).toBeInTheDocument()
  })
})
