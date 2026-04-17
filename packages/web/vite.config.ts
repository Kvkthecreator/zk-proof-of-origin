import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // o1js uses WASM — ensure Vite handles it correctly
  optimizeDeps: {
    exclude: ['o1js'],
  },
});