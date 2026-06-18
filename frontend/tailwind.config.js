/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        apple: {
          light: '#f5f5f7',
          card: '#ffffff',
          text: '#1d1d1f',
          muted: '#86868b',
          blue: '#0066cc',
          border: '#d2d2d7'
        }
      }
    },
  },
  plugins: [],
}
