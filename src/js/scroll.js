/*
 * Peak Leads - src/js/scroll.js
 * GSAP + ScrollTrigger choreography for "The climb".
 *
 * Contract (DESIGN.md section 6):
 * - export function initScrollChoreography(scene) -> cleanup function.
 * - No THREE imports here. The scene is only touched through the guarded
 *   sceneCall bridge; a scene error must never break scrolling.
 * - Everything is scrubbed or scroll-toggled, so scrolling back rewinds it.
 * - CSS never pre-hides content. Every reveal is a gsap.from(...), so the
 *   hidden from-state exists only while this choreography runs. With JS off
 *   or body.no-3d, all content stays fully visible.
 * - Hot paths (onUpdate handlers) allocate nothing beyond the CSS var string.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/* Make every ScrollTrigger.refresh() immune to CSS
   `html { scroll-behavior: smooth }` (used for nav anchor jumps).
   refresh() measures triggers by snapping the scroller and reading rects;
   with smooth scrolling active that snap ANIMATES instead of jumping, so a
   refresh fired at a non-zero scroll (bfcache restore, resize) measures
   every start/end off by the current offset and the pinned station stages
   collapse. Forcing scroll-behavior:auto around the measurement fixes it
   for our refreshes AND ScrollTrigger's internal resize/load refreshes. */
let refreshPatched = false;
function patchSmoothSafeRefresh() {
  if (refreshPatched || typeof ScrollTrigger.refresh !== 'function') return;
  refreshPatched = true;
  const origRefresh = ScrollTrigger.refresh.bind(ScrollTrigger);
  ScrollTrigger.refresh = function () {
    const d = document.documentElement;
    const prev = d.style.scrollBehavior;
    d.style.scrollBehavior = 'auto';
    try {
      return origRefresh.apply(null, arguments);
    } finally {
      d.style.scrollBehavior = prev;
    }
  };
}

/* Re-entrancy guard: if init is called again before the previous cleanup
   ran (reduced-motion round trip and back), tear the old build down first. */
let activeCleanup = null;

