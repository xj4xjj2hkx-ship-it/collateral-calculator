import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ command }) => ({
  base: './',
  plugins: command === 'build' ? [react(), viteSingleFile()] : [react()],
  server: {
    port: 4173,
    host: '0.0.0.0',
  },
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
  },
}));
