/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bbddfc',
          300: '#7cc0fa',
          400: '#389df6',
          500: '#0d7fe7',
          600: '#0262be',
          700: '#034e9a',
          800: '#07437e',
          900: '#0c3969',
          950: '#082447',
        },
        dark: {
          50: '#f6f6f7',
          100: '#eef0f2',
          200: '#d9dde3',
          300: '#b7bec8',
          400: '#8f9aa7',
          500: '#707c8d',
          600: '#586475',
          700: '#475160',
          800: '#2c323c',
          900: '#1b1f25',
          950: '#0d0f12', // Rich background color
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(15px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
