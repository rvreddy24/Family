import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  cacheDir: path.resolve(__dirname, '../../node_modules/.vite-partner'),
  base: '/partner/',
  plugins: [react(), tailwindcss()],
  root: path.resolve(__dirname),
  server: {
    port: 3003,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared'),
      'react': path.resolve(__dirname, '../../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
});
