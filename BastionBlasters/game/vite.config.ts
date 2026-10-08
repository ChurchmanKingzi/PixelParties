import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 2000, rollupOptions: { output: { inlineDynamicImports: true } } },
  server: { host: '0.0.0.0', port: 5173 },
});
