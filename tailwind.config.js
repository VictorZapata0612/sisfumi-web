/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-black': '#0a0a0a',
        // Recreando tu paleta de colores de la app original
        'brand-red': {
          DEFAULT: '#d60000',
          dark: '#b00000',
        },
        gray: {
          900: '#1a202c',
          800: '#2d3748',
          700: '#4a5568',
          600: '#718096',
          500: '#a0aec0',
          400: '#cbd5e0',
          300: '#e2e8f0',
        },
        red: {
          500: '#ef4444', // <-- AÑADE ESTA LÍNEA. Es el tono 500 estándar de Tailwind.
          600: '#c53030',
          700: '#9b2c2c',
        },
      },
      animation: {
        'infinite-scroll': 'infinite-scroll 40s linear infinite',
        'progress-bar': 'progress-bar-fill 7s linear forwards',
      },
      keyframes: {
        'infinite-scroll': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-100%)' },
        },
        'progress-bar-fill': {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
      },
    },
  },
  plugins: [],
}
