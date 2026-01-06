/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#495057', dark: '#adb5bd' },
        background: { DEFAULT: '#e9ecef', dark: '#212529' },
        bookmark: '#fd7e14',
      }
    }
  },
  plugins: []
}
