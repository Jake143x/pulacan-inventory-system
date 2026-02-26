/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: { DEFAULT: '#2563EB', hover: '#1D4ED8' },
        success: '#16A34A',
      },
      borderRadius: {
        card: '12px',
        'card-lg': '16px',
      },
      boxShadow: {
        card: '0 2px 4px rgb(0 0 0 / 0.2), 0 4px 8px rgb(0 0 0 / 0.15), inset 0 1px 0 rgba(255 255 255 / 0.06)',
        'card-lg': '0 8px 16px rgb(0 0 0 / 0.25), 0 4px 8px rgb(0 0 0 / 0.2), inset 0 1px 0 rgba(255 255 255 / 0.06)',
        'card-hover': '0 12px 24px rgb(0 0 0 / 0.3), 0 6px 12px rgb(0 0 0 / 0.2), inset 0 1px 0 rgba(255 255 255 / 0.06)',
        'btn-3d': '0 4px 0 rgb(0 0 0 / 0.2), 0 6px 12px rgb(0 0 0 / 0.15), inset 0 1px 0 rgba(255 255 255 / 0.1)',
        'btn-3d-hover': '0 6px 0 rgb(0 0 0 / 0.2), 0 8px 16px rgb(0 0 0 / 0.2), inset 0 1px 0 rgba(255 255 255 / 0.12)',
      },
      transform: {
        'lift': 'translateY(-2px)',
        'press': 'translateY(1px)',
      },
    },
  },
  plugins: [],
};
