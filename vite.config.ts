import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// En GitHub Pages el sitio vive en /<repo>/; el workflow pasa BASE.
const base = process.env.BASE ?? '/';

export default defineConfig({
  base,
  build: { chunkSizeWarningLimit: 700 },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Golpe R10',
        short_name: 'Golpe R10',
        description: 'Diagnóstico de cada tiro con el Garmin R10 en el campo de práctica.',
        lang: 'es',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#1c355e',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
