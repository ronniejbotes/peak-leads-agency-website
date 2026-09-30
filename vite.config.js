import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// Google Analytics 4 Measurement ID.
// To switch analytics on, copy the ID that starts with G- from Google
// Analytics > Admin > Data streams > (the peakleads.agency web stream) and
// paste it between the empty quotes at the end of the line below, e.g.
// ... || 'G-ABC123DEF4'. The ID is public by design: Google's tag prints it
// in every page's HTML for anyone to read, so it is not a secret and is safe
// to commit. A GA_MEASUREMENT_ID environment variable, when set, wins over
// the pasted value. With no ID, or anything that is not G- followed by
// capital letters and digits, nothing is injected and the build prints a
// warning instead of failing.
const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || ''

const page = (path) => fileURLToPath(new URL(path, import.meta.url))

/*
 * Google Analytics 4, build only, so `npx vite` in dev never counts visits.
 * Google's standard gtag.js snippet is written into every built page's raw
 * HTML rather than added by a script at runtime, because SEOptimer's
 * analytics check reads the page source. It lands straight after the
 * viewport meta, matching that line's indentation; a page without one gets
 * it right after <head>. Google signals and ad personalisation are off in
 * the config call. order: 'post' runs after Vite has finished rewriting the
 * page, so neither tag is touched by Vite's own HTML processing.
 */
function googleAnalytics(id) {
  const valid = /^G-[A-Z0-9]+$/.test(id)

  return {
    name: 'peak-leads-google-analytics',
    apply: 'build',
    configResolved(config) {
      if (valid) return
      config.logger.warn(
        id
          ? `\n[google-analytics] "${id}" is not a GA4 Measurement ID (G- followed by capital letters and digits). No analytics tag was added to the built pages.\n`
          : '\n[google-analytics] No GA4 Measurement ID set, so no analytics tag was added to the built pages. Paste the G- ID into GA_MEASUREMENT_ID in vite.config.js.\n',
      )
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!valid) return html

        const loaderTag = `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`
        const configTag =
          '<script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} ' +
          `gtag('js', new Date()); gtag('config', '${id}', { allow_google_signals: false, allow_ad_personalization_signals: false });</script>`

        const viewport = /^([ \t]*)<meta\b[^>]*\bname=["']?viewport["']?[^>]*>/im
        if (viewport.test(html)) {
          return html.replace(viewport, (tag, indent) => `${tag}\n${indent}${loaderTag}\n${indent}${configTag}`)
        }
        return html.replace(/<head\b[^>]*>/i, (tag) => `${tag}\n${loaderTag}\n${configTag}`)
      },
    },
  }
}

export default defineConfig({
  plugins: [tailwindcss(), googleAnalytics(GA_MEASUREMENT_ID)],
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
        privacy: page('./privacy/index.html'),
        // Post-booking confirmation. noindex and deliberately not in
        // public/sitemap.xml, but it still has to be built and shipped.
        thankYou: page('./thank-you/index.html'),
        // Split service pages. /services/ stays as the hub that links them.
        webDesign: page('./web-design/index.html'),
        seo: page('./seo/index.html'),
        aiSeo: page('./ai-seo/index.html'),
        googleAds: page('./google-ads/index.html'),
        leadGeneration: page('./lead-generation/index.html'),
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
