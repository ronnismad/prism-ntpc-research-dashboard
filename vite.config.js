import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {assistantPlugin} from './scripts/assistant_server.mjs';

export default defineConfig({
  plugins: [react(),assistantPlugin()],
  base: './',
  build: { rollupOptions: { output: { manualChunks: { charts: ['recharts'] } } } },
});
