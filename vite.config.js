import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // @solana/web3.js v1 still expects a couple of Node globals in the browser.
  define: { global: 'globalThis' },
  resolve: { alias: { buffer: 'buffer' } },
});
