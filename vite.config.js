import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import process from 'node:process'

// La versión de este build: el commit en Vercel, la hora en una compilación
// local. Queda adentro de la app (__APP_VERSION__) y en /version.json, y el
// aviso de versión nueva compara las dos (AvisoVersionNueva.jsx).
const VERSION = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now())

const publicarVersion = () => ({
  name: 'publicar-version',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ version: VERSION }),
    })
  },
})

export default defineConfig({
  plugins: [react(), nodePolyfills(), publicarVersion()],
  define: {
    __APP_VERSION__: JSON.stringify(VERSION),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
