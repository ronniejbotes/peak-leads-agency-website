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
/* Night half. The ground is the brand Ink; the accent is the brand blue
   lifted for legibility on it (Royal Blue #1070F8 itself is only 4.00:1
   here, so it never carries text - it lives inside the mark). */
--bg:            #111725;   /* brand Ink, page bg + theme-color */
--bg-raise:      #1a2234;   /* inputs, raised surfaces */
--panel:         rgba(26, 34, 52, 0.55);  /* glass; solid fallback 0.94 */
--panel-strong:  rgba(26, 34, 52, 0.78);  /* FAQ, cards, options */
--border:        #2A3448;   /* all 1px borders */
--text:          #EEF2F8;   /* cool white primary text (15.9:1) */
--text-2:        #A3AEC0;   /* secondary (7.99:1) */
--text-3:        #7C8798;   /* captions/labels only (4.92:1) */
--accent:        #5B9DFF;   /* brand blue, lifted. THE single accent:
                               buttons, links, q-nums, progress, particles */
--accent-ink:    #0A1220;   /* dark text ON accent buttons (6.88:1) */
--accent-soft:   rgba(91, 157, 255, 0.25);
--error:         #FF9C8D;   /* form errors on dark (8.86:1) */
--ok:            #7FCFA4;   /* success ticks (9.69:1) */
--star:          #DFA22E;   /* brand Crown Gold. Rating stars only (7.97:1) */
--radius:        14px;
```

Daylight half (`.theme-day`, scrubbed by `--day`): ground `#F4F6FB`, text `#111725`,
secondary `#5C6675` (brand Slate), accent `#0F3FB0` (brand Deep Blue, 8.24:1),
accent-ink `#FFFFFF`, star `#8A6212` (brand Deep Gold). Every pair above and here was
measured, not assumed; all clear WCAG AA for their role.

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

## 2b. Brand mark (the crowned infinity)

Replaces the bearded-mountaineer badge (`assets/images/logo.webp`, now unreferenced but
left in the repo during the transition). Brand name is unchanged: Peak Leads. "Crown
Infinity" in the brand PDF names the MARK, not the brand.

| File | Use | Notes |
|---|---|---|
| `assets/logos/peak-leads-mark.svg` | nav, footer, general | 8 kB. Transparent, no baked shadow. Reads on both nav pill states. |
| `assets/logos/peak-leads-mark-dark.svg` | dark grounds needing punch | Blues lifted 31% toward white so the dominant lands on `--brand-blue-lift`. |
| `favicon.svg` + `favicon.png` (64) | browser tab | Purpose-built variant: loop pushed down 20 units so the crown/loop channel survives at 32 px. |
| `apple-touch-icon.png` (180) | iOS home screen | Lifted mark on `--bg`, 14% padding. Opaque, as Apple requires. |
| `assets/logos/peak-leads-logo-512.png` | schema.org `Organization.logo` | Transparent 512x505. Raster because knowledge panels prefer it. |

**Provenance of the vector.** The 1254x1254 master PNG is NOT in this repo and was not on
the build machine. The SVG was traced from the 560x560 copy embedded in the brand PDF, at
4x upscale, then simplified (potrace, alphamax 1.334, mask pre-blurred 1.5 px). Measured
mean error against the source artwork is 4.5/255 (1.8%). `viewBox` is `0 0 867 855`, which
is the mark's own measured bounds, so geometry rules below survive any rebuild.

**Geometry.** X = crown height = 36.6% of mark height. Minimum clear space on all four
sides is 1/2X, i.e. 18.3% of the rendered mark height (7.3 px on the 40 px nav mark). The
nav already clears this: 10 px flex gap and >=14 px pill padding.

**Minimum sizes.** 48 px comfortable, 32 px hard floor. Below ~28 px the white channel
between crown and loop closes and the crown fuses into the loop, which is why the favicon
is a separate variant rather than a scaled-down mark. 16 px is a smudge in any variant.

**Colour.** The whole site runs the brand palette, not just the mark: the ground is the
brand Ink, the accent is the brand blue, and `--star` is the crown gold exactly. See
section 2 and the brand reference block in `main.css`. Royal Blue #1070F8 is the one brand
value the theme cannot use directly - 4.47:1 on white and 4.00:1 on Ink means it fails body
copy on both grounds, so it survives only inside the mark. Never set text in it, nor in
`--brand-gold` (2.25:1); the `-deep` pair is the text-safe one.

**Two corrections to the brand spec, measured from the artwork:**
- The spec calls it a five-point crown. It is three-point (tall centre spike, two arms).
- The spec's `--ribbon: linear-gradient(135deg, ...)` does not describe the mark. The real
  shading axis is near-vertical and explains almost nothing (R2 = 0.05): the ribbon is
  essentially flat #1070F8 with a darker band at the crossing that carries the over/under
  twist. The SVG reproduces that as a separate 45%-opacity path, not a diagonal gradient.

**Still outstanding (owner actions, not build actions):**
- The 1254x1254 master PNG has never been supplied. Everything here derives from a 560 px
  copy. Enough for screen; get the master before any print run.
- The artwork carries a signed C2PA manifest recording it as generated by OpenAI's
  `gpt-image` v2.0. Copyright in it as supplied is unlikely to be registrable. Trademark is
  a separate system and unaffected. A human vector redraw would fix authorship.
- Dominant blue #1070F8 sits within ten steps per channel of Facebook's #1877F2, on a blue
  infinity loop, for a business that sells Meta ads. That similarity needs an IP attorney
  before any filing, print run or launch push.

## 3. Pages (Vite MPA — every one listed in vite.config.js input)

