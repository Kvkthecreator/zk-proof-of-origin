import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import swc from 'unplugin-swc';

const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  // Relative base so the build works under any URL prefix (GitHub Pages
  // subpaths, local preview, custom CDNs). Absolute `/foo.js` links break
  // under `/repo-name/` paths; relative `./foo.js` links work everywhere.
  base: './',
  plugins: [
    // SWC plugin before React plugin so decorator metadata is emitted
    // correctly. o1js @state/@method decorators on the transitively-
    // imported ProofCommitmentRegistry SmartContract need legacyDecorator
    // + decoratorMetadata, which esbuild (Vite's default transformer)
    // does not emit. Without this, the production bundle throws
    // "Cannot read properties of undefined (reading 'map')" at runtime.
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: {
          syntax: 'typescript',
          tsx: true,
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        keepClassNames: true,
      },
    }),
    react(),
  ],
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
