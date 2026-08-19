/*
 * Peak Leads - src/js/main.js
 * Landing page entry: always-on utilities + the 3D boot gate.
 *
 * Contract (DESIGN.md section 7):
 * - Dynamic-imports scene.js + scroll.js AFTER first paint
 *   (requestIdleCallback, setTimeout 1 fallback), so hero text is LCP.
 * - All-or-nothing gate: prefers-reduced-motion, missing canvas, a failed
 *   import, scene.init returning false or ANY throw -> body.no-3d and no
 *   choreography. A choreography failure after the scene started also
 *   tears everything down to no-3d. The page stays fully readable.
 * - Always-on utilities run with or without 3D: nav burger, footer year,
 *   Calendly lazy-load, "Say hi" bubble gating, Facebook Pixel.
 * - #work's card cylinder is gated on prefers-reduced-motion ONLY, not on
 *   the WebGL boot: it is plain CSS 3D, so a machine that fails scene.init
 *   still gets it. Under reduced motion the scroll-snap strip stays.
 * - `js-enabled` is added by the tiny inline script in <head>, not here.
 * - No THREE and no GSAP imports in this file.
 */
import '../styles/main.css';
import { armPixel } from './pixel.js';
import { initNetwork } from './network.js';

const docEl = document.documentElement;
const body = document.body || docEl;

const motionQuery =
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

function prefersReducedMotion() {
  return !!(motionQuery && motionQuery.matches);
}

function onMedia(query, handler) {
  if (!query) return;
  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handler);
  } else if (typeof query.addListener === 'function') {
    query.addListener(handler);
  }
}

/* ====================================================================
 * 3D boot gate
 * ================================================================== */
let sceneRef = null;
let scrollCleanup = null;
let sceneActive = false;
let booting = false;
let pointerBound = false;
let resizeBound = false;

/* Viewport dims are cached: reading innerWidth/innerHeight per pointer
   event forces style/layout flushes in several engines. */
let viewportW = window.innerWidth || 1;
let viewportH = window.innerHeight || 1;

function sceneCall(method, a, b) {
  if (sceneRef && typeof sceneRef[method] === 'function') {
    try {
      sceneRef[method](a, b);
    } catch (err) {
      /* decorative only */
    }
  }
}

function bindPointer() {
  if (pointerBound) return;
  pointerBound = true;
  window.addEventListener(
    'pointermove',
    (event) => {
      if (!sceneActive) return;
      sceneCall(
        'setPointer',
        (event.clientX / viewportW) * 2 - 1,
        (event.clientY / viewportH) * 2 - 1
      );
    },
    { passive: true }
  );
}

function bindResize() {
  if (resizeBound) return;
  resizeBound = true;
  let timer = null;
  window.addEventListener('resize', () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      viewportW = window.innerWidth || 1;
      viewportH = window.innerHeight || 1;
      if (sceneActive) sceneCall('resize');
      /* ScrollTrigger refreshes itself on resize; nothing to do here. */
    }, 200);
  });
}

function applyNo3D() {
  body.classList.add('no-3d');
  sayHiEvaluate();
}

function teardown3D() {
  if (scrollCleanup) {
    try {
      scrollCleanup();
    } catch (err) {
      /* decorative only */
    }
    scrollCleanup = null;
  }
  if (sceneRef) {
    sceneCall('destroy');
    sceneRef = null;
  }
  sceneActive = false;
  docEl.style.setProperty('--scroll-progress', '0');
  applyNo3D();
}

