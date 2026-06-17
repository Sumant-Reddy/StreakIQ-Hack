import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // allow external access
    port: 3000,
    allowedHosts: [
      'carat-dreadlock-vitally.ngrok-free.dev',
    ],
    // 👇 Fixes Vite HMR breaking over ngrok tunnels
    hmr: {
      clientPort: 443,
    },
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5000', ws: true, changeOrigin: true },
    },
  },
});