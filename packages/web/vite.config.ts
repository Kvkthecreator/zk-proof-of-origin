import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  // Relative base so the build works under any URL prefix (GitHub Pages
  // subpaths, local preview, custom CDNs). Absolute `/foo.js` links break
  // under `/repo-name/` paths; relative `./foo.js` links work everywhere.
  base: './',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['o1js'],
  },
  server: {
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
  build: {
    target: 'esnext',
  },
});
