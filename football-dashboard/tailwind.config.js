/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: '#060b12',
          900: '#0b1422',
          800: '#111e33',
          700: '#1a2d4a',
          600: '#1e3560',
        },
        accent: {
          green:  '#00e676',
          yellow: '#ffd600',
          red:    '#ff1744',
          blue:   '#448aff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
