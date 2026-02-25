import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 41042,
    proxy: {
      '/graphql': `http://127.0.0.1:${process.env.CLAW_INSIGHTS_SERVER_PORT ?? '41041'}`,
      '/api': `http://127.0.0.1:${process.env.CLAW_INSIGHTS_SERVER_PORT ?? '41041'}`,
    },
    watch: {
      ignored: ['**/coverage/**'],
    },
  },
});
