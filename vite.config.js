import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Serve FO4 extracted audio from local cache (~/.wasteland-tactics-audio/)
// These files are NEVER committed to the repo
const fo4CacheDir = path.join(os.homedir(), '.wasteland-tactics-audio');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'fo4-audio-server',
      configureServer(server) {
        server.middlewares.use('/fo4-audio', (req, res, next) => {
          try {
            const filePath = path.join(fo4CacheDir, decodeURIComponent(req.url));
            if (fs.existsSync(filePath)) {
              const ext = path.extname(filePath).toLowerCase();
              const mimeTypes = { '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };
              res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
              res.setHeader('Access-Control-Allow-Origin', '*');
              fs.createReadStream(filePath).pipe(res);
            } else {
              res.statusCode = 404;
              res.end('Not found');
            }
          } catch (_) {
            res.statusCode = 500;
            res.end('Error');
          }
        });
      },
    },
  ],
  root: '.',
  base: '/Wasteland_Tactics/',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