| Path | Entry JS | Title (≤60ch) |
|---|---|---|
| `/` index.html | src/js/main.js | Lead Generation Company in South Africa \| Peak Leads |
| `/about/` | src/js/pages/subpage.js | About Bradley Hartmann, Founder \| Peak Leads |
| `/services/` | src/js/pages/subpage.js | Web Development, SEO & Paid Ads for Contractors \| Peak Leads |
| `/contact/` | src/js/pages/subpage.js | Contact Peak Leads \| Book a Call |
| `/book-a-call/` | src/js/audit.js | Book a Call \| Peak Leads |
| `/blog/` | src/js/pages/subpage.js | Contractor Marketing Insights \| Peak Leads Blog |
| `/blog/how-much-do-roofing-leads-cost/` | subpage.js | How Much Do Roofing Leads Cost in 2026? \| Peak Leads |
| `/blog/exclusive-vs-shared-leads/` | subpage.js | Exclusive vs Shared Leads: The Real Difference \| Peak Leads |
| `/blog/google-ads-vs-facebook-ads-for-contractors/` | subpage.js | Google Ads vs Facebook Ads for Contractors \| Peak Leads |
| `/web-design/` | src/js/pages/subpage.js | Web Design South Africa \| Live in 2 to 3 Weeks \| Peak Leads |
| `/seo/` | src/js/pages/subpage.js | SEO Services South Africa \| Local SEO Agency \| Peak Leads |
| `/ai-seo/` | src/js/pages/subpage.js | AI SEO South Africa \| Get Found In AI Search \| Peak Leads |
| `/google-ads/` | src/js/pages/subpage.js | Google Ads & Meta Ads Management South Africa \| Peak Leads |
| `/lead-generation/` | src/js/pages/subpage.js | Exclusive Lead Generation South Africa \| Peak Leads |
| `/pricing/` | src/js/pages/pricing.js | Lead Generation Pricing 2026 \| Peak Leads |
| `/thank-you/` | src/js/pages/thankyou.js | Call scheduled: 3 quick steps \| Peak Leads |
| `/book-a-call/` | src/js/pages/booking.js | Pick a time for your call \| Peak Leads |
| `/404.html` | subpage.js | Page Not Found \| Peak Leads |

Canonical host: `https://peakleads.agency` with trailing slash on folders. Every page:
unique meta description (150-160ch), canonical, OG (og:image `/assets/images/og-image-2.jpg`
1200×630, the branded share card built by `tools/og-card/build_card.py`; a page with its
own image, like a blog post, uses that instead), twitter:card summary_large_image, `<html lang="en">`, theme-color `#0D0C0A`,
and `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1,
max-video-preview:-1">` (404.html is `noindex`, and so are `/thank-you/` (9d) and
`/book-a-call/` (8b)).

## 4. Landing page section map (index.html)

All copy lives in HTML (readable with JS off). CSS never pre-hides content; GSAP owns
from-states. Eyebrow budget: max 3 on the whole page.

1. **`nav.site-nav`** - fixed glass pill bar (h 64px, max-w 1200px, radius-full).
   Brand: logo img `/assets/images/logo.webp` (40px) + "PeakLeads" bold. Links: Home `/`,
   About `/about/`, What We Do `/services/`, Testimonials `/#testimonials`, Blog `/blog/`.
   CTA pill "Book A Call" → `/book-a-call/` (the questions come before any calendar, §8). Mobile <900px: burger → dropdown (js-enabled gated;
   no-JS gets static wrapped row). 2px `.nav-progress` bottom edge, scaleX = --scroll-progress.
2. **`#hero`** (100svh, asymmetric: copy left max-w 620px, particles park RIGHT).
   Eyebrow "Build your presence." (the slogan), then H1: "Lead generation company for South
   African trades" (7 October 2026; the homepage's search is "lead generation companies south
   africa"). Sub: "We're a South African agency, and every lead we bring in is yours alone.
   We've helped businesses generate over \[$13 million | R220 million] in sales through our
   websites, SEO, AI SEO, paid ads, and lead generation systems." The amount is a
   `<span data-money-usd data-money-zar>` (see §7).
   CTAs: primary "Book a call" → `/book-a-call/`; ghost "What we do" → `/services/`.
   Nothing else.
3. **`#proof`** - 4 stat tiles (2-col mobile / 4-col desktop, count-up on view):
   `4.9/5` average client rating · `70+` reviews · `$13M+` \| `R220M+` client revenue
   generated (region-aware, §7) · `2-3wk` from call to live site. Mono numerals, plain
   layout, hairline separators (no cards). `.stat` is an inline-size container and
   `.stat-value` sizes in `cqi`, so a 6-glyph value ("R220M+") fits the column at every
   width and all four numerals stay the same size.
