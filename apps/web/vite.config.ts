import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `vite --mode live` (pnpm dev:live): no MSW mocks, /api goes to the local API server (apps/api, npm run serve).
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  define: mode === 'live' ? { 'import.meta.env.VITE_API_MODE': JSON.stringify('live') } : {},
  server: {
    port: 5173,
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:8787' },
  },
}))