export function initScrollChoreography(scene) {
  gsap.registerPlugin(ScrollTrigger);
  patchSmoothSafeRefresh();

  if (activeCleanup) activeCleanup();

  const html = document.documentElement;
  const clamp = gsap.utils.clamp;

  /* Guarded bridge to the particle engine (src/js/scene.js). */
  function sceneCall(method, a, b) {
    if (scene && typeof scene[method] === 'function') {
      try {
        scene[method](a, b);
      } catch (err) {
        /* Decorative layer only - swallow and keep scrolling. */
      }
    }
  }

  /* ==================================================================
   * Lateral parking state (>=900px only, via gsap.matchMedia below).
   * parks[0] = hero (copy left, particles park right), parks[1..4] = the
   * four stations (particles park opposite each .station-inner panel).
   * Measured from live rects so it tracks fluid padding and max-widths.
   * Flat typed arrays keep applyLateral allocation-free.
   * ================================================================== */
  const parkOffset = new Float64Array(5); /* px from viewport center */
  const parkStrip = new Float64Array(5);  /* free strip width in px */
  let lateralEnabled = false;
  let lastF = 0;

  const services = document.querySelector('#services');
  const stations = services
    ? Array.prototype.slice.call(services.querySelectorAll('.station'))
    : [];
  const heroInner = document.querySelector('.hero-inner');
  /* Park against the 620px copy block, not the 1200px container: the
     container leaves no free strip at normal desktop widths. */
  const heroCopy = document.querySelector('.hero-copy') || heroInner;
  /* --scroll-progress is consumed only by .nav-progress: writing it on the
     nav subtree keeps per-frame style invalidation off the whole document. */
  const progressHost = document.querySelector('.site-nav') || html;

  function measurePark(el, i) {
    parkOffset[i] = 0;
    parkStrip[i] = 0;
    if (!el) return;
    const vw = window.innerWidth;
    const rect = el.getBoundingClientRect();
    const leftFree = rect.left;
    const rightFree = vw - rect.right;
    const free = Math.max(leftFree, rightFree);
    /* Too narrow to be worth the swing: stay centered. */
    if (free < vw * 0.3) return;
    const sign = rightFree >= leftFree ? 1 : -1;
    /* Center of the free strip, relative to the viewport center. */
    parkOffset[i] = sign * ((vw - free) / 2);
    parkStrip[i] = free;
  }

  function measureParks() {
    viewportW = window.innerWidth;
    measurePark(heroCopy, 0);
    for (let i = 0; i < stations.length && i < 4; i++) {
      measurePark(stations[i].querySelector('.station-inner'), i + 1);
    }
  }

  /* Hold at one side while a station is centered, cross over during the
     handoff: the middle half of each formation-to-formation span does the
     travelling, so the particles are parked and still while you read. */
  function applyLateral(f) {
    /* The endgame sphere never dodges: pinned dead center once formed. */
    if (sphereT >= 1) {
      sceneCall('setLateral', 0, 0);
      return;
    }
    if (!lateralEnabled && zoneT <= 0) {
      sceneCall('setLateral', 0, 0);
      return;
    }
    /* Park target in viewport FRACTIONS (setLateral reads |v| <= 1 as a
       fraction) so it can blend with the zone gutter below.
       parks are indexed hero 0, stations 1..4. Stations hold formations
       2..5 (ARROWS 0 and PLAY 1 both live above them), so formation
       space maps to park space shifted down by 1. */
    let offFrac = 0;
    let stripFrac = 0;
    if (lateralEnabled) {
      const pf = clamp(0, 4, f - 1);
      const i = Math.min(Math.floor(pf), 3);
      let t = clamp(0, 1, (pf - i - 0.25) / 0.5);
      t = t * t * (3 - 2 * t); /* smoothstep */
      const halfW = viewportW / 2;
      offFrac =
        (parkOffset[i] + (parkOffset[i + 1] - parkOffset[i]) * t) / halfW;
      stripFrac =
        (parkStrip[i] + (parkStrip[i + 1] - parkStrip[i]) * t) / viewportW;
    }
    /* Scrubbed blend toward the #vsl left gutter. A park strip of 0
       means "unconstrained", so blend from a full-width strip instead -
       passing a near-zero strip through the mix would shrink the
       machine to a dot on the way across. */
    const zt = zoneT * zoneT * (3 - 2 * zoneT);
    if (zt > 0) {
      const baseStrip = stripFrac > 0 ? stripFrac : 1;
      offFrac += (ZONE_SIDE * 0.86 - offFrac) * zt;
      stripFrac = baseStrip + (ZONE_STRIP - baseStrip) * zt;
    }
    /* Un-park on the way into the sphere. The morph now begins while station
       04 is still being read, so the machine is parked beside its panel when
       it starts: releasing the park in one go makes it swoosh to center on
       its own 0.08/frame easing, untied to the scroll. Blending it out by
       sphereT keeps the whole handoff scrub-driven, and rewinds identically.
       Strip blends toward 1 (full width), never through 0 - a near-zero
       strip on the way past would pinch the machine to a dot. */
    if (sphereT > 0) {
      const st = sphereT * sphereT * (3 - 2 * sphereT);
      offFrac += (0 - offFrac) * st;
      const baseStrip = stripFrac > 0 ? stripFrac : 1;
      stripFrac = baseStrip + (1 - baseStrip) * st;
    }
    sceneCall('setLateral', offFrac, stripFrac);
  }

  /* ==================================================================
   * Reading dim: while a copy-heavy section occupies the viewport the
   * particles recede so the text stays readable.
   *
   * #faq is deliberately NOT in this list any more. Its question marks are
   * built to sit in the gutters either side of the 880px accordion column
   * (see buildQuestions), so there is nothing for them to obscure - and
   * dimming them would hide the one formation meant to be looked at.
   * Two flags rather than toggling per section, so overlapping ranges
   * cannot blank each other on the way out.
   * ================================================================== */
  const dimState = [false];

  /* Content-avoidance for #vsl (desktop): while the video occupies the
     viewport the machine swims to the LEFT gutter beside it, scaled to
     the strip and slightly dimmed. zoneT is SCRUBBED 0..1 by a trigger
     inside the matchMedia block, and applyLateral blends the park target
     toward the gutter by it - the swing across the screen is tied to
     scroll position, so it can never snap the way the old on/off toggle
     did. From #work onward the endgame sphere owns the machine and never
     dodges again. */
  let zoneT = 0;
  const ZONE_SIDE = -1;
  const ZONE_STRIP = 0.24;
  const ZONE_DIM = 0.7;
  let viewportW = window.innerWidth;
  /* 0..1 progress of the GROWTH -> SPHERE endgame morph. While > 0 the
     sphere owns the machine: dead center, no parking, no zones. */
  let sphereT = 0;
  /* 0..1 daylight crossing (see section 5c). Read by applyDim: the machine
     has to recede further once it is dark particles on a light ground. */
  let dayT = 0;
  /* 0..1 SPHERE -> QUESTIONS morph across the #book to #faq handoff, and the
     blackout that hides the machine while the Calendly embed is on screen.
     See section 5d. */
  let questionT = 0;
  let hideT = 0;
  let footerHideT = 0;

  /* The formation value below the stations. sphereT carries GROWTH(5) up to
     SPHERE(6), questionT carries SPHERE(6) on to QUESTIONS(7). Every driver
     that can fire down here routes through this: holdEndgame runs on any
     ScrollTrigger refresh, so without it a resize while you are reading the
     FAQ snaps the question marks back to the globe. */
  function endgameF() {
    return 5 + sphereT + questionT;
  }

  function applyDim() {
    /* Reading-dim floor. 0.4 was tuned for chalk burning additively over the
       dark half, where the machine sits BEHIND copy no matter how bright it
       gets. Past the daylight seam the same particles are dark graphite on a
       light ground, so an identical alpha stops reading as depth and starts
       reading as haze laid across the text - worst over #process, the only
       section down there with bare copy and no panel under it. Drop the
       floor as --day comes up. */
    const floor = 0.4 - 0.24 * dayT;
    let base = dimState[0] ? floor : 1;
    /* The endgame sphere recedes a touch so it reads as a background
       behind content, never a wash over it. Same reasoning as the floor:
       it has further to recede once the ground is light. */
    if (sphereT > 0) base = Math.min(base, 1 - (0.25 + 0.2 * dayT) * sphereT);
    const zt = zoneT * zoneT * (3 - 2 * zoneT);
    base = Math.min(base, 1 - (1 - ZONE_DIM) * zt);
    /* Presence envelope for the back half, applied LAST so it can force a
       true zero rather than merely dimming. The machine fades out across
       #process, stays gone through #network and the Calendly embed, and
       comes back only as the question marks - hence the max(): questionT is
       the one thing allowed to overrule the blackout. footerHideT then takes
       it out again so nothing bleeds into the footer. */
    const vis = Math.max(1 - hideT, questionT) * (1 - footerHideT);
    sceneCall('setDim', base * vis);
  }

  const ctx = gsap.context(() => {
    /* --------------------------------------------------------------
     * 1. Whole-page progress
     *    -> CSS var --scroll-progress (nav progress bar scaleX)
     *    -> scene.setProgress (camera drift + hue warm)
     * self.progress comes from cached measurements: no layout-forcing
     * reads on the scroll hot path. Never self.scroll().
     * -------------------------------------------------------------- */
    function applyPageProgress(self) {
      const p = self.progress;
      progressHost.style.setProperty('--scroll-progress', String(p));
      sceneCall('setProgress', p);
    }

    ScrollTrigger.create({
      trigger: document.body,
      start: 0,
      end: 'max',
      scrub: true,
      onUpdate: applyPageProgress,
      onRefresh: applyPageProgress
    });

    /* --------------------------------------------------------------
     * 2. Hero scrub-out: copy lifts and fades as the climb starts.
     * opacity, NOT autoAlpha: visibility:hidden would drop the hero
     * CTAs out of the keyboard tab order, and 0.15 keeps them present.
     * -------------------------------------------------------------- */
    const hero = document.querySelector('#hero');
    if (hero && heroInner) {
      gsap.to(heroInner, {
        y: () => -0.08 * window.innerHeight,
        opacity: 0.15,
        ease: 'none',
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true
        }
      });
    }

    /* --------------------------------------------------------------
     * 2b. Approach morph: ARROWS -> PLAY (formation 0 -> 1), scrubbed
     * over the video section's entry into the viewport. Starts exactly
     * as #vsl's top crosses the fold - never before, so a fresh load at
     * the top of the page always shows pure arrows (a start below the
     * fold, like the old 'top 120%', is already inside the trigger on
     * load and leaves the machine half-morphed at scroll 0). Fully
     * formed once the section is ~a third of the way in; the play glyph
     * then holds until #services starts entering, where the station
     * driver takes over (its first leg starts at exactly f = 1).
     * -------------------------------------------------------------- */
    const vsl = document.querySelector('#vsl');

    function applyPlayMorph(self) {
      const f = self.progress; /* 0 PEAK -> 1 PLAY */
      lastF = f;
      sceneCall('setFormation', f);
      applyLateral(f);
    }

    if (vsl) {
      ScrollTrigger.create({
        trigger: vsl,
        start: 'top bottom',
        end: 'top 70%',
        scrub: 0.6,
        onUpdate: applyPlayMorph,
        onRefresh: applyPlayMorph
      });
    }

    /* --------------------------------------------------------------
     * 3. Formation driver: one scrub across #services maps page
     *    position to the continuous formation index 1..5.
     *
     * Derivation of f = p * 4.67 + 1.166 (re-derive if heights change):
     * - 4 stations x 150vh = 600vh section height.
     * - Trigger spans 'top bottom' -> 'bottom top': 600 + 100 = 700vh.
     * - Station i's sticky stage (100svh) is pinned while the scroll sits
     *   in [100 + 150i, 150 + 150i]vh of that 700vh span, so its hold
     *   center is at p = (125 + 150i) / 700.
     * - Stations hold formations 2..5 (PLAY owns 1 above), so we want
     *   formation i+2 fully formed at each hold center. Solving
     *   f = a*p + b over consecutive centers:
     *     a = 700/150 = 4.67  (one formation per 150vh of scroll)
     *     b = 2 - a * 125/700 = 1.166
     * scrub 0.6 smooths the small seam against the PLAY hold above.
     *
     * The first leg is piecewise so the driver activates at EXACTLY the
     * held PLAY value (f = 1) instead of the linear map's 1.166 - that
     * offset used to make the machine visibly jump the moment #services
     * entered. PLAY starts melting into FRAME immediately as #services
     * enters the viewport (~125vh of travel, station pace), landing on
     * f = 2 at station 1's hold center where the linear map takes over -
     * both legs meet at exactly 2, so no seam.
     * -------------------------------------------------------------- */
    const CENTER1_P = 125 / 700; /* station 1 hold center */
    function applyFormation(self) {
      const p = self.progress;
      const f =
        p < CENTER1_P ? 1 + p / CENTER1_P : clamp(2, 5, p * 4.67 + 1.166);
      lastF = f;
      /* The endgame morph now finishes while #services is STILL active, and
         two scrubbed triggers give no reliable ordering once one of them has
         stopped updating - so this driver has to fold sphereT in itself
         rather than trust the sphere to overwrite it. Without this the globe
         snaps back to the curve for the last stretch before #work.
         sphereT > 0 only ever happens where f is already clamped to 5. */
      sceneCall('setFormation', sphereT > 0 ? endgameF() : f);
      applyLateral(f);
    }

    /* Below the stations: GROWTH is held, PLUS whatever the endgame morph
       has already done. Folding sphereT back in is load-bearing - that morph
       now finishes BEFORE #services scrolls out, so without it the finished
       sphere would snap back to the curve the moment the section leaves. */
    function holdEndgame() {
      lastF = 5;
      sceneCall('setFormation', endgameF());
      applyLateral(5);
    }

    if (services) {
      ScrollTrigger.create({
        trigger: services,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.6,
        onUpdate: applyFormation,
        onRefresh(self) {
          /* Re-measure first: a resize changes panel widths, and the
             refresh is the only place the new layout is settled. */
          if (lateralEnabled) measureParks();
          if (self.isActive) {
            applyFormation(self);
          } else if (self.progress <= 0) {
            /* Above the stations the PLAY morph scrub owns the
               formation; just re-park with the fresh measurements. */
            applyLateral(lastF);
          } else {
            holdEndgame();
          }
        },
        onToggle(self) {
          if (self.isActive) return;
          if (self.progress <= 0) {
            applyLateral(lastF);
          } else {
            holdEndgame();
          }
        }
      });
    }

    /* --------------------------------------------------------------
     * 4. Stations: ghost number parallax (scrub) + content reveal
     *    (toggle-based, reversible).
     * -------------------------------------------------------------- */
    stations.forEach((station) => {
      const ghost = station.querySelector('.ghost-num');

      /* Ghost number drifts +-6vh across the station's pass. */
      if (ghost) {
        gsap.fromTo(
          ghost,
          { y: () => 0.06 * window.innerHeight },
          {
            y: () => -0.06 * window.innerHeight,
            ease: 'none',
            scrollTrigger: {
              trigger: station,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
              invalidateOnRefresh: true
            }
          }
        );
      }

      /* Content reveal. The ghost number has its own parallax scrub, so
         keep it out of the reveal set - the two must never fight over y.
         opacity (not autoAlpha): visibility:hidden would drop the station
         links out of the keyboard tab order while hidden. */
      const inner = station.querySelector('.station-inner');
      if (inner && inner.children.length) {
        const revealChildren = Array.prototype.slice
          .call(inner.children)
          .filter(
            (child) =>
              child !== ghost && !child.classList.contains('ghost-num')
          );
        if (revealChildren.length) {
          gsap.from(revealChildren, {
            y: 32,
            opacity: 0,
            duration: 0.6,
            stagger: 0.06,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: station,
              start: 'top 65%',
              toggleActions: 'play none none reverse'
            }
          });
        }
      }
    });

    /* --------------------------------------------------------------
     * 5. Desktop set-pieces (>=900px): lateral parking and the scrubbed
     *    #vsl / #proof zones. Below 900px the lateral stays centered.
     *    gsap.matchMedia reverts everything created here on leave.
     * -------------------------------------------------------------- */
    const mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', () => {
      lateralEnabled = true;
      measureParks();
      applyLateral(lastF);

      /* #work is no longer pinned: cylinder.js owns that section's motion
         with its own rAF loop, so the section scrolls like any other. */

      /* ------------------------------------------------------------
       * Scrubbed #vsl gutter. zoneT ramps in as the video enters
       * (p 0.10 -> 0.35 of its bottom-to-top pass) and back out as it
       * leaves (p 0.70 -> 1.0), overlapping the PLAY -> FRAME morph,
       * so the machine glides left-to-right across the handoff in
       * lockstep with the scroll instead of lurching on a toggle.
       * Only >=900px: below that the canvas is already calmed by CSS.
       * ------------------------------------------------------------ */
      if (vsl) {
        const applyZone = (self) => {
          const p = self.progress;
          zoneT = Math.min(
            clamp(0, 1, (p - 0.1) / 0.25),
            clamp(0, 1, (1 - p) / 0.3)
          );
          applyLateral(lastF);
          applyDim();
        };
        ScrollTrigger.create({
          trigger: vsl,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
          onUpdate: applyZone,
          onRefresh: applyZone
        });
      }

      /* #proof is special: instead of dodging to a gutter, the machine
         becomes a thin particle ring that lassos the stats strip
         (measured, so the ellipse hugs the real block at any viewport).
         Fully scrub-driven: the wrap forms over the first half of the
         pass and releases over the second, at the same unhurried pace
         as the station morphs, and rewinds identically. */
      const proofEl = document.querySelector('#proof');
      if (proofEl) {
        const ringShape = { rx: 0.85, ry: 0.35 };
        /* Cached in refresh so the scrubbed tracker never reads layout
           on the scroll hot path. */
        let ringSpan = 1;
        let ringHalfVh = 1;
        const measureRingShape = () => {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          const r = proofEl.getBoundingClientRect();
          ringShape.rx = clamp(0.3, 0.97, (r.width * 0.5 + 24) / (vw / 2));
          ringShape.ry = clamp(0.18, 0.6, (r.height * 0.5 - 24) / (vh / 2));
          ringSpan = vh + r.height;
          ringHalfVh = vh / 2;
        };
        const applyRing = (self) => {
          const p = self.progress;
          /* Wrap 0.28 -> 0.5 (stats centered), hold, release
             0.58 -> 0.88. The wrap starts this late deliberately: the
             stats strip already sits ~20% into its pass on a fresh load
             at scroll 0, so any earlier threshold leaves the ring
             partially formed at the top of the page - smearing the hero
             arrows into a shapeless cloud before any scrolling. */
          const rt = Math.min(
            clamp(0, 1, (p - 0.28) / 0.22),
            clamp(0, 1, (0.88 - p) / 0.3)
          );
          sceneCall('setRing', rt, ringShape.rx, ringShape.ry);
          /* Keep the ellipse glued to the stats block as it moves
             through the viewport (progress 0.5 = block centered). */
          sceneCall('setRingCenter', ((0.5 - p) * ringSpan) / ringHalfVh);
        };
        measureRingShape();
        ScrollTrigger.create({
          trigger: proofEl,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
          onUpdate: applyRing,
          onRefresh(self) {
            measureRingShape();
            applyRing(self);
          }
        });
      }

      return () => {
        lateralEnabled = false;
        zoneT = 0;
        sceneCall('setRing', 0);
        sceneCall('setLateral', 0, 0);
        applyDim();
      };
    });

    /* --------------------------------------------------------------
     * 5b. Endgame: GROWTH -> SPHERE (formation 5 -> 6).
     *
     * The morph is timed to be COMPLETE by the time #work is on screen, so
     * the card cylinder always turns in front of a finished globe rather
     * than a curve still gathering itself.
     *
     * Window (re-derive alongside the formation driver above if station
     * heights change). With S = the scroll where #services' top meets the
     * viewport top, that driver clamps to formation 5 at p = 0.821 of its
     * 700vh span, i.e. S + 475vh - which is 125vh before #work's top
     * reaches the viewport top at S + 600vh. So GROWTH finishes forming
     * partway through station 04 and then just sits there. That dead 125vh
     * is exactly what the morph now uses:
     *   start 'top bottom+=25%' -> #work's top 125vh below the fold = S+475
     *   end   'top 25%'         -> #work's top 25vh from the top  = S+575
     * Beginning right where GROWTH completes means there is no formation
     * jump at the handoff, and 100vh of station-pace scroll to run in.
     *
     * All sizes, not just desktop: below 900px the machine is centered
     * anyway. Updates run in start-position order, so this outranks the
     * station driver throughout their overlap.
     * -------------------------------------------------------------- */
    const work = document.querySelector('#work');

    function applySphere(self) {
      sphereT = self.progress;
      if (sphereT > 0) sceneCall('setFormation', endgameF());
      /* Not a hard re-center: applyLateral eases the park out by sphereT. */
      applyLateral(lastF);
      applyDim();
    }

    if (work) {
      ScrollTrigger.create({
        trigger: work,
        start: 'top bottom+=25%',
        end: 'top 25%',
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: applySphere,
        onRefresh: applySphere
      });
    }

    /* --------------------------------------------------------------
     * 5c. Daylight: the page crosses from the dark half into the light
     * one over the station-04 -> #work handoff.
     *
     * Window 'top bottom' -> 'top top' on #work is exactly the 100vh in
     * which station 04's panel rides up and off the top while the conveyor
     * rises to meet it. Station 04 finishes its sticky hold at S+500vh,
     * the same scroll this trigger starts at (re-derive against the
     * endgame block above if station heights change), so nothing that is
     * still being read gets recoloured mid-sentence.
     *
     * ONE number drives both sides: every token in .theme-day is a
     * color-mix against --day, and setDay crossfades the particles to the
     * matching ramp. That lockstep is load-bearing rather than tidy -
     * #work's H2 enters the viewport within a few px of this trigger's
     * start, so a class toggle at either end of the window would strand
     * dark ink on a dark ground (or bone on bone) for most of the pass.
     * Scrubbing the tokens keeps contrast intact the whole way across.
     *
     * Smoothstepped so both ends settle instead of arriving linearly, and
     * scrubbed, so scrolling back rewinds it like everything else.
     * -------------------------------------------------------------- */
    const dayHost = document.body;
    let lastDay = -1;

    function applyDay(self) {
      const p = self.progress;
      const d = p * p * (3 - 2 * p);
      /* Quantised: an inherited custom property change invalidates style
         for the subtree that reads it, so skip the frames where the value
         has not actually moved a visible amount. */
      const q = Math.round(d * 500) / 500;
      if (q === lastDay) return;
      lastDay = q;
      dayT = q;
      dayHost.style.setProperty('--day', String(q));
      sceneCall('setDay', q);
      /* The reading-dim floor is a function of dayT, so it has to be
         recomputed as the ground crosses over, not just on section toggle. */
      applyDim();
    }

    if (work) {
      ScrollTrigger.create({
        trigger: work,
        start: 'top bottom',
        end: 'top top',
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: applyDay,
        onRefresh: applyDay
      });
    }

    /* --------------------------------------------------------------
     * 5d. Into the calendar, out as question marks.
     *
     * Two scrubbed values, both rewinding like everything else:
     *
     *   hideT     blackout while #book holds the viewport. The Calendly
     *             iframe is the one piece of UI on this page whose inside we
     *             do not control, so the machine leaves entirely rather than
     *             sitting behind it at reading dim.
     *
     *   questionT SPHERE(6) -> QUESTIONS(7) as #faq climbs in, paired with
     *             setCondense. At 0 the machine is imploded to a dot at dead
     *             center - which is exactly where the embed was - so
     *             releasing it while the glyphs form reads as the particles
     *             pouring out of the calendar and settling either side of
     *             the accordions.
     *
     * The two windows overlap deliberately: the blackout is releasing while
     * the marks are forming, so the emergence is the part you actually see.
     * -------------------------------------------------------------- */
    const processEl = document.querySelector('#process');
    const faqEl = document.querySelector('#faq');
    const footerEl = document.querySelector('.site-footer');

    /* Imploded only while the blackout is on AND the marks have not formed.
       hideT alone would crush the machine above #process; questionT alone
       would crush it for the whole page above #faq. */
    function applyCondense() {
      sceneCall('setCondense', hideT * (1 - questionT));
    }

    /* The machine leaves the page well before the Calendly embed, not at it.
       The fade runs across the whole of #process: it starts the moment that
       section clears the fold and is complete by the time its bottom gets
       there, which is exactly when #network is about to enter. So the orbit
       visual and the embed each get the page to themselves, and the question
       marks are the machine's re-entrance rather than a change of shape. */
    function applyHide(self) {
      const p = self.progress;
      hideT = p * p * (3 - 2 * p); /* smoothstep: settle at both ends */
      applyCondense();
      applyDim();
    }

    if (processEl) {
      ScrollTrigger.create({
        trigger: processEl,
        start: 'top bottom',
        end: 'bottom bottom',
        scrub: 0.5,
        invalidateOnRefresh: true,
        onUpdate: applyHide,
        onRefresh: applyHide
      });
    }

    /* The canvas is fixed, so the marks sit at the viewport centre and do not
       scroll away with #faq - without this they ride straight down over the
       footer. The glyphs span roughly 29% to 65% of the viewport height (top
       of hook to bottom of dot, see buildQuestions), so the fade has to be
       finished by the time the footer's top passes 68%. */
    function applyFooterHide(self) {
      const p = self.progress;
      footerHideT = p * p * (3 - 2 * p);
      applyDim();
    }

    if (footerEl) {
      ScrollTrigger.create({
        trigger: footerEl,
        start: 'top bottom',
        end: 'top 68%',
        scrub: 0.5,
        invalidateOnRefresh: true,
        onUpdate: applyFooterHide,
        onRefresh: applyFooterHide
      });
    }

    function applyQuestions(self) {
      const p = self.progress;
      questionT = p * p * (3 - 2 * p); /* smoothstep */
      applyCondense();
      applyDim();
      /* Above the endgame this trigger owns nothing, and has to say so.
         onRefresh fires on EVERY trigger regardless of where the scroll
         actually is - page load, resize, font swap - and this one is created
         last, so whatever it writes here is the last word. Writing
         endgameF() unconditionally meant a fresh load at scroll 0 ended with
         the machine stamped to formation 5 and parked at station 04's
         panel: the hero's arrows replaced by the GROWTH curve smeared
         across the headline. It only ever corrected itself on the next
         scroll, because the drivers that own the top of the page fire on
         update, not on refresh. Guard on the endgame values themselves
         (applySphere already does the same) so refreshes above #work leave
         the formation to whoever legitimately owns it. */
      if (questionT <= 0 && sphereT <= 0) return;
      sceneCall('setFormation', endgameF());
      applyLateral(5);
    }

    if (faqEl) {
      ScrollTrigger.create({
        trigger: faqEl,
        start: 'top bottom',
        end: 'top 40%',
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: applyQuestions,
        onRefresh: applyQuestions
      });
    }

    /* --------------------------------------------------------------
     * 6. Reading dim for #book and #faq.
     * -------------------------------------------------------------- */
    /* #process joins #book and #faq: it is the one section in the daylight
       half whose copy sits straight on the ground with no card or panel
       between it and the machine, and the endgame sphere is at its densest
       exactly there. #network is the same case: a typewriter headline and a
       ring of avatars, both straight on the ground. */
    ['#book'].forEach((sel, i) => {
      const section = document.querySelector(sel);
      if (!section) return;
      ScrollTrigger.create({
        trigger: section,
        start: 'top 75%',
        end: 'bottom 25%',
        onToggle(self) {
          dimState[i] = self.isActive;
          applyDim();
        },
        onRefresh(self) {
          dimState[i] = self.isActive;
          applyDim();
        }
      });
    });

    /* --------------------------------------------------------------
     * 7. Footer marquee: the giant outlined PEAKLEADS drifts slowly left
     *    as the footer scrolls through. Scrubbed, so it rewinds too.
     * -------------------------------------------------------------- */
    const footer = document.querySelector('.site-footer');
    const marquee = footer ? footer.querySelector('.footer-marquee') : null;
    /* Translate the spans INSIDE the clip box, never the overflow-hidden
       box itself: moving the box widens the document (mobile x-overflow). */
    if (footer && marquee && marquee.children.length) {
      gsap.fromTo(
        marquee.children,
        { x: () => 0.05 * window.innerWidth },
        {
          x: () => -0.12 * window.innerWidth,
          ease: 'none',
          scrollTrigger: {
            trigger: footer,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
            invalidateOnRefresh: true
          }
        }
      );
    }
  });

  /* ==================================================================
   * Stat count-ups (#proof). Independent of ScrollTrigger: plain
   * IntersectionObserver (0.4, once) + rAF with ease-out cubic.
   * Parses the target from data-target OR the text itself, animates the
   * numeric part only and keeps prefix/suffix ("$7M+" -> "$", 7, "M+").
   * Mutates a text node only. Reduced motion jumps straight to final.
   * ================================================================== */
  const counters = initStatCounters();

  function initStatCounters() {
    const stats = Array.prototype.slice.call(
      document.querySelectorAll('.stat')
    );
    if (!stats.length) return { stop() {} };

    const NUM_RE = /(\d+(?:\.\d+)?)/;
    const DURATION = 1200;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const jobs = [];
    stats.forEach((stat) => {
      const valueEl = stat.querySelector('.stat-value') || stat;
      const targetStr = (
        stat.getAttribute('data-target') ||
        valueEl.getAttribute('data-target') ||
        valueEl.textContent ||
        ''
      ).trim();
      const match = NUM_RE.exec(targetStr);
      if (!match) return;
      jobs.push({
        el: valueEl,
        target: parseFloat(match[1]),
        decimals: (match[1].split('.')[1] || '').length,
        prefix: targetStr.slice(0, match.index),
        suffix: targetStr.slice(match.index + match[1].length),
        raf: 0,
        done: false
      });
    });
    if (!jobs.length) return { stop() {} };

    function write(job, value) {
      const text = job.prefix + value.toFixed(job.decimals) + job.suffix;
      const node = job.el.firstChild;
      if (node && node.nodeType === 3 && !node.nextSibling) {
        node.nodeValue = text;
      } else {
        job.el.textContent = text;
      }
    }

    function finish(job) {
      if (job.raf) window.cancelAnimationFrame(job.raf);
      job.raf = 0;
      job.done = true;
      write(job, job.target);
    }

    function run(job) {
      if (job.done) return;
      if (reduced || typeof window.requestAnimationFrame !== 'function') {
        finish(job);
        return;
      }
      let startTime = null;
      function frame(now) {
        if (startTime === null) startTime = now;
        const t = Math.min(1, (now - startTime) / DURATION);
        const eased = 1 - Math.pow(1 - t, 3); /* ease-out cubic */
        if (t < 1) {
          write(job, job.target * eased);
          job.raf = window.requestAnimationFrame(frame);
        } else {
          finish(job);
        }
      }
      job.raf = window.requestAnimationFrame(frame);
    }

    let observer = null;
    if ('IntersectionObserver' in window && !reduced) {
      observer = new window.IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target); /* once */
            for (let i = 0; i < jobs.length; i++) {
              if (jobs[i].el === entry.target || entry.target.contains(jobs[i].el)) {
                run(jobs[i]);
              }
            }
          });
        },
        { threshold: 0.4 }
      );
      jobs.forEach((job) => observer.observe(job.el));
    } else {
      jobs.forEach(finish);
    }

    return {
      stop() {
        if (observer) observer.disconnect();
        /* Never leave a stat frozen mid-count on teardown. */
        jobs.forEach(finish);
      }
    };
  }

  /* Settle every start/end/pin measurement now that all triggers exist. */
  ScrollTrigger.refresh();

  /* ==================================================================
   * Cleanup: kills every trigger and tween created above, reverts the
   * matchMedia set-pieces and all inline from-states, and hands the
   * scene back in its neutral state. main.js calls this on teardown
   * (reduced-motion mid-session, choreography failure).
   * ================================================================== */
  function cleanup() {
    if (activeCleanup === cleanup) activeCleanup = null;
    counters.stop();
    try {
      ctx.revert(); /* also reverts the matchMedia contexts inside */
    } catch (err) {
      /* decorative only */
    }
    progressHost.style.setProperty('--scroll-progress', '0');
    /* Drop the inline --day rather than zeroing it: removing it lets the
       stylesheet's own fallback win, which is what paints the daylight half
       once nothing is scrubbing it (teardown means no-3d or reduced motion,
       where .theme-day carries its own ground). Leaving a mid value here
       would freeze body::after as a half-lit wash over the whole page. */
    document.body.style.removeProperty('--day');
    dayT = 0;
    questionT = 0;
    hideT = 0;
    footerHideT = 0;
    sceneCall('setDim', 1);
    sceneCall('setLateral', 0, 0);
    sceneCall('setRing', 0);
    sceneCall('setDay', 0);
    sceneCall('setCondense', 0);
  }

  activeCleanup = cleanup;
  return cleanup;
}
