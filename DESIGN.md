# Peak Leads — Design Brief & Integration Contract

Design read: agency landing + lead funnel for US home-services owners (roofers, plumbers,
HVAC, contractors), founder-led quiet-luxury language, dark warm-monochrome immersive 3D.
Dials: VARIANCE 8 / MOTION 8 / DENSITY 3.

## 1. Concept

**"The climb."** Bradley Hartmann's Peak Leads takes home-service businesses to the top of
their market. One persistent particle object (warm chalk on near-black) morphs through
7 formations as you scroll: mountain PEAK (hero) → thin ellipse ring wrapping the stats
(#proof, scrub-driven) → PLAY control (VSL) → browser FRAME (web design) → ascending
RANKS (SEO) → ad FUNNEL (paid ads) → GROWTH curve (lead gen) → SPHERE endgame: from the
moment #work enters, GROWTH gathers into a big tumbling globe (33° tilt on both screen
axes, center locked at screen center) that stays as a pure background behind all content
to the end of the page - no more dodging or parking. Every morph is scrubbed at station
pace, so nothing snaps and scrolling back rewinds everything. The metaphor appears in
copy sparingly (climb, peak, top of market).

Brand feel: Bradley's wardrobe (white/black/beige) + Porsche-chalk engineering precision.
Crisp fast motion (performance car), never floaty. Founder presence is real: his photo,
his video, his Calendly, his numbers.

## 2. Tokens (CSS custom properties in `src/styles/main.css`)

```css
--bg:            #0D0C0A;   /* warm near-black, page bg + theme-color */
--bg-raise:      #161411;   /* inputs, raised surfaces */
--panel:         rgba(24, 22, 18, 0.55);  /* glass panel; solid fallback rgba(24,22,18,0.94) */
--panel-strong:  rgba(24, 22, 18, 0.78);  /* FAQ, cards, options */
--border:        #2B2822;   /* all 1px borders */
--text:          #F2EFE9;   /* bone white primary text */
--text-2:        #A9A296;   /* warm grey secondary (AA on --bg) */
--text-3:        #837D72;   /* captions/labels minimum only, never body */
--accent:        #D9C7A0;   /* chalk/champagne. THE single accent: buttons, links, q-nums,
                               progress bars, ghost-number stroke, selection, particles */
--accent-ink:    #14120E;   /* dark text ON accent buttons (contrast ~10:1) */
--accent-soft:   rgba(217, 199, 160, 0.25);  /* ghost number text-stroke */
--error:         #E8A79B;   /* form errors on dark */
--ok:            #9CBF9A;   /* success ticks */
--star:          #D9A441;   /* rating stars only */
--radius:        14px;
--font-display:  'Geist', 'Inter', system-ui, sans-serif;   /* headings, buttons, q's */
--font-body:     'Geist', 'Inter', system-ui, sans-serif;
--font-mono:     'Geist Mono', ui-monospace, monospace;      /* stats, step counters */
```

ONE theme (dark), ONE accent, radius 14 everywhere (pills allowed for nav CTA + chips).
Fonts: `@fontsource-variable/geist` + `@fontsource-variable/geist-mono` (fallback to
Space Grotesk + Inter if unavailable). Headings: weight 700, letter-spacing -0.02em,
line-height 1.1, `text-wrap: balance`. H1 clamp(2.5rem,7vw,4.5rem); H2 clamp(2rem,5vw,3.25rem).
Body 16px/1.6. Stats: mono, tabular-nums, clamp(2.5rem,6vw,4rem). NO em-dashes anywhere.
Hyphens only. No emoji in UI (except Bradley's existing "Say Hi!" wave if kept: use SVG hand
instead, or plain text "Say hi").

Glass recipe: `background: var(--panel); backdrop-filter: blur(16px) saturate(1.2);
border: 1px solid var(--border);` — solid fallback FIRST, blur inside `@supports`. Never
backdrop-filter on transform-animated elements.

