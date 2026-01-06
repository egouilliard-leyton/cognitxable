import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fbff',
          100: '#dbf5ff',
          200: '#b7ebff',
          300: '#84ddff',
          400: '#4ccaff',
          500: '#2bb3e6',
          600: '#1e9ecc',
          700: '#1676a0',
          800: '#0f506e',
          900: '#0b2c4b',
        },
        'bolt-bg-primary': '#0c0a14',
        'bolt-bg-secondary': '#15111e',
        'bolt-bg-tertiary': '#1e1a2a',
        'bolt-border-color': 'rgba(139, 92, 246, 0.2)',
        'bolt-text-primary': '#e5e2ff',
        'bolt-text-secondary': '#a8a4ce',
        'bolt-text-tertiary': '#6b6685',
      },
    },
  },
  plugins: [],
}
export default config
