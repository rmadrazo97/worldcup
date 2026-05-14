/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
    css: false,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'fonts/*.woff2'],
      manifest: {
        name: 'World Cup Live Scores',
        short_name: 'WC Scores',
        description: 'Live scores, groups, and standings for the World Cup',
        theme_color: '#19227F',
        background_color: '#0B1020',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          // SVG icon works for the manifest in Chrome 88+. Drop in PNGs at
          // public/icons/{icon-192,icon-512,icon-maskable-512}.png and add
          // entries below for fuller install-prompt + iOS support.
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname === 'flagcdn.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'flagcdn-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