## 3. Pages (Vite MPA — every one listed in vite.config.js input)

| Path | Entry JS | Title (≤60ch) |
|---|---|---|
| `/` index.html | src/js/main.js | Lead Generation, Web Development, SEO, Paid Ads \| Peak Leads |
| `/about/` | src/js/pages/subpage.js | About Bradley Hart, Founder \| Peak Leads |
| `/services/` | src/js/pages/subpage.js | Web Development, SEO & Paid Ads for Contractors \| Peak Leads |
| `/contact/` | src/js/pages/subpage.js | Contact Peak Leads \| Book a Call |
| `/free-audit/` | src/js/audit.js | Get Your Free Marketing Audit \| Peak Leads |
| `/blog/` | src/js/pages/subpage.js | Contractor Marketing Insights \| Peak Leads Blog |
| `/blog/how-much-do-roofing-leads-cost/` | subpage.js | How Much Do Roofing Leads Cost in 2026? \| Peak Leads |
| `/blog/exclusive-vs-shared-leads/` | subpage.js | Exclusive vs Shared Leads: The Real Difference \| Peak Leads |
| `/blog/google-ads-vs-facebook-ads-for-contractors/` | subpage.js | Google Ads vs Facebook Ads for Contractors \| Peak Leads |
| `/404.html` | subpage.js | Page Not Found \| Peak Leads |

Canonical host: `https://peakleads.agency` with trailing slash on folders. Every page:
unique meta description (150-160ch), canonical, OG (og:image `/assets/images/og-image.jpg`
1200×630), twitter:card summary_large_image, `<html lang="en">`, theme-color `#0D0C0A`,
and `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1,
max-video-preview:-1">` (404.html is `noindex`).

## 4. Landing page section map (index.html)

All copy lives in HTML (readable with JS off). CSS never pre-hides content; GSAP owns
from-states. Eyebrow budget: max 3 on the whole page.

1. **`nav.site-nav`** - fixed glass pill bar (h 64px, max-w 1200px, radius-full).
   Brand: logo img `/assets/images/logo.webp` (40px) + "PeakLeads" bold. Links: Home `/`,
   About `/about/`, What We Do `/services/`, Testimonials `/#testimonials`, Blog `/blog/`.
   CTA pill "Book A Call" → `/#book`. Mobile <900px: burger → dropdown (js-enabled gated;
   no-JS gets static wrapped row). 2px `.nav-progress` bottom edge, scaleX = --scroll-progress.
2. **`#hero`** (100svh, asymmetric: copy left max-w 620px, particles park RIGHT).
   H1: "Build your presence." Sub (19 words): "We've helped businesses generate over
   \[$7 million | R114 million] in sales through our websites, SEO, paid ads, and lead
   generation systems." The amount is a `<span data-money-usd data-money-zar>` — see §7.
   CTAs: primary "Get your free audit" → `/free-audit/`; ghost "Book a call" → `#book`.
   Nothing else.
3. **`#proof`** - 4 stat tiles (2-col mobile / 4-col desktop, count-up on view):
   `4.9/5` average client rating · `70+` reviews · `$7M+` \| `R114M+` client revenue
   generated (region-aware, §7) · `2-3wk` from call to live site. Mono numerals, plain
   layout, hairline separators (no cards). `.stat` is an inline-size container and
   `.stat-value` sizes in `cqi`, so a 6-glyph value ("R114M+") fits the column at every
   width and all four numerals stay the same size.
4. **`#vsl`** - H2 "Watch how we build." Video 16:9 max-w 960px: `/assets/videos/vsl.mp4`,
   poster `/assets/images/vsl-poster.jpg`, preload=metadata, controls. Accent 1.5px animated
   rim (conic gradient, chalk). One line under: "Bradley walks through the exact system,
   in under a minute."
