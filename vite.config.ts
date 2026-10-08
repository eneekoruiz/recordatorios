/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const deployment = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'))
const productionCsp = deployment.headers[0].headers.find((header: { key: string; value: string }) => header.key === 'Content-Security-Policy').value

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    port: 5173
  },
  preview: {
    host: true,
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3001' },
    headers: {
      'Content-Security-Policy': productionCsp
    }
  },
  test: {
    include: ['tests/unit/**/*.test.{js,ts}'],
    environment: 'node',
    maxWorkers: 2,
    testTimeout: 15000,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // El ayudante de precarga de Vite lo usa el índice: si cae en el chunk de pdf.js, este viaja al arrancar.
          if (id.includes('vite/preload-helper') || id.includes('vite/modulepreload-polyfill')) return 'vendor';
          if (id.includes('node_modules')) {
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react/') || id.includes('react-dom/')) return 'vendor-react';
            // pdfjs-dist solo se importa dinámicamente (ver pdfExtractor.ts); en su propio
            // chunk no viaja con el resto del vendor eager y solo se descarga bajo demanda.
            if (id.includes('pdfjs-dist')) return 'vendor-pdf';
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
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        id: '/',
        name: 'Recordatorios Élite',
        short_name: 'Recordatorios',
        description: 'Recordatorios, listas, hábitos y caducidades. Funciona sin conexión y se sincroniza entre dispositivos.',
        lang: 'es',
        theme_color: '#0a84ff',
        background_color: '#0a84ff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        shortcuts: [
          { name: 'Nuevo recordatorio', short_name: 'Nuevo', url: '/?action=new', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] }
        ]
      }
    })
  ],
})
