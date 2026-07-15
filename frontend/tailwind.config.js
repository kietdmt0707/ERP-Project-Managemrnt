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
          50: 'var(--color-brand-50, #f0f7ff)',
          100: 'var(--color-brand-100, #e0effe)',
          200: 'var(--color-brand-200, #bbddfc)',
          300: 'var(--color-brand-300, #7cc0fa)',
          400: 'var(--color-brand-400, #389df6)',
          500: 'var(--color-brand-500, #0d7fe7)',
          600: 'var(--color-brand-600, #0262be)',
          700: 'var(--color-brand-700, #034e9a)',
          800: 'var(--color-brand-800, #07437e)',
          900: 'var(--color-brand-900, #0c3969)',
          950: 'var(--color-brand-950, #082447)',
        },
        dark: {
          50: 'var(--color-dark-50, #f6f6f7)',
          100: 'var(--color-dark-100, #eef0f2)',
          200: 'var(--color-dark-200, #d9dde3)',
          300: 'var(--color-dark-300, #b7bec8)',
          400: 'var(--color-dark-400, #8f9aa7)',
          500: 'var(--color-dark-500, #707c8d)',
          600: 'var(--color-dark-600, #586475)',
          700: 'var(--color-dark-700, #475160)',
          800: 'var(--color-dark-800, #2c323c)',
          900: 'var(--color-dark-900, #1b1f25)',
          950: 'var(--color-dark-950, #0d0f12)',
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