5. **`#services`** - THE set-piece. 4 `article.station` each 150vh, sticky stage
   (`position:sticky; top:0; min-height:100svh; flex center`) with glass `.station-inner`
   (max-w 640px) alternating left/right (particles park opposite). Ghost outline numbers
   01-04. `data-formation` 1-4.
   - 01 Web Development (formation FRAME): H2 "Web development that wins the job before the
     phone rings." Body: "Precision-built websites for roofers, plumbers and contractors.
     Live in 2 to 3 weeks with daily progress updates." Bullets: Live in 2 to 3 weeks / Built
     to rank and convert / Daily progress updates / Fast on every phone. Link "See web
     development →" `/services/#web-design` (fragment keeps its old id; only the label moved).
   - 02 SEO (formation RANKS): H2 "SEO that climbs the rankings your competitors camp on."
     Body: "Local SEO for home services: Google Business Profile, technical and on-page work,
     and content that answers what your customers actually ask." Bullets: Google Maps and local pack /
     Technical and on-page SEO / Content that answers real questions / Plain-English monthly
     reports. Link → `/services/#seo`.
   - 03 Paid Ads (formation FUNNEL): H2 "Paid ads that buy jobs, not clicks."
     Body: "Google Ads and Meta ads tuned for home services. Every dollar tracked from the
     click to the booked call." Bullets: Google Ads and Local Services Ads / Meta ads that
     fill slow weeks / Tracked to the booked call / No lock-in contracts. Link → `/services/#ads`.
   - 04 Lead Generation (formation GROWTH): H2 "Lead generation that stays exclusive to you."
     Body: "We generate leads under your brand and send them only to you. No shared lists,
     no bidding against five other contractors." Bullets: 100% exclusive to you / Under your
     own brand / Delivered in real time / Packages from $140. Link → `/services/#leads`.
6. **`#work`** - H2 "Recent work." Vertical 3D card cylinder (`src/js/cylinder.js`, own
   rAF loop, `perspective: 1350px`). Not pinned and not GSAP-driven. Cards drift upward
   continuously with a magnetic dwell at center, plus a page-scroll nudge; pointer
   parallax tilts the front card; hovering stalls the drift so the cards stay clickable.
   Progressive enhancement over the scroll-snap strip, which stays as-is under
   prefers-reduced-motion and with JS off (`tabindex=0 role=region aria-label`); gated on
   reduced motion ONLY, not on the WebGL boot. Each `<figure>` is rebuilt in place -
   the `<a>` becomes the front face, the `<figcaption>` the back face (blurred reuse of
   the same screenshot), with extruded edge slices between them. Nodes are moved, never
   cloned, so the accessible copy stays single-sourced.
   5 cards 16:9 with real screenshots — note the file numbering is NOT display order:
   Anderson Roofing & Renovations (andersonroofingrenovations.com, `work-2.webp`) ·
   Water Automation (waterautomation.com, `work-3.webp`) · The Leak Geeks
   (theleakgeeks.com, `work-4.webp`) · GreaterGood (greatergood.co, `work-1.webp`) ·
   Tiny Homes SA (tinyhomesa.com, `work-5.webp`). Front face carries browser chrome
   (dots + domain) and a caption plate; back face carries client, trade and domain.
   Needs ≥5 cards: below that the ring is too short to hide its own seam.
7. **`#testimonials`** - H2 "Trusted by the trades." Asymmetric 2-col grid (1-col mobile) of
   4 quotes, each ≤3 lines, real names + avatars (`/assets/images/avatar-*.webp`):
   Greg (Water Automation), Michael Anderson (Anderson Roofing & Renovations),
   Sarah Thompson (roofing), David Chen (plumbing). Verbatim quotes: builder MUST pull from
   `scratchpad/r-peak.json` + `scratchpad/page_about.html` (research copies). Star row
   (5 SVG stars, `--star`) on one featured tile only.
8. **`#process`** - H2 "From first call to first lead." 3 numbered rows (vertical, hairline
   left rule, no zigzag): 01 Book the call: "We map your market, your goals and where jobs
   are leaking." / 02 We build: "Website, SEO and campaigns assembled in a 2 to 3 week
   sprint. You get daily updates." / 03 You climb: "Leads land. We tune weekly. You book
   more jobs."
