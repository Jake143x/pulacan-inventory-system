/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 4px rgb(0 0 0 / 0.06), 0 4px 12px rgb(0 0 0 / 0.04), inset 0 1px 0 rgba(255 255 255 / 0.8)',
        cardHover: '0 12px 32px rgb(0 0 0 / 0.12), 0 6px 16px rgb(0 0 0 / 0.08), inset 0 1px 0 rgba(255 255 255 / 0.9)',
        'btn-3d': '0 3px 0 rgb(29 78 216 / 0.3), 0 4px 12px rgb(37 99 235 / 0.25), inset 0 1px 0 rgba(255 255 255 / 0.2)',
      },
    },
  },
  plugins: [],
};