4. **`#vsl`** - H2 "Watch how we'd approach your business." Video 16:9 max-w 960px:
   `/assets/videos/vsl-2.mp4` (1920x1080 H.264, 1:59, faststart), poster
   `/assets/images/vsl-2-poster-400.webp` in the markup, replaced by main.js with
   `-960.webp` (`data-poster`) once the video is about a screen away, or `-1920.webp`
   (`data-poster-hd`) on a box wider than 480px and 960 device pixels, captions
   `/assets/videos/vsl-2.vtt`,
   preload=none (the poster covers the box; nothing of the video loads until play), controls. Accent 1.5px animated rim (conic gradient, chalk). One line
   under: "Bradley on why one size never fits all, and how we work out what your business
   needs. Two minutes." A `VideoObject` node in the homepage `@graph` mirrors the duration,
   poster and contentUrl, so update it whenever the video is replaced. Asset filenames are
   versioned (`vsl-2`, not `vsl`) because the Hostinger CDN serves replaced-in-place files
   stale for 7 days; never overwrite a published media file under its own name.
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
   reduced motion ONLY, not on the WebGL boot, and built as soon as #work comes within a
   screen of the viewport (IntersectionObserver, `rootMargin: 100% 0px`). Each `<figure>`
   is rebuilt in place - the `<a>` becomes the front face, the `<figcaption>` the back
   face (blurred reuse of the same screenshot), with extruded edge slices between them.
   Nodes are moved, never cloned, so the accessible copy stays single-sourced.
   9 cards 16:9 with real screenshots — note the file numbering is NOT display order:
   Cognexa (cognexa.co.za, `work-6.webp`) · Water Automation (waterautomation.com,
   `work-3.webp`) · The Leak Geeks (theleakgeeks.com, `work-4.webp`) · GreaterGood
   (greatergood.co, `work-1.webp`) · Tiny Homes SA (tinyhomesa.com, `work-5.webp`) ·
   Cajee Botes (cajeebotes.com, `work-7.webp`) · Position Xero (positionxero.com,
   `work-8.webp`) · Otaku Kulture (otakukulture.co.za, `work-9.webp`) · D&D Luxury
   (dndlux.com, `work-10.webp`). Front face carries browser chrome (dots + domain) and a
   caption plate; back face carries client, trade and domain.
   Needs ≥5 cards: below that the ring is too short to hide its own seam. Adding one is
   just another `<figure>` — the ring, wrap and fade all size themselves off the count.
7. **`#testimonials`** - H2 "Trusted by the trades." Asymmetric 2-col grid (1-col mobile) of
   4 quotes, each ≤3 lines, real names + initials monograms (`.avatar-initials`), not photos.
   Since 5 October 2026, with Bradley's go-ahead, a face goes beside a name only once that
   client supplies their own photo. The `avatar-*.webp` files still appear, unnamed, as faces
   in the hero orbits:
   Greg (Water Automation), Michael Anderson (Anderson Roofing & Renovations),
   Sarah Thompson (roofing), David Chen (plumbing). Verbatim quotes: builder MUST pull from
   `scratchpad/r-peak.json` + `scratchpad/page_about.html` (research copies). Star row
   (5 SVG stars, `--star`) on one featured tile only.
8. **`#process`** - H2 "From first call to first lead." 3 numbered rows (vertical, hairline
   left rule, no zigzag): 01 Book the call: "We map your market, your goals and where jobs
   are leaking." / 02 We build: "Website, SEO and campaigns assembled in a 2 to 3 week
   sprint. You get daily updates." / 03 You climb: "Leads land. We tune weekly. You book
   more jobs."
8b. **`#what-we-do`** (added 7 October 2026) - H2 "What we do as a lead generation company."
   Five short paragraphs of plain text, no panel: the trades served, exclusive lead generation
   for trades, outbound (appointment setting, email outreach, LinkedIn ads) for businesses that
   sell to businesses, the website/SEO/ads behind both, and a link to the "how to choose a lead
   generation agency" post. It sits after `#process` because the machine has faded out by then
   and stays gone until `#faq` (§6, scroll.js 5d), so bare copy reads cleanly. Only claims the
   service pages and `/pricing/` already make. Never links to another agency's site.
9. **`#book`** - H2 "Let's talk about your project." Sub: "30 minutes with Bradley. Free,
   direct, no pitch deck." Primary button "Book your call" → `/book-a-call/`, then "Six quick
   questions first, then pick a time that suits you. Or email" + the email link
   (`a[data-mail]`, see §9b). No calendar: until October 2026 this held the Calendly embed,
   which now lives on `/book-a-call/pick-a-time/` alone (§8b). The id stays, because links to `/#book`
   from outside the site still land here.
10. **`#faq`** - H2 "Questions, answered." 11 native `<details>` glass accordions, all
    carrying `open` so the answers are visible text at load (an open answer shows a minus,
    a closed one a plus). The first six are mirrored in FAQPage JSON-LD; the five added on
    28 Sep 2026 (leads verified, site ownership, ranking, SEO timing, AI answers) are not,
    because the SEO programme is removing that block (T-20): Are the leads exclusive? / What does it cost? (managed
    lead generation from R19,950 per month, other work scoped on the call) / How fast is the website live? (2 to 3 weeks) /
    Do I pay upfront? ("No upfront payments. If you are not happy, you do not pay.") /
    Which trades do you work with? / What happens on the call?
11. **`footer.site-footer`** - giant outlined "PEAKLEADS" marquee (text-stroke
    `--accent-soft`, transparent fill, slow scrub-driven x-drift), then: tagline "Websites,
    SEO, paid ads and exclusive lead generation for home service businesses.",
    email bradley@peakleads.agency,
    links (nav + Book a call + Blog + Instagram @bradley_mj_kid, LinkedIn), © 2026 Peak Leads.
12. **Floating "Say hi" bubble** - fixed bottom-right circular video `/assets/videos/bradley.mp4`
    (muted loop, 144px, border 3px bone), links to `/book-a-call/`, hides while #book visible,
    `aria-hidden` decorative label. Gated to js-enabled + pointer-fine + the 3D scene
    running, so it appears after the first interaction; never on /book-a-call/. Ships
    `hidden` so it cannot paint before main.js decides. Poster `bradley-144.webp`
    (`-288.webp` above 1x) is set on the first interaction, ahead of the bubble showing,
    and only where it can show (fine pointer, 900px and up).

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
endgame sphere (`#work` `top bottom+=25%` → `top 25%`, scrub 0.6, formation 5→6, all sizes;
timed to be COMPLETE before #work is on screen, so the card cylinder always turns in front
of a finished globe. That window is the 125vh dead zone where the formation driver has
already clamped to 5 — starts partway through station 04, no formation jump at the handoff.
Two consequences that are load-bearing: `applyFormation` folds `sphereT` in itself (the
morph ends while #services is still active, and two scrubbed triggers have no reliable
ordering once one stops updating), and `applyLateral` eases the park out by `sphereT`
rather than hard-centering, so the machine glides off station 04's panel on scroll instead
of swooshing on its own easing. Dim eased to 0.75); lateral
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
- **HTML ships ZAR.** South Africa is the primary market, so the ZA figures are written
  into the markup and are what crawlers and no-JS visitors get. USD is the override: the
  post-`#proof` script only rewrites for visitors resolved OUTSIDE South Africa.
  (This reverses the original USD-default rule; the head comment in index.html is
  authoritative and matches the code.)
