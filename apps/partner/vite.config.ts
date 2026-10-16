import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: path.resolve(__dirname),
  server: {
    port: 3003,
    strictPort: true,
    host: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../../packages/shared'),
    },
  },
});
