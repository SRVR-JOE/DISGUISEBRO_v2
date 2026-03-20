/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        d3: {
          bg: '#0A0E17',
          'bg-secondary': '#111827',
          'bg-tertiary': '#1E293B',
          cyan: '#00F0FF',
          green: '#00FF88',
          warning: '#FFB800',
          critical: '#FF3B3B',
          text: '#F1F5F9',
          'text-secondary': '#94A3B8',
          magenta: '#E91E8C',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
        heading: ['Rajdhani', 'Orbitron', 'sans-serif'],
        body: ['IBM Plex Sans', 'sans-serif'],
        hud: ['Share Tech Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan-line': 'scanLine 4s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px currentColor' },
          '100%': { boxShadow: '0 0 20px currentColor' },
        },
      },
    },
  },
  plugins: [],
};
