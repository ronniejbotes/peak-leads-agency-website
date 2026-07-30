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
   every start/end off by the current offset and the pinned conveyor
   collapses. Forcing scroll-behavior:auto around the measurement fixes it
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
    measurePark(heroCopy, 0);
    for (let i = 0; i < stations.length && i < 4; i++) {
      measurePark(stations[i].querySelector('.station-inner'), i + 1);
    }
  }

  /* Hold at one side while a station is centered, cross over during the
     handoff: the middle half of each formation-to-formation span does the
     travelling, so the particles are parked and still while you read. */
  function applyLateral(f) {
    /* The endgame sphere never dodges: pinned dead center. */
    if (sphereT > 0) {
      sceneCall('setLateral', 0, 0);
      return;
    }
    /* A content-avoidance zone owns the machine while active. */
    if (zoneStack.length) return;
    if (!lateralEnabled) {
      sceneCall('setLateral', 0, 0);
      return;
    }
    /* parks are indexed hero 0, stations 1..4. Stations hold formations
       2..5 (PEAK 0 and PLAY 1 both live above them), so formation space
       maps to park space shifted down by 1. */
    const pf = clamp(0, 4, f - 1);
    const i = Math.min(Math.floor(pf), 3);
    let t = clamp(0, 1, (pf - i - 0.25) / 0.5);
    t = t * t * (3 - 2 * t); /* smoothstep */
    const off = parkOffset[i] + (parkOffset[i + 1] - parkOffset[i]) * t;
    const strip = parkStrip[i] + (parkStrip[i + 1] - parkStrip[i]) * t;
    sceneCall('setLateral', off, strip);
  }

  /* ==================================================================
   * Reading dim: while #book or #faq occupies the viewport the particles
   * recede to 0.4 so the Calendly embed and accordions stay readable.
   * Two flags rather than toggling per section, so overlapping ranges
   * cannot blank each other on the way out.
   * ================================================================== */
  const dimState = [false, false];

  /* Content-avoidance zones (desktop): while a content section occupies
     the viewport the machine swims to a gutter beside it, scaled down to
     the strip and slightly dimmed, so copy is never obstructed. From
     #work onward the machine is the endgame sphere and never dodges
     again, so only the sections above it keep zones. Stack (not a flag)
     so overlapping ranges hand off cleanly. */
  const zoneStack = [];
  /* 0..1 progress of the GROWTH -> SPHERE endgame morph. While > 0 the
     sphere owns the machine: dead center, no parking, no zones. */
  let sphereT = 0;
  function zoneTop() {
    return zoneStack.length ? zoneStack[zoneStack.length - 1] : null;
  }
  function applyZones() {
    const z = zoneTop();
    if (z) {
      /* offset/strip as viewport fractions; the scene clamps and fits */
      sceneCall('setLateral', z.side * 0.86, z.strip);
    } else if (lateralEnabled) {
      applyLateral(lastF);
    } else {
      sceneCall('setLateral', 0, 0);
    }
    applyDim();
  }

  function applyDim() {
    let base = dimState[0] || dimState[1] ? 0.4 : 1;
    /* The endgame sphere recedes a touch so it reads as a background
       behind content, never a wash over it. */
    if (sphereT > 0) base = Math.min(base, 1 - 0.25 * sphereT);
    const z = zoneTop();
    sceneCall('setDim', Math.min(base, z ? z.dim : 1));
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
     * 2b. Approach morph: PEAK -> PLAY (formation 0 -> 1) scrubbed over
     * the run-up to the video section, at station pace, so the first
     * change forms with the scroll instead of snapping. It starts while
     * the proof ring is wrapping the stats (the melt hides under the
     * ring) and completes with the video in the upper third.
     * ScrollTrigger updates run in start-position order, so the station
     * driver below outranks this one wherever they could both write.
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
        start: 'top 120%',
        end: 'top 30%',
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
     * -------------------------------------------------------------- */
    function applyFormation(self) {
      const f = clamp(1, 5, self.progress * 4.67 + 1.166);
      lastF = f;
      sceneCall('setFormation', f);
      applyLateral(f);
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
            /* Below the stations: hold GROWTH centered until the
               endgame sphere scrub takes over. */
            lastF = 5;
            sceneCall('setFormation', 5);
            sceneCall('setLateral', 0, 0);
          }
        },
        onToggle(self) {
          if (self.isActive) return;
          if (self.progress <= 0) {
            applyLateral(lastF);
          } else {
            lastF = 5;
            sceneCall('setFormation', 5);
            sceneCall('setLateral', 0, 0);
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
     * 5. Desktop set-pieces (>=900px): lateral parking + the pinned
     *    #work conveyor. Below 900px the lateral stays centered and the
     *    conveyor keeps its untouched scroll-snap strip fallback.
     *    gsap.matchMedia reverts everything created here on leave.
     * -------------------------------------------------------------- */
    const mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', () => {
      lateralEnabled = true;
      measureParks();
      applyLateral(lastF);

      const work = document.querySelector('#work');
      const conveyor = work ? work.querySelector('.conveyor') : null;
      const track = conveyor
        ? conveyor.querySelector('.conveyor-track')
        : null;

      if (work && conveyor && track) {
        /* Function-based so a resize (via invalidateOnRefresh) remeasures
           both the travel distance and the pin duration. */
        const distance = () =>
          Math.max(0, track.scrollWidth - conveyor.clientWidth);
        gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: work,
            pin: true,
            anticipatePin: 1,
            scrub: 1,
            start: 'top top',
            end: () => '+=' + distance(),
            invalidateOnRefresh: true
          }
        });
      }

      /* ------------------------------------------------------------
       * Content-avoidance zones. Only the sections above the endgame
       * sphere keep one: from #work onward the machine is a centered
       * background and never dodges. Only >=900px: below that the
       * canvas is already calmed by CSS (opacity + halos).
       * ------------------------------------------------------------ */
      const ZONES = [['#vsl', -1, 0.7, 0.24]];
      function zoneSet(zone, active) {
        const idx = zoneStack.indexOf(zone);
        if (active && idx === -1) zoneStack.push(zone);
        if (!active && idx !== -1) zoneStack.splice(idx, 1);
        applyZones();
      }
      ZONES.forEach(([sel, side, dim, strip]) => {
        const el = document.querySelector(sel);
        if (!el) return;
        const zone = { side, dim, strip };
        ScrollTrigger.create({
          trigger: el,
          start: 'top 60%',
          end: 'bottom 40%',
          onToggle(self) {
            zoneSet(zone, self.isActive);
          },
          onRefresh(self) {
            zoneSet(zone, self.isActive);
          }
        });
      });

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
          /* Wrap 0.12 -> 0.42, hold, release 0.58 -> 0.88. */
          const rt = Math.min(
            clamp(0, 1, (p - 0.12) / 0.3),
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
        zoneStack.length = 0;
        sceneCall('setRing', 0);
        sceneCall('setLateral', 0, 0);
        applyDim();
      };
    });

    /* --------------------------------------------------------------
     * 5b. Endgame: GROWTH -> SPHERE (formation 5 -> 6). Starts the
     * moment #work's heading crosses 70% of the viewport and runs over
     * 150vh of scroll - station pace - so the growth curve slowly
     * gathers itself into the tumbling globe while the conveyor pins.
     * From there the sphere holds dead center behind everything to the
     * end of the page. All sizes, not just desktop: below 900px the
     * machine is centered anyway. Updates run in start-position order,
     * so this outranks the station driver in their overlap.
     * -------------------------------------------------------------- */
    const work = document.querySelector('#work');

    function applySphere(self) {
      sphereT = self.progress;
      if (sphereT > 0) {
        sceneCall('setFormation', 5 + sphereT);
        sceneCall('setLateral', 0, 0);
      }
      applyDim();
    }

    if (work) {
      ScrollTrigger.create({
        trigger: work,
        start: 'top 70%',
        end: () => '+=' + window.innerHeight * 1.5,
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: applySphere,
        onRefresh: applySphere
      });
    }

    /* --------------------------------------------------------------
     * 6. Reading dim for #book and #faq.
     * Created AFTER the conveyor pin in page order, so their start/end
     * are measured with the pin's spacer in place.
     * -------------------------------------------------------------- */
    ['#book', '#faq'].forEach((sel, i) => {
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
    sceneCall('setDim', 1);
    sceneCall('setLateral', 0, 0);
    sceneCall('setRing', 0);
  }

  activeCleanup = cleanup;
  return cleanup;
}