9. **`#book`** - H2 "Let's talk about your project." Sub: "30 minutes with Bradley. Free,
   direct, no pitch deck." Calendly inline embed div
   `data-url="https://calendly.com/bradley-hart/30min?hide_gdpr_banner=1"` lazy-loaded via
   IntersectionObserver (script + CSS injected on approach). No-JS/blocked fallback link:
   "Book directly on Calendly" + `mailto:bradley@peakleads.agency`.
10. **`#faq`** - H2 "Questions, answered." 6 native `<details>` glass accordions (content
    mirrored in FAQPage JSON-LD): Are the leads exclusive? / What does it cost? (packages
    from $140, sites scoped on the call) / How fast is the website live? (2 to 3 weeks) /
    Do I pay upfront? ("No upfront payments. If you are not happy, you do not pay.") /
    Which trades do you work with? / What happens on the call?
11. **`footer.site-footer`** - giant outlined "PEAKLEADS" marquee (text-stroke
    `--accent-soft`, transparent fill, slow scrub-driven x-drift), then: tagline "Websites,
    SEO, paid ads and exclusive lead generation for home service businesses.",
    email bradley@peakleads.agency,
    links (nav + Free audit + Blog + Instagram @bradley_mj_kid, LinkedIn), © 2026 Peak Leads.
12. **Floating "Say hi" bubble** - fixed bottom-right circular video `/assets/videos/bradley.mp4`
    (muted loop, 144px, border 3px bone), links to `#book`, hides while #book visible,
    `aria-hidden` decorative label. Gated to js-enabled + pointer-fine; never on /free-audit/.

Layout families used: split hero / stat strip / centered video / sticky stations / 3D card
cylinder / asymmetric quote grid / numbered rows / embed / accordions. ≥4 distinct ✓.

## 5. Particle scene contract (`src/js/scene.js`)

ES module (Three.js from npm, tree-shaken imports OK). Exports ONE object `PeakScene`:
```js
init(canvas, opts) -> boolean   // false = caller adds .no-3d
setFormation(f)     // float 0..6, integer = fully formed
setProgress(p)      // 0..1 page progress (camera drift + subtle hue warm)
setLateral(offset, stripWidth)  // park machine left/right of panels (px, 0 = center)
setPointer(x, y)    // -1..1 eased parallax
setDim(d)           // 0.35 reading dim .. 1
setCondense(c)      // -1..1 implosion/bang for the funnel page
resize(), destroy()
```
Engine (per proven recipe): ONE THREE.Points, 6000 pts desktop / 3000 <768px, aStart/aEnd
attribute pairs + uMix smoothstep in vertex shader, swap arrays only when floor(f) changes,
soft in-shader discs, additive blending, transparent, depthWrite false, DPR ≤2, antialias
false, pause rAF on document.hidden, handle context lost. Second static layer: 700 dim
warm "dust" points. Colors: uniforms lerp `#D9C7A0` (chalk) ↔ `#F2EFE9` (bone), NO other hues.
Formations (Float32Array generators):
- 0 PEAK: gaussian mountain ridgeline point cloud, sharp central summit (r ~2.4 wide),
  base raised to -0.95 so the hero massif rides high in frame; slight breathing idle.
- 1 PLAY: video play control for the VSL - thin circle outline (r 1.6) + right-pointing
  triangle (edge trace + barycentric fill) + faint inner dust; soft pulse idle.
- 2 FRAME: rounded-rect browser outline 4.4×2.9 (50% points) + interior dot grid + top bar
  line with 3 dot "traffic lights"; gentle y float idle.
- 3 RANKS: 9 ascending columns left→right (SEO ladder), per-column sine shimmer idle.
- 4 FUNNEL: conical spiral (wide top ring → narrow spout), slow rotation idle, points
  drift downward along cone ~5%.
