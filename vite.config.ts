import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/yahoo': {
            target: 'https://query1.finance.yahoo.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
          },
          '/api/binance': {
            target: 'https://api.binance.com',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/binance/, ''),
          },
        },
      },
      plugins: [react()],
      define: {},
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