function boot3D() {
  if (sceneActive || booting) return;
  if (prefersReducedMotion()) {
    applyNo3D();
    return;
  }
  const canvas = document.getElementById('scene-canvas');
  if (!canvas) {
    applyNo3D();
    return;
  }
  booting = true;
  Promise.all([import('./scene.js'), import('./scroll.js')])
    .then(([sceneMod, scrollMod]) => {
      booting = false;
      /* Preference may have flipped while the chunks loaded. */
      if (prefersReducedMotion()) {
        applyNo3D();
        return;
      }
      const scene = sceneMod.PeakScene;
      let ok = false;
      try {
        ok = !!scene && scene.init(canvas, {}) !== false;
      } catch (err) {
        ok = false;
      }
      if (!ok) {
        applyNo3D();
        return;
      }
      sceneRef = scene;
      sceneActive = true;
      body.classList.remove('no-3d');
      try {
        scrollCleanup = scrollMod.initScrollChoreography(scene);
      } catch (err) {
        /* Scene without working choreography strands content: all or
           nothing, back to the static experience. */
        teardown3D();
        return;
      }
      bindPointer();
      bindResize();
      sayHiEvaluate();
    })
    .catch(() => {
      booting = false;
      applyNo3D();
    });
}

function scheduleBoot() {
  const idle = (cb) => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(cb);
    } else {
      window.setTimeout(cb, 1);
    }
  };
  /* Double rAF lets the first paint land before any chunk work starts. */
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() =>
      idle(() => {
        boot3D();
        bootCylinder();
      })
    );
  });
}

/* ====================================================================
 * #work card cylinder. Its own gate, its own rAF loop; see cylinder.js.
 * Loaded lazily so it never competes with the hero paint.
 * ================================================================== */
let cylinderCleanup = null;
let cylinderLoading = false;

function bootCylinder() {
  if (cylinderCleanup || cylinderLoading || prefersReducedMotion()) return;
  if (!document.querySelector('.conveyor[data-cylinder]')) return;
  cylinderLoading = true;
  import('./cylinder.js')
    .then((mod) => {
      cylinderLoading = false;
      if (prefersReducedMotion()) return;
      try {
        cylinderCleanup = mod.initWorkCylinder();
      } catch (err) {
        /* Decorative: the scroll-snap strip is still underneath. */
        cylinderCleanup = null;
      }
    })
    .catch(() => {
      cylinderLoading = false;
    });
}

function teardownCylinder() {
  if (!cylinderCleanup) return;
  try {
    cylinderCleanup();
  } catch (err) {
    /* decorative only */
  }
  cylinderCleanup = null;
}

onMedia(motionQuery, () => {
  if (prefersReducedMotion()) {
    teardown3D();
    teardownCylinder();
  } else {
    boot3D();
    bootCylinder();
  }
});

/* Landing on a /#hash from another page: the browser performs its anchor
   jump before fonts, lazy images and ScrollTrigger's load refresh have
   settled the layout, so the target drifts from where the browser left us.
   Re-aim once those have run. */
window.addEventListener('load', () => {
  if (!location.hash || location.hash.length < 2) return;
  let target = null;
  try {
    target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
  } catch (err) {
    target = null;
  }
  if (!target) return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
    });
  });
});

/* bfcache restore hands back a frozen WebGL context and stale trigger
   measurements; re-measuring mid-scroll is not reliable. A fresh load
   rebuilds cleanly and scrollRestoration puts the visitor back where they
   were. Only needed when 3D actually ran. */
window.addEventListener('pageshow', (event) => {
  if (event.persisted && sceneActive) window.location.reload();
});

/* ====================================================================
 * Nav burger (<900px dropdown). State lives on aria-expanded plus a
 * data-open attribute on .site-nav for CSS to target.
 * ================================================================== */
function initNav() {
  const nav = document.querySelector('.site-nav');
  const burger = document.querySelector('.nav-burger');
  const links = document.querySelector('.nav-links');
  if (!nav || !burger || !links) return;

  function isOpen() {
    return burger.getAttribute('aria-expanded') === 'true';
  }

  function setOpen(open) {
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      nav.setAttribute('data-open', '');
    } else {
      nav.removeAttribute('data-open');
    }
  }

  setOpen(isOpen());

  burger.addEventListener('click', () => setOpen(!isOpen()));

  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Escape' || event.key === 'Esc') && isOpen()) {
      setOpen(false);
      burger.focus();
    }
  });

  /* Close when a menu link is chosen (anchor navigation on one page). */
  links.addEventListener('click', (event) => {
    const target = event.target;
    const link =
      target && typeof target.closest === 'function' ? target.closest('a') : null;
    if (link && isOpen()) setOpen(false);
  });
}

