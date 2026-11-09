import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ base: './', plugins: [react()], build: { chunkSizeWarningLimit: 1800 }, server: { port: 5173, strictPort: true } });
