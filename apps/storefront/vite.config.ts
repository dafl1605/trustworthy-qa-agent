import react from '@vitejs/plugin-react';
import { defineConfig, type ProxyOptions } from 'vite';

// Default stays the local API. E2E sets TQA_API_ORIGIN so preview hits the same process as the oracle.
const apiOrigin = process.env.TQA_API_ORIGIN ?? 'http://127.0.0.1:3001';

const apiProxy: Record<string, ProxyOptions> = {
  '/api': {
    target: apiOrigin,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    proxy: apiProxy,
  },
});
