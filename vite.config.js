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
//
// Before setting an ID, put the Google row and the "What is Google Analytics
// doing?" section back into privacy/index.html (both were added in 79cdd3e),
// in the same push. The notice and the tag go live together or not at all.
const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || ''

// Microsoft Clarity project ID (heatmaps and visit recordings), switched on
// 14 October 2026 with Ronnie's yes. Like the GA ID it is public by design:
// Clarity's tag prints it in every page's HTML. A CLARITY_PROJECT_ID
// environment variable, when set, wins over this value. The "What is
// Microsoft Clarity doing?" section and the Clarity row in
// privacy/index.html disclose it: remove them in the same push if this tag
// is ever taken out, and keep them if the ID only changes.
const CLARITY_PROJECT_ID = process.env.CLARITY_PROJECT_ID || 'yxi80jp50q'

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

/*
 * Microsoft Clarity, build only, so `npx vite` in dev never records a visit.
 * Microsoft's standard tag is written into every built page's <head> exactly
 * as Clarity's setup screen gives it, the same way and in the same place as
 * the GA tag above: straight after the viewport meta, or right after <head>
 * on a page without one. The tag only queues calls and fetches
 * https://www.clarity.ms/tag/<id> asynchronously, so it does not hold up the
 * page. A page that already carries a Clarity tag is left alone, so no page
 * ever gets two. An ID that is not lowercase letters and digits adds nothing
 * and the build prints a warning instead of failing.
 */
function microsoftClarity(id) {
  const valid = /^[a-z0-9]+$/.test(id)

  return {
    name: 'peak-leads-microsoft-clarity',
    apply: 'build',
    configResolved(config) {
      if (valid) return
      config.logger.warn(
        `\n[clarity] "${id}" is not a Clarity project ID (lowercase letters and digits). No Clarity tag was added to the built pages.\n`,
      )
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!valid || html.includes('clarity.ms/tag/')) return html

        const clarityTag =
          '<script type="text/javascript">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};' +
          't=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})' +
          `(window, document, "clarity", "script", "${id}");</script>`

        const viewport = /^([ \t]*)<meta\b[^>]*\bname=["']?viewport["']?[^>]*>/im
        if (viewport.test(html)) {
          return html.replace(viewport, (tag, indent) => `${tag}\n${indent}${clarityTag}`)
        }
        return html.replace(/<head\b[^>]*>/i, (tag) => `${tag}\n${clarityTag}`)
      },
    },
  }
}

/*
 * Footer year, build only. Every page's footer prints "(c) <year> Peak Leads"
 * inside a span marked data-year or id="year" / id="footer-year". The page
 * scripts (initYear in src/js/main.js and src/js/pages/subpage.js) already
 * swap in the visitor's current year when the page loads; this writes the
 * build year into the HTML itself as well, so the raw page (what a crawler
 * or a visitor without JavaScript sees) is right after every deploy. Added
 * 14 October 2026. Nothing to update by hand at New Year.
 */
function footerYear() {
  const year = String(new Date().getFullYear())
  const span = /(<span\b[^>]*\b(?:data-year|id=["']?(?:footer-)?year["']?)[^>]*>)\s*\d{4}\s*(<\/span>)/g

  return {
    name: 'peak-leads-footer-year',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(span, (match, open, close) => `${open}${year}${close}`)
      },
    },
  }
}

/*
 * Table cell labels, dev and build. On a phone (under 640px) every
 * comparison table is shown as one card per row (main.css, "Comparison
 * tables on phones"), and each cell after the first is printed under its
 * column heading. This copies each column heading's text into a data-label
 * on that column's body cells, so the card can show it with CSS alone and a
 * new table needs nothing extra by hand. The first cell of a row is the
 * card's title, so it gets no label. A cell that already has a data-label
 * keeps it. Added 15 October 2026 (mobile review).
 */
function tableCellLabels() {
  const text = (html) =>
    html
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/"/g, '&quot;')

  return {
    name: 'peak-leads-table-cell-labels',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace(/<table\b[\s\S]*?<\/table>/gi, (table) => {
          const head = table.match(/<thead\b[\s\S]*?<\/thead>/i)
          if (!head) return table
          const labels = [...head[0].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => text(m[1]))
          if (labels.length < 2) return table
          return table.replace(/<tbody\b[\s\S]*?<\/tbody>/gi, (body) =>
            body.replace(/<tr\b[\s\S]*?<\/tr>/gi, (row) => {
              let i = -1
              return row.replace(/<(td|th)\b([^>]*)>/gi, (tag, name, attrs) => {
                i += 1
                if (i === 0 || !labels[i] || /\bdata-label=/i.test(attrs)) return tag
                return `<${name}${attrs} data-label="${labels[i]}">`
              })
            }),
          )
        })
      },
    },
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    googleAnalytics(GA_MEASUREMENT_ID),
    microsoftClarity(CLARITY_PROJECT_ID),
    footerYear(),
    tableCellLabels(),
  ],
  build: {
    rollupOptions: {
      // Hybrid multi-page setup — every page ships prerendered HTML for SEO.
      input: {
        home: page('./index.html'),
        about: page('./about/index.html'),
        services: page('./services/index.html'),
        contact: page('./contact/index.html'),
        pricing: page('./pricing/index.html'),
        // The questions every "Book a call" leads to. Old /free-audit/ links
        // are sent here by a 301 in public/.htaccess.
        bookACall: page('./book-a-call/index.html'),
        // The booking calendar, reached only by answering those questions.
        // noindex and deliberately not in public/sitemap.xml.
        pickATime: page('./book-a-call/pick-a-time/index.html'),
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
        postGbpVsWebsite: page('./blog/google-business-profile-vs-website/index.html'),
        postWebsiteOwnership: page('./blog/who-owns-your-website/index.html'),
        postWebsitePages: page('./blog/how-many-pages-does-a-website-need/index.html'),
        postNewWebsiteGoogle: page('./blog/new-website-not-showing-on-google/index.html'),
        postOldWebsiteGoogle: page('./blog/old-website-still-on-google/index.html'),
        postSeoOrAds: page('./blog/seo-or-google-ads-first/index.html'),
        postSeoReport: page('./blog/what-should-an-seo-report-include/index.html'),
        postAiCrawlers: page('./blog/should-you-block-ai-crawlers/index.html'),
        postChoosingAgency: page('./blog/how-to-choose-a-lead-generation-agency/index.html'),
        postWebsiteCost: page('./blog/website-cost-for-trades-south-africa/index.html'),
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
