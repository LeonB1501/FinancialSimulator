/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF4FF',
          100: '#D9E6FF',
          200: '#B3CEFF',
          300: '#7AAEFF',
          400: '#4A7FB5',
          500: '#2D5A87',
          600: '#1E3A5F',
          700: '#162D4A',
          800: '#0F1F33',
          900: '#0A1421',
        },
        accent: {
          50: '#E6FFF7',
          100: '#B3FFE8',
          200: '#80FFD9',
          300: '#4DFFCA',
          400: '#00F5C4',
          500: '#00D4AA',
          600: '#00A080',
          700: '#007A62',
          800: '#005444',
          900: '#002E26',
        },
        surface: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
        'medium': '0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
        'large': '0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
        'glow': '0 0 20px rgba(0, 212, 170, 0.3)',
        'soft-dark': '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        'medium-dark': '0 4px 6px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)',
        'large-dark': '0 10px 15px rgba(0,0,0,0.3), 0 4px 6px rgba(0,0,0,0.2)',
      }
    },
  },
  plugins: [],
}
