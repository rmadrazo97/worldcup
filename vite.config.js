/// <reference types="vitest" />
import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Inline build identifiers — package.json version + git short SHA. These
// are baked into the bundle so the running site can tell users (and
// support) exactly which build they're looking at.
const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'))
const gitShortSha = (() => {
  // CI: GITHUB_SHA is set by GitHub Actions even when the checkout depth is
  // shallow. Locally: fall back to `git rev-parse`. If neither works (e.g.
  // building a tarball with no git history), report "dev".
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return 'dev' }
})()
const buildTime = new Date().toISOString()

export default defineConfig({
  define: {
    __APP_VERSION__:    JSON.stringify(pkg.version),
    __APP_COMMIT__:     JSON.stringify(gitShortSha),
    __APP_BUILD_TIME__: JSON.stringify(buildTime),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
    css: false,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    exclude: ['node_modules', 'dist', 'functions/**'],
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
