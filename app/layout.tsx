import React from "react"
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Agentic // Autonomous AI Agents & Verification Platform',
  description: 'Deploy autonomous AI agents that think, act, summarize and audit complex workflows with real-time verification and zero boilerplate.',
  keywords: ['AI agents', 'autonomous agents', 'LLM orchestration', 'EquiSumm', 'verification', 'multi-agent platform'],
  authors: [{ name: 'Agentic' }],
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <head>
        <meta name="theme-color" content="#050505" />
      </head>
      <body className="font-sans antialiased bg-[#050505] text-[#e5e5e5] min-h-screen selection:bg-emerald-500/30 selection:text-emerald-300">
        {children}
      </body>
    </html>
  )
}
