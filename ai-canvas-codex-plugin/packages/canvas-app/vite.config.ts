import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.AI_CANVAS_PORT ?? 43218)
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true
  }
})
