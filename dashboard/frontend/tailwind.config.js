/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        base: '#0b0d12',
        surface: '#10131a',
        elevated: '#161b26',
        border: '#1e2535',
        hover: '#1c2232',
        primary: {
          DEFAULT: '#4f8ef7',
          glow: 'rgba(79, 142, 247, 0.18)',
        },
        danger: '#f75f5f',
        success: '#3dd68c',
        warning: '#f5a623',
        accent: '#a78bfa',
      },
      keyframes: {
        'pulse-green': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'pulse-yellow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'msg-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'none' },
        },
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'pulse-green': 'pulse-green 2s infinite',
        'pulse-yellow': 'pulse-yellow 1.2s infinite',
        'msg-in': 'msg-in 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
        'toast-in': 'toast-in 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        blink: 'blink 0.7s infinite',
        spin: 'spin 0.7s linear infinite',
      },
    },
  },
  plugins: [],
}
