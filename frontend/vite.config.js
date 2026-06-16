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
      // Standard REST API Proxy routing
      '/api': {
        target: 'http://localhost:5000', // 👈 Change localhost to yami-backend
        changeOrigin: true,
      },
      // Real-time Learner Socket.io Routing
      '/socket.io': {
        target: 'http://localhost:5000', // 👈 Change localhost to yami-backend
        ws: true, // Keep this active
        changeOrigin: true,
      },
    },
  },
});