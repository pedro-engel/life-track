import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // vite-plugin-pwa — full configuration added in Task 7
    VitePWA({ registerType: 'autoUpdate' }),
  ],
  server: {
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/exercises': 'http://127.0.0.1:8000',
      '/templates': 'http://127.0.0.1:8000',
      '/cycle': 'http://127.0.0.1:8000',
      '/sessions': 'http://127.0.0.1:8000',
      '/bodyweight': 'http://127.0.0.1:8000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
