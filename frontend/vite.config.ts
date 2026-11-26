import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // The service worker precaches the app shell only.
      // Workout durability is owned by IndexedDB (Task 4) — not the SW cache.
      workbox: {
        // Precache the built app shell assets (JS, CSS, HTML)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // Don't cache API routes — they must always go to the network
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/auth/, /^\/exercises/, /^\/templates/, /^\/cycle/, /^\/sessions/, /^\/bodyweight/, /^\/health/],
      },
      manifest: {
        name: 'Life Track',
        short_name: 'life·track',
        description: 'Personal fitness and body-weight tracker',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1b6e66',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
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
