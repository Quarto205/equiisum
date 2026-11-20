/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#fcfbf9',
          50: '#ffffff',
          100: '#fcfbf9',
          200: '#f5f4ef',
          300: '#eae7df',
        },
        dark: {
          DEFAULT: '#171717',
          card: '#1e1e1e',
          surface: '#121212',
          border: '#2a2a2a',
        },
        indigo: {
          DEFAULT: '#4338ca',
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
        },
        verdict: {
          supported: '#16a34a',
          'supported-bg': '#f0fdf4',
          'supported-border': '#bbf7d0',
          flagged: '#d97706',
          'flagged-bg': '#fffbeb',
          'flagged-border': '#fde68a',
          removed: '#dc2626',
          'removed-bg': '#fef2f2',
          'removed-border': '#fecaca',
          escalate: '#991b1b',
          'escalate-bg': '#fff1f2',
          'escalate-border': '#fecdd3',
          neutral: '#737373',
          'neutral-bg': '#f5f5f5',
          'neutral-border': '#e5e5e5',
        },
        border: {
          DEFAULT: '#e5e5e5',
          muted: '#f0f0f0',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        body: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      transitionTimingFunction: {
        organic: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        meshDrift: {
          '0%': { transform: 'scale(1) translate(0%, 0%) rotate(0deg)' },
          '50%': { transform: 'scale(1.15) translate(-3%, 3%) rotate(2deg)' },
          '100%': { transform: 'scale(1) translate(0%, 0%) rotate(0deg)' },
        },
        buttonPulse: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(67, 56, 202, 0.2)' },
          '50%': { transform: 'scale(1.02)', boxShadow: '0 10px 25px -5px rgba(67, 56, 202, 0.4)' },
        },
        reveal: {
          '0%': { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'mesh-drift': 'meshDrift 30s linear infinite',
        'btn-pulse': 'buttonPulse 3s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'scroll-reveal': 'reveal 1000ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
      },
    },
  },
  plugins: [],
}
