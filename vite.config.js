import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: '/Wasteland_Tactics/',
  build: {
    outDir: 'dist',
  },
});
