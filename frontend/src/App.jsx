import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Header } from './components/Header'
import { Home } from './pages/Home'
import { NewAnalysis } from './pages/NewAnalysis'
import { Processing } from './pages/Processing'
import { Report } from './pages/Report'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'

export default function App() {
  return (
    <div className="min-h-screen bg-[#fcfbf9] text-[#171717] font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<NewAnalysis />} />
          <Route path="/processing/:id" element={<Processing />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/:id" element={<Report />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
