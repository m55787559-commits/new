import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages base path (set dynamically by CI via VITE_BASE)
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173,
    open: false, // Don't auto-open browser
    strictPort: false // Allow using next available port
  }
})