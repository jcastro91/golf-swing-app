import { defineConfig } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']], padding: 0 },
    maskable: { sizes: [512], padding: 0, resizeOptions: { background: '#1c355e' } },
    apple: { sizes: [180], padding: 0, resizeOptions: { background: '#1c355e' } },
  },
  images: ['public/favicon.svg'],
});
