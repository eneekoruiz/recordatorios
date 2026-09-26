/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    port: 5173
  },
  preview: {
    host: true,
    port: 5173
  },
  test: {
    include: ['tests/unit/**/*.test.{js,ts}'],
    environment: 'node',
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        // Avisos push con la app cerrada (public/push-sw.js)
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Solo precacheamos las fuentes latinas (español); el resto se descarga bajo demanda.
        globIgnores: ['**/*cyrillic*', '**/*greek*', '**/*vietnamese*']
      },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        id: '/',
        name: 'Recordatorios Élite',
        short_name: 'Recordatorios',
        description: 'Recordatorios, listas, hábitos y caducidades. Funciona sin conexión y se sincroniza entre dispositivos.',
        lang: 'es',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ],
        shortcuts: [
          { name: 'Nuevo recordatorio', short_name: 'Nuevo', url: '/?action=new', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] }
        ]
      }
    })
  ],
})
