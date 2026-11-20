const API_ROOT = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

async function request(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, options)
  if (!response.ok) {
    let errorDetail = `Request failed (${response.status})`
    try {
      const data = await response.json()
      if (data.detail) {
        if (typeof data.detail === 'object') {
          errorDetail = data.detail.message || JSON.stringify(data.detail)
        } else {
          errorDetail = data.detail
        }
      }
    } catch {
      // fallback to status text
    }
    const err = new Error(errorDetail)
    err.status = response.status
    throw err
  }
  if (response.status === 204) return null
  return response.json()
}

export const api = {
  health: () => request('/health'),
  samples: () => request('/samples'),
  sample: (id) => request(`/samples/${id}`),

  // Analyses
  createAnalysis: async (data) => {
    if (data instanceof FormData) {
      return request('/analyses', { method: 'POST', body: data })
    }
    return request('/analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },
  getAnalysis: (id) => request(`/analyses/${id}`),
  cancelAnalysis: (id) => request(`/analyses/${id}/cancel`, { method: 'POST' }),
  getReport: (id) => request(`/analyses/${id}/report`),
  listAnalyses: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.sort) qs.set('sort', params.sort)
    if (params.verdict) qs.set('verdict', params.verdict)
    const qStr = qs.toString()
    return request(`/analyses${qStr ? `?${qStr}` : ''}`)
  },
  deleteAnalysis: (id) => request(`/analyses/${id}`, { method: 'DELETE' }),
  exportUrl: (id, format = 'markdown') => `${API_ROOT}/analyses/${id}/export?format=${format}`,

  // Evaluation & Telemetry
  evaluate: (payload) =>
    request('/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  getEvaluation: (id) => request(`/evaluate/${id}`),
  system: () => request('/system'),
  selfTest: () => request('/system/self-test', { method: 'POST' }),
  flushCache: () => request('/system/flush-cache', { method: 'POST' }),
  settings: () => request('/settings'),
  saveSettings: (payload) =>
    request('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
}