/* ====================================================================
 * Footer year
 * ================================================================== */
function initYear() {
  const year = String(new Date().getFullYear());
  const el = document.querySelector('[data-year], #year');
  if (el) {
    el.textContent = year;
    return;
  }
  /* Fallback: rewrite the year inside the footer's copyright text node. */
  const footer = document.querySelector('.site-footer');
  if (!footer || typeof document.createTreeWalker !== 'function' || !window.NodeFilter) {
    return;
  }
  const walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    if (/\b20\d{2}\b/.test(node.nodeValue || '')) {
      node.nodeValue = node.nodeValue.replace(/\b20\d{2}\b/, year);
      return;
    }
  }
}

/* ====================================================================
 * Calendly lazy-load. The inline embed div in #book carries data-url;
 * Calendly's widget.js initializes it once injected. Injection happens
 * when #book is within 800px of the viewport (or on load without IO).
 * ================================================================== */
let calendlyInjected = false;

function injectCalendly() {
  if (calendlyInjected) return;
  calendlyInjected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://assets.calendly.com/assets/external/widget.css';
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.src = 'https://assets.calendly.com/assets/external/widget.js';
  script.async = true;
  document.head.appendChild(script);
}

function initCalendly() {
  const book = document.getElementById('book');
  if (!book) return;

  /* Booked-call conversion: Calendly posts a message when an event is
     scheduled inside the embed. */
  window.addEventListener('message', (event) => {
    if (!event || !event.data || event.data.event !== 'calendly.event_scheduled') return;
    if (
      typeof event.origin === 'string' &&
      event.origin.indexOf('calendly.com') === -1
    ) {
      return;
    }
    if (typeof window.fbq === 'function') {
      window.fbq('trackCustom', 'CallScheduled');
    }
  });

  if (!('IntersectionObserver' in window)) {
    if (document.readyState === 'complete') {
      injectCalendly();
    } else {
      window.addEventListener('load', injectCalendly, { once: true });
    }
    return;
  }

  const observer = new window.IntersectionObserver(
    (entries) => {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          observer.disconnect();
          injectCalendly();
          break;
        }
      }
    },
    { rootMargin: '800px 0px' }
  );
  observer.observe(book);
}

/* ====================================================================
 * "Say hi" bubble. Shown only when the 3D experience is running
 * (body not .no-3d), on precise pointers at >=900px. Hidden while #book
 * is on screen so it never covers the Calendly embed.
 * ================================================================== */
const mqPointerFine =
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: fine)')
    : null;
const mqWide =
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(min-width: 900px)')
    : null;

const sayHi = { el: null, video: null, nearBook: false };

function sayHiUpdate() {
  if (!sayHi.el) return;
  const eligible =
    sceneActive &&
    !body.classList.contains('no-3d') &&
    !!(mqPointerFine && mqPointerFine.matches) &&
    !!(mqWide && mqWide.matches);
  const show = eligible && !sayHi.nearBook;
  sayHi.el.hidden = !show;
  if (sayHi.video) {
    if (show) {
      sayHi.video.muted = true;
      const played = sayHi.video.play();
      if (played && typeof played.catch === 'function') {
        played.catch(() => {});
      }
    } else if (!sayHi.video.paused) {
      sayHi.video.pause();
    }
  }
}

function sayHiEvaluate() {
  sayHiUpdate();
}

function initSayHi() {
  sayHi.el = document.querySelector('.say-hi');
  if (!sayHi.el) return;
  sayHi.video = sayHi.el.querySelector('video');

  const book = document.getElementById('book');
  if (book && 'IntersectionObserver' in window) {
    new window.IntersectionObserver(
      (entries) => {
        for (let i = 0; i < entries.length; i++) {
          sayHi.nearBook = entries[i].isIntersecting;
        }
        sayHiUpdate();
      },
      { threshold: 0 }
    ).observe(book);
  }

  onMedia(mqPointerFine, sayHiUpdate);
  onMedia(mqWide, sayHiUpdate);
  sayHiUpdate();
}

