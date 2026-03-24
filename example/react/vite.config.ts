import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  // Fixed port + strictPort so Google OAuth "Authorized JavaScript origins" always match the URL
  // you open in the browser (Google requires an exact match, including port).
  server: {
    port: 5180,
    strictPort: true,
    host: '127.0.0.1',
    fs: {
      // allow importing the library source + example config
      allow: [resolve(__dirname, '../..')],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../src'),
      '~': resolve(__dirname, './src'),
    },
  },
});
// Trigger Vite dev server restart