- 5 GROWTH: rising curve y=f(x) polyline band (arc-length spread) + scatter converging to
  the line; ends higher than it starts; subtle x drift idle.
- 6 SPHERE: endgame globe (r 1.9) - fibonacci shell + 3 tilted great circles + flat
  equatorial halo (1.3-1.52r) + bright nucleus; idle = spin about y with slow x cross-roll,
  whole assembly leaned 33° on both screen axes, pure rotation so the center never moves.

## 6. Scroll choreography contract (`src/js/scroll.js`)

GSAP + ScrollTrigger (npm). Everything scrubbed or reversible (rewind guarantee). Calls
scene ONLY via guarded `sceneCall('setFormation', f)` try/catch bridge. Responsibilities:
page progress → CSS var + `setProgress`; #proof ring fully scrub-driven (wrap 0.12→0.42 of
the pass, hold, release 0.58→0.88, ellipse measured + center-tracked; ≥900px only); PLAY
approach morph (`#vsl` top 120%→30%, scrub 0.6, formation 0→1); formation driver mapped
over `#services` (4 stations × 150vh hold formations 2..5:
`setFormation(clamp(1,5, progress*4.67 + 1.166))` re-derived if heights change, scrub 0.6);
endgame sphere (`#work` top 70% + 150vh, scrub 0.6, formation 5→6, all sizes; while its
progress > 0 the machine is centered, zones/parking suppressed, dim eased to 0.75); lateral
parking above #work only (measure `.station-inner` rects, alternate sides, 0 <900px; park
index = formation - 1); hero scrub-out; station reveals (`gsap.from` y32/opacity, stagger
0.06, toggleActions play none none reverse; opacity NOT autoAlpha); ghost number ±6vh
parallax scrub; content zone only for `#vsl` (side -1); footer marquee drift; stat count-ups
(IntersectionObserver once at 0.4, rAF ease-out, reduced-motion jumps to final);
`gsap.matchMedia` for ≥900px set-pieces; kill + revert on re-init.

## 7. Boot gate (`src/js/main.js`) + region-aware money

`document.documentElement.classList.add('js-enabled')` inline in `<head>` (tiny inline
script in HTML, before CSS).

**Money.** The same head script resolves `<html data-region="za|intl">` from
`Intl.DateTimeFormat().resolvedOptions().timeZone` (`Africa/Johannesburg|Maseru|Mbabane`),
falling back to `navigator.languages` (`-ZA`, or an official SA language subtag). A second
inline script directly after `#proof` rewrites every `[data-money-usd]` element to the
matching `data-money-{usd,zar}` value. Both are inline and synchronous on purpose: the hero
figure is LCP text and must never be seen changing, and it must still swap if the module
bundle fails. Rules:
- **HTML ships USD.** It is what crawlers, no-JS visitors and the primary (US) market get.
  ZAR is the override, never the default.
- `$7 million` ≡ `R114 million` — one claim, two currencies, no live FX. Update both
  together or the site contradicts itself.
- On `.stat-value` the swap also rewrites `data-count`/`-prefix`/`-suffix` so the count-up
  (§6) animates the region's own figure. Prices (`$140`) stay USD everywhere — they are a
  real price, not a converted claim.
- Meta/OG/JSON-LD carry the USD figure only: one canonical value per page.

main.js: dynamic-import scene + scroll AFTER first paint
(`requestIdleCallback` fallback setTimeout 1); all-or-nothing gate → on any failure or
`prefers-reduced-motion`: `body.no-3d` (canvas hidden, static warm radial-gradient backdrop,
everything readable). Also: nav burger, footer year, Calendly lazy-load, "Say hi" bubble,
Facebook Pixel `1586557796001231` (init + PageView; `CallScheduled` custom event when
Calendly `calendly.event_scheduled` postMessage fires; `Lead` on funnel submit). Pixel
loads deferred (after load + 1.5s or first interaction).

## 8. Free-audit funnel (`/free-audit/` + `src/js/audit.js`)