/* ====================================================================
 * Nav over the daylight hero.
 *
 * The nav pill resolves its tokens against --day like every section does.
 * Below #work it inherits body's scrubbed value and lights up with the
 * ground, but the hero pins --day locally in CSS (it opens in daylight
 * while the sections beneath it are still night), and an inline custom
 * property on a section cannot reach a fixed sibling. So the one case CSS
 * cannot resolve on its own gets a class: .nav-light while the hero is on
 * screen, off the moment it leaves.
 *
 * Always-on, like the rest of initNav: it is a contrast fix, not decoration,
 * and it has to hold under body.no-3d and reduced motion too.
 * ================================================================== */
function initNavTheme() {
  const nav = document.querySelector('.site-nav');
  const hero = document.getElementById('hero');
  if (!nav || !hero) return;

  /* No IntersectionObserver: assume the hero is there on first paint, which
     is true at scroll 0 and is the state that matters for a fresh load. */
  if (!('IntersectionObserver' in window)) {
    nav.classList.add('nav-light');
    return;
  }

  /* Watch the fade mark, not the hero box. The hero's bottom edge is now a
     fade-length BELOW the point where its light actually ends, so keying off
     the box left a light pill sitting over ground that had already crossed
     to night. The mark sits at the end of the solid cream; the hero itself is
     the fallback for any page that has no ramp. */
  const mark = hero.querySelector('.hero-fade-mark') || hero;

  /* Flip when the mark crosses the VERTICAL CENTRE of the pill: --nav-top
     plus half of --nav-h, read from the stylesheet so the two cannot drift
     apart. The root is shrunk from the top by exactly that, and extended far
     past the bottom, so "intersecting" means precisely "the mark is still
     below the middle of the pill" — which is true at scroll 0 however far
     down the fold the mark sits. */
  const px = (name, fallback) => {
    const raw = parseFloat(
      window.getComputedStyle(document.documentElement).getPropertyValue(name)
    );
    return Number.isFinite(raw) ? raw : fallback;
  };
  const band = Math.round(px('--nav-top', 14) + px('--nav-h', 64) / 2);

  const observer = new window.IntersectionObserver(
    (entries) => {
      for (let i = 0; i < entries.length; i++) {
        nav.classList.toggle('nav-light', entries[i].isIntersecting);
      }
    },
    { rootMargin: '-' + band + 'px 0px 9999px 0px', threshold: 0 }
  );
  observer.observe(mark);
}

/* ====================================================================
 * Easter egg: typing "spiderman" anywhere on the page opens the pixel
 * web-swinging mini game. The module is only fetched once the word is
 * actually completed, so visitors who never find it pay nothing for it.
 * ================================================================== */
const EGG = 'spiderman';

function initEgg() {
  let buffer = '';
  let loading = false;
  let closeArcade = null;

  document.addEventListener('keydown', (event) => {
    /* Never swallow real typing: fields, editable regions and shortcuts. */
    const t = event.target;
    if (
      t &&
      (t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        t.tagName === 'SELECT' ||
        t.isContentEditable)
    ) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (!event.key || event.key.length !== 1) return;
    if (closeArcade || loading) return;

    buffer = (buffer + event.key.toLowerCase()).slice(-EGG.length);
    if (buffer !== EGG) return;
    buffer = '';
    loading = true;
    /* This keydown IS the user gesture the Web Audio API needs, and the
       import resolves inside it, so the soundtrack is allowed to start. */
    import('./arcade.js')
      .then((mod) => {
        loading = false;
        closeArcade = mod.openArcade() || null;
        if (closeArcade) {
          const original = closeArcade;
          closeArcade = () => {
            original();
            closeArcade = null;
          };
        }
      })
      .catch(() => {
        loading = false;
      });
  });
}

/* ====================================================================
 * Boot
 * ================================================================== */
function init() {
  initNav();
  initNavTheme();
  initYear();
  initCalendly();
  initSayHi();
  initEgg();
  /* Always-on: the typewriter is plain DOM work, so it runs whether or not
     the WebGL gate below opens. */
  initNetwork();
  armPixel();
  scheduleBoot();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
