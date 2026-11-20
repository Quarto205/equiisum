import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import VerdictBadge from '../components/VerdictBadge'

describe('VerdictBadge', () => {
  it('renders ACCEPT verdict badge with text and correct classes', () => {
    render(<VerdictBadge status="ACCEPT" />)
    expect(screen.getByText('Accept (Verified)')).toBeInTheDocument()
  })

  it('renders ACCEPT_PRUNED verdict badge', () => {
    render(<VerdictBadge status="ACCEPT_PRUNED" />)
    expect(screen.getByText('Accept (Pruned)')).toBeInTheDocument()
  })

  it('renders EXTRACTIVE_FALLBACK verdict badge', () => {
    render(<VerdictBadge status="EXTRACTIVE_FALLBACK" />)
    expect(screen.getByText('Extractive Fallback')).toBeInTheDocument()
  })

  it('renders ESCALATE verdict badge with warning label', () => {
    render(<VerdictBadge status="ESCALATE" />)
    expect(screen.getByText('Escalate for Review')).toBeInTheDocument()
  })

  it('renders SUPPORTED status badge', () => {
    render(<VerdictBadge status="SUPPORTED" />)
    expect(screen.getByText('Supported')).toBeInTheDocument()
  })
})
