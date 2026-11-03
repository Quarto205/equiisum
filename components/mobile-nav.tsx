"use client"

import { useState } from "react"

const NAV_LINKS = [
  { label: "Platform",     href: "#platform" },
  { label: "Agents",       href: "#agents" },
  { label: "Workflow",     href: "#workflow" },
  { label: "Integrations", href: "#integrations" },
  { label: "Security",     href: "#security" },
  { label: "DevEx",        href: "#devex" },
  { label: "Pricing",      href: "#pricing" },
]

const NAV_STYLE = {
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  background: "rgba(10, 12, 16, 0.85)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.6), 0 0 15px rgba(74,222,128,0.06)",
} as const

export function MobileNav() {
  const [open, setOpen] = useState(false)

  const close = () => setOpen(false)

  return (
    <header className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none" role="banner">
      <div className="pointer-events-auto w-full max-w-4xl">

        {/* Main bar */}
        <nav
          className="flex items-center justify-between px-5 py-3 rounded-2xl border border-white/10"
          style={NAV_STYLE}
          aria-label="Main Navigation"
        >
          <a href="#" className="flex items-center gap-2 group">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#4ade80]" />
            <span className="font-mono text-xs tracking-[0.25em] text-white/90 group-hover:text-emerald-400 transition-colors">
              AGENTIC<span className="text-emerald-400/80 font-mono text-[10px] ml-1">::DEV</span>
            </span>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6 font-mono text-xs">
            {NAV_LINKS.map(l => (
              <a
                key={l.label}
                href={l.href}
                className="text-white/60 hover:text-emerald-400 transition-colors duration-200 tracking-wider"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#pricing"
              className="text-[11px] font-mono px-4 py-2 rounded-xl border border-emerald-500/40 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-500/20 hover:border-emerald-400 transition-all duration-200 tracking-wider hidden md:inline-block shadow-[0_0_10px_rgba(74,222,128,0.15)]"
            >
              DEPLOY AGENT
            </a>

            {/* Burger — mobile only */}
            <button
              onClick={() => setOpen(v => !v)}
              className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-[5px] rounded-lg hover:bg-white/[0.08] transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-400"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              <span
                className="block h-[1.5px] bg-white/80 transition-all duration-300 origin-center"
                style={{
                  width: "18px",
                  transform: open ? "translateY(6.5px) rotate(45deg)" : "none",
                }}
              />
              <span
                className="block h-[1.5px] bg-white/80 transition-all duration-300"
                style={{
                  width: "18px",
                  opacity: open ? 0 : 1,
                  transform: open ? "scaleX(0)" : "none",
                }}
              />
              <span
                className="block h-[1.5px] bg-white/80 transition-all duration-300 origin-center"
                style={{
                  width: "18px",
                  transform: open ? "translateY(-6.5px) rotate(-45deg)" : "none",
                }}
              />
            </button>
          </div>
        </nav>

        {/* Mobile dropdown */}
        <div
          className="md:hidden mt-2 overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: open ? "400px" : "0px", opacity: open ? 1 : 0 }}
        >
          <div
            className="rounded-2xl border border-white/10 px-3 py-3 flex flex-col gap-1"
            style={NAV_STYLE}
          >
            {NAV_LINKS.map(l => (
              <a
                key={l.label}
                href={l.href}
                onClick={close}
                className="px-4 py-2.5 text-sm font-mono text-white/70 hover:text-emerald-400 hover:bg-white/[0.04] rounded-xl transition-colors tracking-wide"
              >
                {l.label}
              </a>
            ))}
            <div className="pt-2 border-t border-white/10 mt-1">
              <a
                href="#pricing"
                onClick={close}
                className="block text-center py-2.5 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/20 transition-all"
              >
                DEPLOY AGENT →
              </a>
            </div>
          </div>
        </div>

      </div>
    </header>
  )
}
