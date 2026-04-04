import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace 'fus-cs-planner' with your actual GitHub repo name
export default defineConfig({
  plugins: [react()],
  base: '/fus-cs-planner/',
})