- `$13 million` ≡ `R220 million` — one claim, two currencies, no live FX. Update both
  together or the site contradicts itself. Pairing set 2026-09-22 at R16.25/USD
  (open.er-api.com); re-derive the USD figure if the ZAR claim changes again.
- On `.stat-value` the swap also rewrites `data-count`/`-prefix`/`-suffix` so the count-up
  (§6) animates the region's own figure. Prices (`$140`) stay USD everywhere — they are a
  real price, not a converted claim.
- Meta/OG/JSON-LD carry the ZAR figure only: one canonical value per page, and it cannot
  be region-swapped because those are static head tags.

main.js: dynamic-import scene + scroll on the first sign of a person (pointermove,
pointerdown, touchstart, wheel, keydown or scroll; a load already scrolled by a /#hash
counts), never on a timer. The scene's init and the choreography's first refresh wait
until the scroll position has held still for six frames and, when an in-page link is on
its way somewhere, until it has arrived: run mid-scroll, the refresh cuts short the smooth
scroll that link (the first click, often) started. The link is held from its click
(capture phase), not from hashchange, which can arrive after the boot; the #work cylinder
build waits the same way only while such a link is travelling. A late boot finishes any
station reveal and #proof figure the visitor is already past or reading, rather than
blanking it and replaying it. A reload or Back is left where the browser restores it. Before that the page is the static DOM as served, which at
scroll 0 looks the same because the canvas draws nothing over the hero. All-or-nothing
gate → on any failure or `prefers-reduced-motion`: `body.no-3d` (canvas hidden, static
warm radial-gradient backdrop, everything readable). Also: nav burger, footer year,
email links, video posters, "Say hi" bubble, Facebook Pixel
`1586557796001231` (autoConfig off, so no automatic events; init + PageView;
standard `Lead` event when Calendly
`calendly.event_scheduled` postMessage fires; `QuestionsAnswered` custom event on funnel submit).
The Pixel runs on **every page** (8 October 2026): main.js, audit.js, pages/booking.js and
pages/subpage.js (which pricing.js and thankyou.js import) all call `armPixel()`, so a new
page on any of those entries gets it for free. Pixel loads on
the first interaction only (pointerdown, pointermove, touchstart, wheel or keydown; no
timer, and not a bare scroll event, which an anchor jump or a restored scroll position
fires with nobody there), or right before a conversion if it has not loaded yet:
`/book-a-call/pick-a-time/` passes book.js an `onBooked` that loads it for `Lead`, because a
booking can be made with nothing but taps inside Calendly's iframe. A visitor who never
interacts and never books sends no PageView.

Easter egg: typing `spiderman` on the landing page dynamic-imports `src/js/arcade.js`
(a 2D pixel web-swinging mini-game; see section 7b). The keystroke buffer ignores
INPUT/TEXTAREA/SELECT/contenteditable targets and any modifier combo, so it can never
swallow real typing, and the module is only fetched once the word completes.

## 7b. Easter egg arcade (`src/js/arcade.js`)

320x180 logical canvas, nearest-neighbour upscaled (integer factor above 2x). Fixed 60Hz
physics accumulator so the swing arc is identical on 60Hz and 144Hz panels; only drawing
is per-frame. Hold to fire a web at the ringed anchor, swing, release to launch, land on
the next roof. Score = rooftops landed; top 5 persist in `localStorage` under
`peak.arcade.scores` (`peak.arcade.muted` for audio).

Physics rules that are load-bearing (each one fixed a bug that made the game unplayable):
- One-sided rope constraint (pulls, never pushes) + a tangential **pump** while taut.
  Launching from a rooftop starts you level with the bottom of the arc, so without the
  pump there is no height to trade for speed and every swing is a limp drop.
- Landing requires a real descent while roped (`vy > 0.5`); unroped it accepts `vy >= 0`
  so simply *resting* on a roof keeps the grounded flag. Firing a web from a standstill
  otherwise satisfies the landing test on frame one and drops the rope instantly.
- The roof you launch from is intangible while the web is taut (`launchId`), so arcing
  back across it is neither a landing nor a wall impact.
- Consecutive roof heights are generated relative to each other, never absolutely -
  absolute heights produce gaps no arc can clear, which reads as the game cheating.
  Difficulty is gap width + roof width, and there is always one anchor per gap.

High score capture: a run that makes the top 5 (and scored above 0) raises a name + email
form before the board is repainted. SAVE posts `{name, email, score, source}` to the same
`formsubmit.co/ajax/bradley@peakleads.agency` endpoint the booking questions use, so it
lands in the same inbox; delivery failure is non-blocking because the local board already
has the entry. SKIP (and ESC) still records the score, anonymously. The form is
`novalidate` — the browser's native bubble would block submit before the handler runs, so
its errors would never be seen; validation is ours and styled to match.

Input guards that matter: SPACE is both "shoot a web" and a space character, and the game's
key handler runs in the CAPTURE phase, so it stands down entirely when the event target is
an INPUT/TEXTAREA. ESC is layered — it backs out of the form first, the game second.
Pointer presses inside `.arcade-form` / `.arcade-controls` are controls, not swings.

