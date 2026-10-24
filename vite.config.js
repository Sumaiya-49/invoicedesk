import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // In development the API runs separately on port 3001; in production Vercel serves both from one domain.
  server: { proxy: { '/api': 'http://localhost:3001' } },
});
