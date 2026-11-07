import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base './' працює на GitHub Pages у будь-якому репозиторії.
// Маршрути через HashRouter (#/...), тому 404 на Pages не виникає.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Тренування',
        short_name: 'Тренування',
        description: 'Програма тренувань, розклад, вправи та анатомія',
        lang: 'uk',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#0D0E11',
        theme_color: '#0D0E11',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json}']
      }
    })
  ]
});