Assets: none. The hero is a string-map sprite (an original design; only the red/blue colour
scheme is the familiar one) and the soundtrack is an original chiptune synthesised at
runtime through the Web Audio API - square lead, triangle bass, filtered-noise drums,
scheduled with a 25ms lookahead. Nothing is fetched, so the egg costs zero transfer until
triggered and zero bytes of media ever. The AudioContext is created inside the trigger
keydown, which is the user gesture autoplay policy requires. Music toggles from a labelled
button under the canvas or the M key; the preference persists.

Board entries are `{s, n}`; builds before names existed stored bare numbers, and those are
normalised on read rather than discarded.

`import.meta.env.DEV` gates a `root.__debug()` state accessor for driving the game from a
headless browser; it is statically dropped from production builds.

## 8. Booking questions (`/book-a-call/` + `src/js/audit.js`)

**Every booking starts here** (Bradley's brief, October 2026). Every "Book a call" on the
site links to `/book-a-call/`. The calendar lives on `/book-a-call/pick-a-time/` alone
(8b), and only answers that qualify reach it.

**Never call it an audit, or a free audit, anywhere a visitor can see** (Ronnie, 8 October
2026): not in a button, link, heading, meta description, title, alt text or post CTA. It
is booking a call. Until that date it lived at `/free-audit/`; `public/.htaccess` sends
that address to `/book-a-call/` with a 301 (query string kept, so ad UTMs survive). The
file and class names (`audit.js`, `.audit-shell`) are internal and stay.

Full-screen shell on the light ground (9c), no site nav (brand wordmark + Contact link +
X → `/`). Same particle canvas behind (formation morphs per step, walking 0→5, then the
PEAK for the calendar hop and the SPHERE for the other ending), radial backdrop scrim so
particles stay visible. 4px fixed top progress bar (accent), width (step)/(total). One
question per screen, `.in` slide-up entrance, Enter advances, auto-focus, Back button from
step 2, "N of 6" counter, error lines aria-live, honeypot input name `pl_extra`,
localStorage prefill `pl_lead`, plus the outbox `pl_lead_outbox` and the hand-off
`pl_booking`, both owned by `src/js/lead.js`.

Steps (labels Geist 800, q-num accent "N →"). 1 to 3 are the contact details; 4 to 6 are
Bradley's questions, worded as he sent them:
1. name: "What's your full name?" placeholder "Name and surname"; two words at least.
2. email: "What's your email address?"
3. phone: "What's the best contact number?" tel, `/^\+?\d{7,15}$/` after stripping.
4. business: "Tell us about your business." sub "What industry are you in, and what's your
   website or social media link?" One short-answer field, min 2 chars.
5. help: "What do you want help with most right now?" sub "Choose as many as apply."
   Checkbox cards 2-col: Generate more qualified leads / Increase sales/revenue / Improve
   our website & Google presence / Grow our social media & brand / Improve our paid
   advertising / All of the above. "All of the above" ticks every box, and ticking every
   other box ticks it.
6. revenue: "What is your business currently generating in monthly revenue?" radio:
   Under R30,000 / R30,000 to R75,000 / R75,000 to R150,000 / R150,000 to R300,000 /
   R300,000 to R500,000 / R500,000+. Each option carries `data-floor`, the bottom of its
   band in rand. Button "Send my answers".
Intro screen: only the H1 (`.q-label` size) "Just a few questions to see if we are a good
fit for your business." and a Start button under it. No eyebrow, sub, key hint or "free
audit" wording (Ronnie, 8 October 2026). The privacy notice line sits under "Send my
answers" instead, where the answers leave the browser.

**Two endings, decided in audit.js and nowhere in the markup.** Every finished set of
answers is emailed to the team. Then:
- A revenue floor at or above `BOOKING_MIN_REVENUE`: `#screen-next`, "You're on the way
  up." with the condense pulse, then on to `/book-a-call/pick-a-time/` once the lead is acknowledged
  and the QuestionsAnswered event has gone, never later than `LEAVE_BY`. A "Pick a time" button is the
  manual route.
- Below it: `#screen-thanks`, "Thanks for your answers, {first name}." / "Unfortunately,
  based on the answers you've provided, we're not able to assist you right now. One of our
  team members may be in touch in future." Buttons "Back to the site" → `/` and ghost
  "Read the blog" → `/blog/`. No calendar link anywhere on it.
- A browser that was turned away keeps that answer for `DECLINE_HOLDS_FOR`, 2 hours from
  the first refusal, whatever it answers in that time, so reloading and picking a bigger
  band does not open the calendar straight away. Short on purpose (Ronnie, 7 October
  2026): it stops an instant retry, never shuts a business out. Answers in that window still
  reach the team, quoting the earlier answer and how long ago it was. Testing both endings
  therefore needs a fresh private window per run, or a 2 hour wait.

**Nothing a visitor can see may hint that one answer leads somewhere different**, or people
would simply pick the other answer: no copy, label, id, class or attribute that names the
rule (`data-floor` is a plain band value), and the visitor's own mailto fallback carries
only their answers. The outcome goes to the team alone, in the email.

Submission: POST JSON to `https://formsubmit.co/ajax/bradley@peakleads.agency` with `name`,
`email`, `phone`, `business`, `helpWith`, `monthlyRevenue`, `booking` (the outcome, for the
team), `cameFrom` (the referring page or host, plus any utm params) and `page`. `_subject`
is "New call request: {name}", or "New call request (disqualified): {name}" (until 8
October 2026 these said "free audit request"). The visitor's mailto fallback subject is
"Call request: {name}".
Honeypot-suppressed (a bot gets the no-call ending; nothing is sent or stored), mailto
fallback, config const slot `LEAD_WEBHOOK` at the top of `lead.js` for a future Apps
Script/Web3Forms swap. Fire Pixel `Lead` on every real submission. Page is `noindex`? NO:
index it (title above), but exclude from nav clutter. JSON-LD WebPage + BreadcrumbList.

## 8b. `/book-a-call/pick-a-time/` — the calendar after the questions (added October 2026)

The only page on the site with a booking calendar, and so the only place a call can be
booked (entry `src/js/pages/booking.js`). `noindex, follow` and deliberately **not** in
`public/sitemap.xml`, like `/thank-you/`.

- **The gate.** An inline script at the top of `<head>` reads `pl_booking` and sends anyone
  without open answers under seven days old back to `/book-a-call/` before the page
  draws: a typed address, a shared link, an old bookmark, a browser that was turned away.
  A store the browser will not let it read lets the visitor through rather than lock
  finished answers out. Until 8 October 2026 this page was `/book-a-call/` itself; it moved
  down a level when the questions took that address, and needs no redirect because the old
  address is now the start of the same flow. `src/js/lead.js` owns the format; keep the seven days in step with
  `BOOKING_OPEN_FOR` there.
- **No booking link in the markup.** booking.js sets the embed's `data-url` and the "Open
  it on Calendly" fallback href, filled in with the name and email just given so nobody types
  them twice. Spaces go out as `%20`, never `+`: Calendly's widget.js passes a `+` through
  literally, so "Thandi Nkosi" would arrive as "Thandi+Nkosi".
- **Source.** `utm_campaign` is the slug of the page that sent the visitor to the
  questions (`book-a-call` when they came straight in; `free-audit` before 8 October 2026), and campaign params they arrived with ride
  along and win, as they always have. book.js fills the remaining `utm_*` keys
  (`utm_content` = `book-embed` or `text-link`).
- **book.js** lazy-loads widget.js, fires the `Lead` event when Calendly reports a booking,
  then sends the visitor to `/thank-you/` (9d). It leaves 1.5s after the booking, so
  Calendly's "You are scheduled!" registers; where the conversion went to a Pixel that was
  not loaded yet, it also waits for fbevents.js to come up plus 1s. It never waits more
  than 4s, so an ad blocker cannot strand anyone. A booking made on calendly.com through
  the fallback link never comes back here.
- It flushes the lead outbox, so answers that were not acknowledged before the hop are sent
  from here.
- Funnel chrome (wordmark, Contact, X) on the light ground, no particle canvas. Eyebrow
  "Last step", H1 "Pick a time for your call, {first name}." The page's own copy does not
  name who the call is with (see 9d).

## 9. Subpages (about / services / contact / blog / 404)

`body.page-static`: NO 3D canvas; **runs in daylight end to end** (see 9c) over a
fixed radial-gradient backdrop (deep blue and gold 3-6% glows on the light ground). Same nav (non-pill variant OK, same links) + footer (no giant marquee, compact).
- **/about/**: H1 "The person behind Peak Leads." Founder story: Bradley Hartmann, South
  African, builds for US home-service businesses; discipline/"locked in" work ethic, faith
  and family grounded, straight-talking; photo `/assets/images/bradley.webp` (from
  image1.png). Mention coaching arm one line. Personal, sincere, zero hype. CTA → /book-a-call/.
- **/services/**: H1 "What we do." 4 anchor sections `#web-design #seo #ads #leads`
  expanding the stations. H2s carry the exact target keywords: "Web development for
  contractors." / "SEO for contractors." / "Paid ads for contractors." / "Exclusive lead
  generation for contractors." Body copy keeps "web design" and "Google Ads" alive so both
  the old and new phrasings still rank. Each: what you get list,
  who it's for, mini-FAQ line, CTA. Service JSON-LD ×4 (provider → Organization,
  areaServed US).
- **/contact/**: H1 "Talk to us." Email, a "Book a call" link to `/book-a-call/`,
  IG/LinkedIn, simple no-backend form (formsubmit.co action post,
  name/email/phone/message) + a note linking to `/book-a-call/`.
- **/blog/**: H1 "Insights for the trades." Card grid (16:9 thumbs
  `/assets/images/blog-{slug}.webp`, fallback shared placeholder OK at build time).
- **3 posts**: 1200-1800 words each, H1 = title, answer-first highlighted box, H2 question
  subheads, concrete numbers from research (roofing leads $41-150 shared vs exclusive
  economics, channel comparisons), internal links to `/services/` sections + other posts,
  honest voice, BlogPosting JSON-LD (author the Organization, datePublished 2026-07-30),
  CTA box → /book-a-call/.
- **No author name on any post, present or future** (owner's decision, 7 October 2026).
  A post has no byline: no person's name, photo or role as its author. Under the H1 it
  shows the date alone, `<p><time datetime="2026-10-01">1 October 2026</time></p>`. The
  BlogPosting JSON-LD `author` is the Organization, never a Person:
  `"author": { "@type": "Organization", "@id": "https://peakleads.agency/#organization", "name": "Peak Leads", "url": "https://peakleads.agency/" }`.
  The post's entry in the `/blog/` JSON-LD `blogPost` list carries the same author, and
  its `/blog/` card shows the date, never a name. `publisher` stays as it is. No `author`
  or `article:author` meta tag.
- **/404.html**: "Wrong turn on the climb." Link home + popular pages.

## 9c. Daylight on every non-landing page (added 2026-08-26)

The landing page keeps the scrubbed night -> day climb. **Every other page is light,
end to end.** The mechanism is the existing `.theme-day` token block, applied to `<body>`
rather than section by section:

- `.theme-day, body.page-static, body.page-funnel` share one token block, and
  `body.page-static` / `body.page-funnel` pin `--day: 1`. Everything inside inherits the
  light ramp, so a new page needs no per-section `.theme-day` stamping.
- `body::after` paints the `#F4F6FB` ground off the same `--day`; `body.page-static::before`
  restates the three backdrop glows in daylight values.
- Surfaces that were hardcoded dark now scrub with `--day` using the two-declaration guard
  (night literal first, `color-mix` second): `.glass-solid`, the nav dropdown panel,
  `.option-card`, `.post blockquote`, `.blog-card`.
- `/book-a-call/` (the questions) keeps its particle canvas and carries `body.page-funnel`. `audit.js` calls
  `sceneCall('setDay', 1)` at boot so the points render as graphite on paper, and
  `.audit-shell::before` is a **white** scrim, not the original soot one.
- `html:has(body.page-static)` sets `color-scheme: light` so form controls and scrollbars
  follow the page. Cosmetic only; a browser without `:has()` just keeps dark UA chrome.

**Adding a page: give `<body>` `page-static` and it is light. Do not add `.theme-day` to
its sections.**

## 9d. `/thank-you/` — the post-booking page (added 2026-09-30)

Where a visitor lands once a call is actually booked. **This is the one page on the
site whose job is dwell time rather than search traffic**: it holds a new lead's attention,
keeps the pitch fresh in their memory and buys Bradley time to get back to them. It is
`noindex, follow` and deliberately **not** in `public/sitemap.xml` — a visitor arriving here
from a search result would be told their call is booked when it is not.

**It is wired to Calendly, not to a form, and the redirect lives in this repo** (added
2026-10-04). `src/js/book.js` hears Calendly's `calendly.event_scheduled` from the embed on
`/book-a-call/`, the only one on the site, reports the conversion, and sends the visitor
to `/thank-you/` — see 8b for the timing. It
does not use Calendly's own setting (Event type > Confirmation page > Redirect to an external
site): that needs a paid Calendly plan and cannot wait for the Pixel. **The gap:** someone who
books on calendly.com through the "Open it on Calendly" fallback on `/book-a-call/pick-a-time/` never
comes back to the site, so
only that Calendly setting could send them here. If it is ever switched on, test an embed
booking again, because nobody has checked how Calendly's redirect behaves inside the embed.
The contact form's `_next` still points at `/contact/?sent=1`, and the booking questions end
on `/book-a-call/pick-a-time/` or on their own no-call screen, never here, because the hero video opens with
"thank you for booking this call" and that sentence is false for anyone who only filled in a
form.

