import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    publicDir: 'public-messenger',
    build: {
      outDir: 'dist-messenger',
      emptyOutDir: true,
    },
    server: {
      host: 'localhost',
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
      proxy: {
        '/api': {
          target: env.VITE_LOCAL_API_PROXY_TARGET || 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: env.VITE_LOCAL_SOCKET_PROXY_TARGET || 'http://127.0.0.1:4000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    preview: {
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
    },
  };
});
