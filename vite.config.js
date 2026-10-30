import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import Beasties from 'beasties'

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
// Switched on 15 October 2026 (property "Peak Leads" in the agency's
// "Position Xero clients" Analytics account). The Google row and the "What is
// Google Analytics doing?" section in privacy/index.html disclose it: remove
// them in the same push if this tag is ever taken out, and keep them if the
// ID only changes.
const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || 'G-074HV1DSPW'

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
 * as Clarity's setup screen gives it, at the END of the head, after the
 * stylesheet. The tag only queues calls and fetches
 * https://www.clarity.ms/tag/<id> asynchronously. A page that already carries
 * a Clarity tag is left alone, so no page ever gets two. An ID that is not
 * lowercase letters and digits adds nothing and the build prints a warning
 * instead of failing.
 *
 * Why the end of the head (15 October 2026 mobile review): it used to go
 * straight after the viewport meta, ahead of the long JSON-LD blocks and the
 * stylesheet. On a first visit Clarity's script then arrived and ran before
 * the stylesheet, measured the page with the browser's default styles (the
 * body's 8px margin), and the page was laid out again when the CSS landed:
 * a layout shift of 0.55 to 0.70 on every page, enough on its own to fail
 * Google's CLS threshold (0.1). Blocking clarity.ms in a test browser made
 * the shift disappear. After the stylesheet, the CSS is always in first.
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

        if (/<\/head>/i.test(html)) {
          return html.replace(/<\/head>/i, (tag) => `  ${clarityTag}\n${tag}`)
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

/*
 * Body font preload, build only. Geist is self-hosted through fontsource with
 * font-display: swap, so on a first visit the hero is painted in the fallback
 * font and reflowed when Geist arrives: on the homepage at 390px that moved
 * the hero's trust line and the orbit ring about 27px down (a layout shift of
 * 0.18, 15 October 2026 mobile review). Preloading the one Latin Geist file
 * (about 29 KB) starts it alongside the stylesheet, so it is usually there
 * before first paint. The file name is hashed, so it is looked up in the
 * bundle. Only the Latin subset is preloaded; the others load as before.
 */
function preloadBodyFont() {
  return {
    name: 'peak-leads-preload-body-font',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const file = Object.keys(ctx.bundle || {}).find((name) =>
          /(^|\/)geist-latin-wght-normal-[^/]*\.woff2$/.test(name),
        )
        if (!file || html.includes(file)) return html
        const tag = `<link rel="preload" href="/${file}" as="font" type="font/woff2" crossorigin>`
        const viewport = /^([ \t]*)<meta\b[^>]*\bname=["']?viewport["']?[^>]*>/im
        if (viewport.test(html)) {
          return html.replace(viewport, (m, indent) => `${m}\n${indent}${tag}`)
        }
        return html.replace(/<head\b[^>]*>/i, (m) => `${m}\n${tag}`)
      },
    },
  }
}

/*
 * Critical CSS, build only (T-60, 20 October 2026). The site-wide stylesheet
 * was the only file holding up the first paint (Lighthouse "render-blocking
 * resources" on every page). After the build has written the pages, each
 * page gets the rules it uses written into a <style> where the stylesheet
 * link was. The full stylesheet still loads, but only once the page has
 * loaded (or at the first key press or tap, if that comes sooner), from a
 * one-line script, plus a <noscript> link for visitors without JavaScript.
 * Loading it any earlier, even without blocking, put its 19 KB in the way
 * of the first paint's bytes on a slow phone: Lighthouse's mobile LCP went
 * up 150ms on the homepage with an early media="print" load, and down 75ms
 * with this one. The page looks the same from the first paint, because:
 *
 * - beasties keeps every rule whose selector matches an element in the page,
 *   in the stylesheet's own order, so the cascade (Tailwind's @layer order
 *   included) resolves exactly as with the full file;
 * - rules for states the scripts set after the HTML arrives (JS_STATE: the
 *   js-enabled class the head script adds, which switches the phone menu to
 *   the burger, data-region, no-3d, nav-light, the open menu and so on) are
 *   matched with those tokens taken out, so they are in from the start;
 * - rules for elements the scripts build (JS_BUILT: the #network typewriter
 *   spans, the Recent work card faces, the pricing confetti) are always kept;
 * - every @font-face and @keyframes rule is kept: beasties cannot see that
 *   font-family: var(--font-sans) is Geist, and without the @font-face the
 *   first paint would use the fallback font and reflow when the file landed
 *   (the layout shift the body font preload above was added to stop).
 *
 * What is left out is what no page shows before the full file has arrived:
 * other pages' rules and the mini game, which only opens after typing (the
 * first key press fetches the full file). The built HTML is otherwise byte
 * for byte what Vite wrote: only the stylesheet line is replaced, and
 * beasties' own rewrite of the page is thrown away. A page that does not
 * have exactly one stylesheet link, or where anything unexpected comes
 * back, is left as it was (blocking, but correct) and the build prints a
 * warning.
 *
 * When a script starts setting a new class or data attribute that the CSS
 * styles, add it to JS_STATE, or that state will look unstyled until the
 * full file arrives. Checked on 20 October 2026 by loading every built page
 * with the full stylesheet withheld: pixel for pixel the same as before at
 * 1440 and 390px, top to bottom, apart from the frame a playing video was on.
 */