Full-screen dark shell, no site nav (brand wordmark + "peakleads.agency" link + X → `/`).
Same particle canvas behind (formation morphs per step, walking 0→6 then back to 0), radial
backdrop scrim so particles stay visible. 4px fixed top progress bar (accent), width
(step)/(total). One question per screen, `.in` slide-up entrance, Enter advances,
auto-focus, Back button from step 2, "N of 8" counter, error lines aria-live, honeypot
input name `pl_extra`, localStorage prefill `pl_lead` + outbox retry `pl_lead_outbox`.

Steps (labels Geist 800, q-num accent "N →"):
1. name: "What's your name?" text, min 2 chars.
2. email: "What's your business email?" sub "This is where we reply once we've reviewed
   your answers."
3. phone: "What's the best contact number?" tel, `/^\+?\d{7,15}$/` after stripping.
4. business: "What's your business called?"
5. trade: "What's your trade?" text + datalist: Roofing / Plumbing / HVAC / Electrical /
  Solar / Construction / Landscaping / Painting / Garage Doors / Pest Control / Other.
6. service: "Which service are you interested in?" radio cards 2-col: Web Design / SEO /
   Google Ads and Meta Ads / Lead Generation / "Not sure yet, recommend for me".
7. spend: "What's your current monthly ad spend?" radio: Not spending yet / Under $500 /
   $500 to $2,000 / $2,000 to $10,000 / Over $10,000.
8. website: "What's your website address?" sub "We'll review it before your audit. No
   website yet? That's fine." input + escape text-button "I don't have a website yet".
Intro screen: pill "Free audit", H1 "Get your free audit.", sub "Eight quick questions.
We review your answers and reply within one business day with what we'd do, what it costs,
and whether we're the right fit." Start button + "press Enter ↵".
Thanks screen: "You're on the way up." / "Your answers are in. Bradley reviews every one
personally and replies within one business day." Buttons: "Book a call now" →
Calendly URL, ghost "Back to the site" → `/`.
Submission: POST JSON to `https://formsubmit.co/ajax/bradley@peakleads.agency`
(`_subject: "New free audit request: {business}"`), honeypot-suppressed, mailto fallback,
config const slot `LEAD_WEBHOOK` at top of audit.js for a future Apps Script/Web3Forms swap.
Fire Pixel `Lead`. Page is `noindex`? NO: index it (title above), but exclude from nav
clutter. JSON-LD WebPage + BreadcrumbList.

## 9. Subpages (about / services / contact / blog / 404)

`body.page-static`: NO 3D canvas; fixed warm radial-gradient backdrop (chalk 6-8% glows on
--bg). Same nav (non-pill variant OK, same links) + footer (no giant marquee, compact).
- **/about/**: H1 "The person behind Peak Leads." Founder story: Bradley Hart, South
  African, builds for US home-service businesses; discipline/"locked in" work ethic, faith
  and family grounded, straight-talking; photo `/assets/images/bradley.webp` (from
  image1.png). Mention coaching arm one line. Personal, sincere, zero hype. CTA → /free-audit/.
- **/services/**: H1 "What we do." 4 anchor sections `#web-design #seo #ads #leads`
  expanding the stations. H2s carry the exact target keywords: "Web development for
  contractors." / "SEO for contractors." / "Paid ads for contractors." / "Exclusive lead
  generation for contractors." Body copy keeps "web design" and "Google Ads" alive so both
  the old and new phrasings still rank. Each: what you get list,
  who it's for, mini-FAQ line, CTA. Service JSON-LD ×4 (provider → Organization,
  areaServed US).
- **/contact/**: H1 "Talk to us." Email, Calendly link, IG/LinkedIn, simple no-backend
  form (formsubmit.co action post, name/email/phone/message) + note "or book directly".
- **/blog/**: H1 "Insights for the trades." Card grid (16:9 thumbs
  `/assets/images/blog-{slug}.webp`, fallback shared placeholder OK at build time).
- **3 posts**: 1200-1800 words each, H1 = title, answer-first highlighted box, H2 question
  subheads, concrete numbers from research (roofing leads $41-150 shared vs exclusive
  economics, channel comparisons), internal links to `/services/` sections + other posts,
  honest voice, BlogPosting JSON-LD (author Bradley Hart, datePublished 2026-07-30),
  CTA box → /free-audit/.
- **/404.html**: "Wrong turn on the climb." Link home + popular pages.

