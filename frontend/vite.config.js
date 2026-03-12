import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (
            id.includes('@huggingface/transformers') ||
            id.includes('onnxruntime-web') ||
            id.includes('onnxruntime-common')
          ) {
            return 'ml-stack';
          }

          if (id.includes('@ffmpeg/')) {
            return 'ffmpeg-stack';
          }

          if (
            id.includes('/three/') ||
            id.includes('@react-three/fiber') ||
            id.includes('@react-three/drei') ||
            id.includes('meshline')
          ) {
            return 'three-stack';
          }

          if (
            id.includes('pdf-lib') ||
            id.includes('pdfjs-dist') ||
            id.includes('jspdf')
          ) {
            return 'pdf-stack';
          }

          if (id.includes('firebase')) {
            return 'firebase-stack';
          }

          if (id.includes('tesseract.js')) {
            return 'ocr-stack';
          }

          if (
            id.includes('simple-peer') ||
            id.includes('socket.io-client') ||
            id.includes('qrcode')
          ) {
            return 'p2p-stack';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    host: 'localhost',
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
})
