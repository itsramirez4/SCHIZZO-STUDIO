import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';

const { version } = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    // Baked in at build time (not read at runtime) — see src/vite-env.d.ts for the type, and the
    // feedback dialog for the one place this is actually shown to a person.
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