## 10. SEO layer

- `public/robots.txt`: allow all + `Sitemap: https://peakleads.agency/sitemap.xml`.
- `public/sitemap.xml`: all 9 URLs, lastmod 2026-08-04.
- **Primary target keywords: lead generation, web development, SEO, paid ads.** Every one
  is claimed in a `<title>`, an `<h2>`, and body copy on both `/` and `/services/`. "Web
  development" is the newest of the four; the site said "web design" everywhere before
  2026-08-04, so both phrasings are kept in play (H2s and titles say development, image
  alts and body copy still say design).
- index.html JSON-LD `@graph`: Organization + ProfessionalService (name "Peak Leads", url,
  logo, email, priceRange, areaServed US, knowsAbout the four keywords, sameAs:
  instagram.com/bradley_mj_kid, za.linkedin.com/in/bradley-hartmann-372785336) with a
  `hasOfferCatalog` of the 4 Services whose `@id`s point at `/services/#{web-design,seo,
  ads,leads}` + WebSite + WebPage. NO postal address and NO aggregateRating (self-serving
  review markup; the 4.9/5 stays plain on-page text). FAQPage separate block mirroring
  #faq exactly.
- H1s keyword-aware via section H2s (home H1 stays brand voice; H2s lead with the exact
  service keyword: "Web development that wins...", "SEO that climbs...", "Paid ads that
  buy...", "Lead generation that stays exclusive...").
- `<link rel="preconnect">` to assets.calendly.com on the landing page (the embed is the
  only third-party request).
- Images: width/height attrs, lazy below fold, descriptive alt with trade keywords.
- Three/GSAP dynamically imported after first paint → hero text is LCP, not canvas.

## 11. Copy voice rules (all writers)

Short declarative sentences. Concrete over clever. Second person. Sentence case headings.
No hype words (revolutionary, unleash, supercharge, next-level, elevate, seamless).
No em-dashes or en-dashes anywhere, hyphens only. Climb/peak metaphor max ~1 use per
section. Numbers stay real: 4.9/5, 70+, $7M+ (R114M+ for ZA, see §7), 2-3 weeks,
$140 packages, all from research.
Trust chorus (reuse verbatim): "No upfront payments. If you are not happy, you do not pay."
and "We reply within one business day."

## 12. Quality floor (reviewers verify)

WCAG AA computed (accent buttons use --accent-ink text ~10:1; --text-2 on --bg ≥4.5:1;
hover = lift + glow, never darker bg), visible focus, 44px targets, sequential headings,
skip link on every page, labeled fields + inline errors, keyboard reaches everything
(details/summary native, conveyor fallback focusable). Transform/opacity only; no
backdrop-filter on animated nodes; 360px zero horizontal overflow; rewind works; console
clean; `npm run build` passes; every page readable with JS disabled.

## 13. File ownership (build agents)

| File(s) | Owner |
|---|---|
| index.html | agent A |
| about/ services/ contact/ 404.html | agent B |
| free-audit/index.html + src/js/audit.js | agent C |
| blog/ + 3 posts | agent D |
| src/styles/main.css (everything) | agent E |
| src/js/scene.js | agent F |
| src/js/scroll.js + src/js/main.js + src/js/cylinder.js + src/js/pages/subpage.js | agent G |
| vite.config.js, package.json, public/*, sitemap, robots | orchestrator (me) |

Shared references: this file + `scratchpad/r-peak.json` (verbatim copy/testimonials) +
`scratchpad/cognexa/` (working reference implementation of scene/scroll patterns).