const JS_STATE = [
  /\.js-enabled\b/g,
  /\.no-3d\b/g,
  /\.nav-light\b/g,
  /\.is-3d\b/g,
  /\.is-open\b/g,
  /\.in\b(?![\w-])/g,
  /\[data-(?:region|open|done|active|hover|enter|muted)(?:[~|^$*]?=[^\]]*)?\]/g,
  /\[aria-(?:expanded|checked|pressed|invalid)(?:[~|^$*]?=[^\]]*)?\]/g,
]
const JS_BUILT = [/\.tw-(?:head|tail|caret)\b/, /\.wc-[\w-]+/, /\.confetti-layer\b/]

class SiteBeasties extends Beasties {
  normalizeCssSelector(selector) {
    let s = selector
    for (const token of JS_STATE) s = s.replace(token, '')
    // A compound left empty by the line above (".js-enabled .x" -> " .x") matches anything.
    s = s.replace(/(^|[\s>+~(,])(?=[\s>+~),]|$)/g, '$1*')
    // beasties drops pseudo-classes, which turns "main :is(ul,ol)>li" into "main >li"
    // (li as a child of main: never matches). A * in front keeps it "main *>li".
    s = s.replace(/(^|[\s>+~(,])(?=::?[a-z-])/gi, '$1*')
    return super.normalizeCssSelector(s)
  }
}

function criticalCss() {
  let outDir
  let logger

  return {
    name: 'peak-leads-critical-css',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      logger = config.logger
    },
    async writeBundle(options, bundle) {
      const beasties = new SiteBeasties({
        path: outDir,
        publicPath: '/',
        external: true,
        inlineFonts: false,
        preloadFonts: false,
        keyframes: 'all',
        reduceInlineStyles: false,
        mergeStylesheets: false,
        pruneSource: false,
        compress: true,
        allowRules: JS_BUILT,
        logLevel: 'warn',
        logger: {
          warn: (message) => logger.warn(`[critical-css] ${message}`),
          error: (message) => logger.error(`[critical-css] ${message}`),
        },
      })
      const fontFaces = new Map()
      const skip = (file, why) =>
        logger.warn(`\n[critical-css] ${file}: ${why}; its stylesheet still blocks the first paint.\n`)

      for (const file of Object.keys(bundle).filter((name) => name.endsWith('.html'))) {
        const htmlPath = join(outDir, file)
        const html = await readFile(htmlPath, 'utf8')
        const links = html.match(/^[ \t]*<link rel="stylesheet" crossorigin href="\/assets\/[^"]+\.css">/gm) || []
        if (links.length !== 1) {
          if (links.length) skip(file, `${links.length} stylesheet links`)
          continue
        }
        if (/<style\b/i.test(html)) {
          skip(file, 'it already has a <style> block')
          continue
        }
        const indent = links[0].match(/^[ \t]*/)[0]
        const href = links[0].match(/href="([^"]+)"/)[1]

        let css
        try {
          const styles = [...(await beasties.process(html)).matchAll(/<style>([\s\S]*?)<\/style>/g)]
          if (styles.length !== 1) throw new Error(`${styles.length} <style> blocks came back`)
          css = styles[0][1]
        } catch (error) {
          skip(file, error.message)
          continue
        }

        // Every @font-face in the full file (fontsource's are flat, no nested braces).
        if (!fontFaces.has(href)) {
          const sheet = await readFile(join(outDir, href), 'utf8')
          fontFaces.set(href, (sheet.match(/@font-face\s*\{[^{}]*\}/g) || []).join(''))
        }
        css += fontFaces.get(href)
        if (/<\/style/i.test(css)) {
          skip(file, 'the CSS contains "</style"')
          continue
        }

        const loader =
          '(function(){var d=document,done=0;function css(){if(done)return;done=1;' +
          "var l=d.createElement('link');l.rel='stylesheet';l.crossOrigin='';" +
          `l.href='${href}';d.head.appendChild(l)}` +
          "addEventListener('load',css);addEventListener('keydown',css);addEventListener('pointerdown',css)})()"
        const tag =
          `${indent}<style>${css}</style>\n` +
          `${indent}<script>${loader}</script>\n` +
          `${indent}<noscript><link rel="stylesheet" crossorigin href="${href}"></noscript>`
        await writeFile(htmlPath, html.replace(links[0], () => tag))
      }
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
    preloadBodyFont(),
    criticalCss(),
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
        postAdvertiseOnline: page('./blog/advertise-your-business-online-south-africa/index.html'),
        postMoreCustomers: page('./blog/how-to-get-more-customers/index.html'),
        postFreelancerVsAgency: page('./blog/freelancer-vs-agency/index.html'),
        postSeoCost: page('./blog/seo-cost-south-africa/index.html'),
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
