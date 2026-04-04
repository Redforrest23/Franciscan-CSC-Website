/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Franciscan University palette
        fus: {
          green: {
            50: '#f0f7ee',
            100: '#d6ebd1',
            200: '#aed4a4',
            300: '#7eb872',
            400: '#559c47',
            500: '#3a7d2e', // primary green
            600: '#2d6122',
            700: '#224a19',
            800: '#173411',
            900: '#0d1f09',
          },
          gold: {
            50: '#fdf8ec',
            100: '#faedca',
            200: '#f5d98a',
            300: '#efc24a',
            400: '#e5aa1e', // primary gold
            500: '#c48f0e',
            600: '#9a6f09',
            700: '#724f06',
            800: '#4a3204',
            900: '#251902',
          },
          brown: {
            50: '#f5f0eb',
            100: '#e4d5c6',
            200: '#c9aa8d',
            300: '#ae7f54',
            400: '#8f5e2f', // warm brown accent
            500: '#6e4520',
            600: '#543417',
            700: '#3c250f',
            800: '#251608',
            900: '#120b03',
          },
          cream: '#fdfaf5',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}