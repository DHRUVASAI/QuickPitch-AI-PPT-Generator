/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        heading: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        body: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          50: '#fff1f3',
          100: '#ffe4e7',
          200: '#fecdce',
          300: '#fda4a8',
          400: '#fb7177',
          500: '#ff2a55',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519',
        },
        dark: {
          bg: '#07090e',
          surface: '#0d121e',
          card: '#121827',
          border: 'rgba(255, 255, 255, 0.08)',
          muted: '#8e9bb0',
        },
      },
      boxShadow: {
        'glow-brand': '0 0 35px -5px rgba(255, 42, 85, 0.35)',
        'glow-cyan': '0 0 35px -5px rgba(56, 189, 248, 0.35)',
        'glow-emerald': '0 0 35px -5px rgba(16, 185, 129, 0.35)',
        'glass-card': '0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
    },
  },
  daisyui: {
    themes: ['dark'],
    logs: false,
  },
  plugins: [require('daisyui')],
}
