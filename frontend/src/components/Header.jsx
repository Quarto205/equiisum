import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Activity, RefreshCw } from 'lucide-react'
import { api } from '../api'

export function Header() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  const [systemState, setSystemState] = useState({
    status: 'checking',
    device: 'cpu',
    models_loaded: false,
  })

  const checkHealth = async () => {
    try {
      const data = await api.health()
      setSystemState(data)
    } catch {
      setSystemState({ status: 'offline', device: 'unknown', models_loaded: false })
    }
  }

  useEffect(() => {
    checkHealth()
    const timer = setInterval(checkHealth, 10000)
    return () => clearInterval(timer)
  }, [])

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'New Analysis', path: '/new' },
    { label: 'My Reports', path: '/reports' },
    { label: 'Settings', path: '/settings' },
  ]

  return (
    <header
      className={`fixed top-0 left-0 right-0 h-20 z-50 transition-colors duration-300 ${
        isHome
          ? 'bg-transparent text-dark'
          : 'bg-[#fcfbf9]/95 backdrop-blur-md border-b border-[#e5e5e5] text-dark'
      }`}
    >
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <span className="font-display italic text-2xl md:text-3xl font-bold tracking-tight text-dark group-hover:text-indigo transition-colors">
            EquiSumm
          </span>
        </Link>

        {/* 4 Primary Navigation Links Only */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link text-xs tracking-[0.2em] uppercase font-mono font-medium py-1 ${
                  isActive ? 'text-indigo-700 active font-semibold' : 'text-neutral-700 hover:text-dark'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

      </div>
    </header>
  )
}
