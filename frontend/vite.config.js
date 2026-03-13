import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    alias: {
      '@xenova/transformers': '@huggingface/transformers',
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/apple-touch-icon.png',
      ],
      manifest: {
        name: 'MegaConvert OS',
        short_name: 'MegaConvert',
        theme_color: '#030303',
        background_color: '#030303',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,mjs}'],
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /.*ffmpeg.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1200,
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

          if (
            id.includes('react-router-dom') ||
            id.includes('@remix-run/router') ||
            id.includes('cmdk') ||
            id.includes('@radix-ui/react-dialog')
          ) {
            return 'os-shell';
          }

          if (id.includes('framer-motion')) {
            return 'motion-stack';
          }

          if (id.includes('lucide-react')) {
            return 'icon-stack';
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
