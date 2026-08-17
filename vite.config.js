import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const page = (path) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      // Hybrid multi-page setup — every page ships prerendered HTML for SEO.
      input: {
        home: page('./index.html'),
        about: page('./about/index.html'),
        services: page('./services/index.html'),
        contact: page('./contact/index.html'),
        pricing: page('./pricing/index.html'),
        freeAudit: page('./free-audit/index.html'),
        blog: page('./blog/index.html'),
        postRoofingLeads: page('./blog/how-much-do-roofing-leads-cost/index.html'),
        postExclusiveLeads: page('./blog/exclusive-vs-shared-leads/index.html'),
        postAdsComparison: page('./blog/google-ads-vs-facebook-ads-for-contractors/index.html'),
        notFound: page('./404.html'),
      },
      output: {
        manualChunks: {
          three: ['three'],
          gsap: ['gsap'],
        },
      },
    },
  },
})
