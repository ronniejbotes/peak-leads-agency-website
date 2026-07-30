import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const page = (path) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      // Hybrid multi-page setup: each entry becomes its own static page.
      // Nested index.html files give clean URLs on Hostinger (/about/, /services/, ...).
      input: {
        home: page('./index.html'),
        about: page('./about/index.html'),
        services: page('./services/index.html'),
        contact: page('./contact/index.html'),
      },
      output: {
        // Three.js and GSAP only change on dependency updates — split them out
        // so returning visitors keep them cached across site deploys.
        manualChunks: {
          three: ['three'],
          gsap: ['gsap'],
        },
      },
    },
  },
})
