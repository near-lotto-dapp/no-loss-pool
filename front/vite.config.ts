import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [nodePolyfills(), react()],
  resolve: {
    alias: {
      '@': '/src',
      buffer: 'buffer',
    },
  },

  server: {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
    },
  },
  preview: {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },

  optimizeDeps: {
    include: ['buffer'],
  }
})