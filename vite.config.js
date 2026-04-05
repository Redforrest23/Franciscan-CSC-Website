import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace 'Franciscan-CSC-Website' with your actual GitHub repo name
export default defineConfig({
  plugins: [react()],
  base: '/Franciscan-CSC-Website/',
})
