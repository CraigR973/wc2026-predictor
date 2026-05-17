import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'WC 2026 Predictor',
        short_name: 'WC2026',
        description: 'World Cup 2026 Prediction League',
        theme_color: '#1a1a2e',
        background_color: '#0f0f1a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        // Only carve out chunks Vite ALWAYS preloads on the entry — react +
        // router + query are eagerly used by App.tsx. framer-motion and
        // recharts are only used by lazy routes, so leaving them out lets
        // Rollup keep them inside those routes' chunks instead of preloading
        // them on the unauth /login entry.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query': ['@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    port: process.env['PORT'] ? parseInt(process.env['PORT']) : 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
});