Structure (Bradley's brief, 5 October 2026): a dark Ink banner, "Congratulations on scheduling
your call!" with a gold warning line asking people to complete all 3 steps, then three numbered
steps joined by a dashed rule, then "Still have a few minutes?" with three links back into the
site.

1. **Accept the call invite.** One sentence, then two drawn invites side by side ("In your email"
   OR "In your calendar") with Yes lit up. They are HTML, not screenshots, and `aria-hidden`: the
   sentence says everything they show, and a drawing has no real inbox or names to go stale.
2. **Watch this 50 sec video and FAQs.** The hero video (50.5 s), then straight into the five
   answer videos as cards. `id="questions"` stays on this step because the nav CTA links to it.
3. **See what's possible.** Bradley's line, then the homepage's four testimonials, word for word
   and with the same initials in place of photos. Each card leads with the trade and an "In their words" line,
   which is a verbatim fragment of that client's own quote, never a paraphrase or a number.
   Anything that changes in `#testimonials` on the homepage changes here too.

**Nothing on the page names who the call is with.** Bradley asked for that on 5 October 2026,
because two or three people will be taking these calls, so "Before you and Bradley speak", the
caption under the hero and "What happens next?" ("Thirty minutes with Bradley ... you are
speaking to him, not to a salesperson") all came out. The hero video itself is still Bradley
speaking, as the founder, and the email line at the foot still reaches him.

**This is the one page that deliberately breaks 9b and carries no book-a-call band.** The
visitor reached it *by booking a call*; putting a "Book your call" band under it invites a
second booking for the same lead and reads as though the first one did not register. The
three links at the foot do that job instead. `thankyou.js` imports `subpage.js` for styles,
nav, footer year and email links; neither touches book.js.

**Video assets.** All six were supplied as 4K HEVC Main 10, which Chromium reports `""` for —
they would not have played for most visitors, exactly like the September VSL. Transcoded to
1080p H.264 8-bit, faststart, two-pass EBU R128 to −16 LUFS (the masters sat at −25 to −27 dB
mean, well under the homepage VSL). 259 MB in, 24 MB out. The masters are **not** in the repo:
`/*.mp4` is gitignored at the root, and `FAQ.mp4` at 124 MB is over GitHub's hard file limit
anyway. Filenames carry a `-1` version suffix for the same reason `vsl-2` does — the Hostinger
CDN serves replaced-in-place files stale to real browsers for 7 days.

**Autoplay (`src/js/pages/thankyou.js`).** The hero starts on its own 2s in, or when it scrolls
into view if it is off screen by then, which, now that it sits in step 2, is the usual case. It tries **with
sound first**; whether the browser allows that depends on the browser, and on whether it
counts the booking click (made inside Calendly's iframe on the page before) as a gesture on
this site. On refusal it falls back to muted and raises a "Tap for sound" button.
**Pressing that button restarts the video from 0**, because somebody who unmutes at 0:08 has
already missed the opening line, which is the hook. Verified in headless Chrome under both
`--autoplay-policy` settings.

Two rules worth keeping if this code is touched: the takeover flag listens for **real input**
(`pointerdown`/`keydown`/`click`), never for media events — `play` and `volumechange` fire for
the script's own calls, and using them made the script mistake itself for the visitor and leave
the hero playing silently with no way to turn sound on. And starting any video pauses every
other one, hero included.

**Captions are not optional here.** The answers exist only as speech, so each video carries a
hand-corrected `.vtt`. They are also the text alternative that keeps the page accessible
without writing the answers out — which is deliberate, because four of the five answer videos
make claims that do not match the published site. See
`seo-program/plans/peak-leads/LOG.md` for that reconciliation.

## 9b. Book-a-call band (EVERY page, including every future page)

**No page carries a Calendly embed or a calendly.com link except `/book-a-call/pick-a-time/`
(8b).** A call is booked only after the questions, so every "Book a call" on the site, this
band's button included, goes to `/book-a-call/`. Never `/free-audit/`, and never the words
"free audit" (§8). Until October 2026 this band WAS the embed: a page
or post copied from an older one must have it swapped for the block below.

Every page ends in the same band. Home and /pricing/ keep their own long-standing `#book`
sections, with the same button and line; every other page carries the `.book-band` block
below, placed as the last child of `<main>`, after the article and before the footer.

```html
<section id="book" class="book-band" aria-labelledby="book-heading">
  <p class="eyebrow">Book a call</p>
  <h2 id="book-heading">PAGE-SPECIFIC QUESTION</h2>
  <p class="book-sub">Thirty minutes with Bradley. PAGE-SPECIFIC PROMISE.</p>
  <p class="book-cta"><a class="btn btn-primary" href="/book-a-call/">Book your call</a></p>
  <p class="book-alt">Six quick questions first, then pick a time that suits you. Or email <a href="/contact/" data-mail="bradley">bradley<span class="mail-at"></span>peakleads.agency</a>.</p>
</section>
```

**Copy is the only thing you write.** The `<h2>` is the question a reader of *that page*
is holding when they reach the bottom, and the sub-head is what the call gives them.
Never the generic "Let's talk about your project" — that is the homepage's line. A blog
post about lead costs asks "Want to know what a roofing lead is worth to you?"; the SEO
page asks "Want to know why you are not ranking?". If the band could be copy-pasted onto
another page unchanged, the copy is wrong.

**Nothing else to wire**: no embed and no widget script. The id stays `book`,
so links to `/#book` or `/pricing/#book` from outside the site still land on a way to book.

A post's CTA box (`aside.post-cta`) may name what the questions ask, but only what they
really ask (§8), and says that a call follows: "..., then pick a time for a free 30 minute
call." Its button reads "Book a call" and links to `/book-a-call/`.

The email link in the block never carries a literal address in the HTML. CSS paints the
`@` (`.mail-at::before`), so it reads and is announced as the full address, and
`src/js/email.js` (called by every entry) points the href at the mailto and swaps in a
real `@` the first time a pointer, finger, keyboard focus, click or copy reaches it.
With JS off it links to /contact/. Use the same markup anywhere the address appears.

So a new page or blog post needs **no JS change**: paste the block, write two lines of
copy, done.

## 10. SEO layer

- `public/robots.txt`: allow all + `Sitemap: https://peakleads.agency/sitemap.xml`.
- `public/sitemap.xml`: all 9 URLs, lastmod 2026-08-04.
- **Market: South Africa first, United States second.** All `areaServed` is
  `South Africa`; the US is served and priced (see `/pricing/`) but is not the
  primary SEO target. Changed 2026-08-26; the doc previously said `areaServed US`.
- **Google Local Services Ads do not exist in South Africa.** Verified against
  Google's own country selector 2026-08-26: Austria, Belgium, Canada, France,
  Germany, Ireland, Italy, Spain, Switzerland, UK, US. Never offer LSA or the
  Google Guaranteed badge to a ZA client. `/google-ads/` and two blog posts say so
  explicitly and that copy must not be softened.
- **Primary target keywords: lead generation, web development, SEO, AI SEO, paid ads.** Every one
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
  the first six #faq questions (see #faq in §4).
- Home H1 names the homepage's search ("Lead generation company for South African trades",
  7 October 2026); the slogan stays above it as the eyebrow. Section H2s lead with the exact
  service keyword: "Web development that wins...", "SEO that climbs...", "Paid ads that
  buy...", "Lead generation that stays exclusive...").
- No Calendly prefetch on the landing page: the calendar left it in October 2026.
  `/book-a-call/` preconnects to calendly.com and assets.calendly.com instead, because
  there the calendar is the page and loads at once.
- Images: width/height attrs, lazy below fold, descriptive alt with trade keywords.
- Three/GSAP dynamically imported on the first interaction → hero text is LCP, not canvas.

## 10b. Comparison tables

Real `<table>` markup, never a div grid: search engines and assistants extract tables.
Wrap in `<div class="table-scroll">` so the wrapper scrolls and the table keeps its
caption and row-header semantics. Add `table-scroll-prose` when the cells are sentences
rather than figures; `.post td` is `nowrap` by default so money never breaks mid-figure,
and the prose variant inverts that.

## 11. Copy voice rules (all writers)

Short declarative sentences. Concrete over clever. Second person. Sentence case headings.
No hype words (revolutionary, unleash, supercharge, next-level, elevate, seamless).
No em-dashes or en-dashes anywhere, hyphens only. Climb/peak metaphor max ~1 use per
section. Numbers stay real: 4.9/5, 70+, $13M+ (R220M+ for ZA, see §7), 2-3 weeks,
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
| book-a-call/index.html (then free-audit/) + src/js/audit.js | agent C |
| blog/ + 3 posts | agent D |
| src/styles/main.css (everything) | agent E |
| src/js/scene.js | agent F |
| src/js/scroll.js + src/js/main.js + src/js/cylinder.js + src/js/arcade.js + src/js/pages/subpage.js | agent G |
| vite.config.js, package.json, public/*, sitemap, robots | orchestrator (me) |

Shared references: this file + `scratchpad/r-peak.json` (verbatim copy/testimonials) +
`scratchpad/cognexa/` (working reference implementation of scene/scroll patterns).
