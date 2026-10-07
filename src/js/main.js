/*
 * Peak Leads - src/js/main.js
 * Landing page entry: always-on utilities + the 3D boot gate.
 *
 * Contract (DESIGN.md section 7):
 * - Dynamic-imports scene.js + scroll.js on the first sign of a person
 *   (pointermove, pointerdown, touchstart, wheel, keydown or scroll), never
 *   on a timer. At scroll 0 the WebGL layer draws nothing visible over the
 *   daylight hero, so until then the page is the plain DOM the server sent:
 *   hero text is LCP, and a visitor who never interacts (a lab run, a
 *   crawler) never pays for the chunks, the shaders or the ScrollTriggers.
 *   A load that lands on a /#hash has already scrolled, and that counts.
 * - All-or-nothing gate: prefers-reduced-motion, missing canvas, a failed
 *   import, scene.init returning false or ANY throw -> body.no-3d and no
 *   choreography. A choreography failure after the scene started also
 *   tears everything down to no-3d. The page stays fully readable.
 * - Always-on utilities run with or without 3D: nav burger, footer year,
 *   email links, video posters, "Say hi" bubble gating,
 *   Facebook Pixel.
 * - #work's card cylinder is gated on prefers-reduced-motion ONLY, not on
 *   the WebGL boot: it is plain CSS 3D, so a machine that fails scene.init
 *   still gets it. It is built when #work comes within a screen of the
 *   viewport. Under reduced motion the scroll-snap strip stays.
 * - `js-enabled` is added by the tiny inline script in <head>, not here.
 * - No THREE and no GSAP imports in this file.
 */
import '../styles/main.css';
import { armPixel } from './pixel.js';
import { initNetwork } from './network.js';
import { initMailLinks } from './email.js';

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
    .then(([sceneMod, scrollMod]) => whenScrollSettles(() => {
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
      reaimLanding();
    }))
    .catch(() => {
      booting = false;
      applyNo3D();
    });
}

/* Scroll settle. The choreography's first ScrollTrigger refresh measures by
   jumping to the top and back, and "back" is wherever a scroll still in
   flight had got to; the cylinder build makes #work taller underneath a
   smooth scroll whose destination is already fixed. Run mid-scroll, either
   one strands an in-page link short of its target, and with the boot now
   started by the click itself that is exactly when they would run. So both
   wait until the scroll position has held still for a few frames and, when
   an in-page link is on its way somewhere (see landing below), until it has
   got there. Frames rather than scroll events: a smooth scroll keeps
   running while the main thread is busy parsing the 3D chunks, and its
   events arrive late, so a quiet spell of events can be a lie. At the hero,
   where most first interactions happen, that is a wait of a few frames. */
const STILL_FRAMES = 6;

function whenScrollSettles(fn) {
  let lastY = window.scrollY;
  let still = 0;
  const tick = () => {
    const y = window.scrollY;
    const travelling = !landing.done && !!landing.target && !landing.arrived;
    if (y === lastY && !travelling) {
      still += 1;
    } else {
      still = 0;
      lastY = y;
    }
    if (still >= STILL_FRAMES) fn();
    else window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}

window.addEventListener('scroll', () => watchLanding(), { passive: true });

/* The first sign of a person. Listened for in the capture phase on window,
   so element scrolls (which do not bubble) count too and nothing further
   down can swallow the signal. */
const INTENT = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'keydown', 'scroll'];

function scheduleBoot() {
  /* Reduced motion has nothing to wait for: straight to the static page. */
  if (prefersReducedMotion()) {
    applyNo3D();
    return;
  }
  const opts = { capture: true, passive: true };
  const onIntent = () => {
    INTENT.forEach((type) => window.removeEventListener(type, onIntent, opts));
    warmSayHi();
    boot3D();
    warmCylinder();
  };
  INTENT.forEach((type) => window.addEventListener(type, onIntent, opts));

  /* A load that lands on a /#hash, or a reload the browser scrolls back into
     place, can scroll before this module runs, and that scroll event has
     already gone. Starting anywhere below the top is the same signal. */
  if (window.scrollY > 0) onIntent();
}

/* ====================================================================
 * #work card cylinder. Its own gate, its own rAF loop; see cylinder.js.
 * Loaded lazily so it never competes with the hero paint, and only once
 * #work is within a screen of the viewport: the upgrade injects the chrome,
 * plate and edge slices into every card and starts all nine screenshots
 * downloading as CSS backgrounds, none of which helps someone still
 * reading the hero. workNear stays true once set, so a reduced-motion
 * round trip rebuilds straight away rather than waiting for a scroll.
 * ================================================================== */
let cylinderCleanup = null;
let cylinderLoading = false;
let workNear = false;

function bootCylinder() {
  if (!workNear || cylinderCleanup || cylinderLoading || prefersReducedMotion()) return;
  if (!document.querySelector('.conveyor[data-cylinder]')) return;
  cylinderLoading = true;
  import('./cylinder.js')
    .then((mod) => {
      const build = () => {
        cylinderLoading = false;
        if (prefersReducedMotion()) return;
        try {
          cylinderCleanup = mod.initWorkCylinder();
        } catch (err) {
          /* Decorative: the scroll-snap strip is still underneath. */
          cylinderCleanup = null;
        }
        reaimLanding();
      };
      /* Only an in-page link on its way somewhere is worth waiting for.
         Otherwise build now: #work is still a screen away, so nothing on
         screen moves, where waiting for the visitor's first stop could land
         the taller stage under their eyes. */
      if (!landing.done && landing.target) whenScrollSettles(build);
      else build();
    })
    .catch(() => {
      cylinderLoading = false;
    });
}

/* Fetch the module (without building anything) as soon as someone is here,
   so the build lands the moment #work comes near rather than a round trip
   later. The taller stage re-centres #work's heading when it replaces the
   strip: invisible a screen ahead, a visible jump if a fast scroll or an
   in-page link had already brought #work on screen before the build. */
function warmCylinder() {
  if (prefersReducedMotion() || !document.querySelector('.conveyor[data-cylinder]')) return;
  import('./cylinder.js').catch(() => {});
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

/* Watched under reduced motion too, so the preference can flip later. */
function watchCylinder() {
  const stage = document.querySelector('.conveyor[data-cylinder]');
  if (!stage) return;
  if (!('IntersectionObserver' in window)) {
    workNear = true;
    bootCylinder();
    return;
  }
  const observer = new window.IntersectionObserver(
    (entries) => {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          observer.disconnect();
          workNear = true;
          bootCylinder();
          return;
        }
      }
    },
    { rootMargin: '100% 0px' }
  );
  observer.observe(stage);
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
   Re-aim once those have run, and again after the 3D boot and the cylinder
   build, which can now land after load. The boot is the dangerous one:
   ScrollTrigger's refresh measures by jumping to the top and back, and
   "back" is wherever a scroll still in flight had got to. So every re-aim
   is instant, never smooth (a smooth one is exactly such a scroll), and
   they stop for good the moment the visitor wheels, taps, clicks or presses
   a key, or after ten seconds: from then on the position is theirs.
   An in-page link clicked before the boot or the cylinder build is the same
   case after load (hashchange), and is held the same way: if the boot's
   refresh cut the link's smooth scroll short, or it never got going because
   the chunks were still being parsed, the re-aim finishes the trip. Once
   the target has been reached, scrolling well away from it also releases
   the hold, which covers the one route none of the takeover events catch
   (a dragged scrollbar). */
const landing = { target: null, done: true, timer: 0, arrived: false };
const TAKEOVER = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
const takeoverOpts = { capture: true, passive: true };

function releaseLanding() {
  landing.done = true;
  TAKEOVER.forEach((type) => window.removeEventListener(type, releaseLanding, takeoverOpts));
  if (landing.timer) {
    window.clearTimeout(landing.timer);
    landing.timer = 0;
  }
}

function holdLanding(target) {
  releaseLanding();
  landing.target = target;
  landing.done = false;
  landing.arrived = false;
  TAKEOVER.forEach((type) => window.addEventListener(type, releaseLanding, takeoverOpts));
  landing.timer = window.setTimeout(releaseLanding, 10000);
  /* A load that lands on a /#hash is usually already there. */
  watchLanding();
}

function watchLanding() {
  if (landing.done || !landing.target) return;
  const off = Math.abs(landing.target.getBoundingClientRect().top);
  const vh = window.innerHeight || 0;
  if (off <= vh) landing.arrived = true;
  else if (landing.arrived && off > vh * 1.5) releaseLanding();
}

/* Where a jump to el leaves its top: the page's scroll-padding plus the
   element's own scroll-margin, both from the stylesheet. */
function landingOffset(el) {
  const style = window.getComputedStyle;
  return (
    (parseFloat(style(el).scrollMarginTop) || 0) +
    (parseFloat(style(document.documentElement).scrollPaddingTop) || 0)
  );
}

function reaimLanding() {
  if (!landing.target || landing.done) return;
  /* After arrival a re-aim only ever corrects drift (the cylinder's taller
     stage, late fonts). A target far from where the jump left it means the
     visitor has scrolled on by a route the takeover events cannot see
     (find in page, a screen reader), so
     the position is theirs. */
  if (landing.arrived) {
    const drift = Math.abs(landing.target.getBoundingClientRect().top - landingOffset(landing.target));
    if (drift > (window.innerHeight || 0) * 0.25) {
      releaseLanding();
      return;
    }
  }
  try {
    landing.target.scrollIntoView({ block: 'start', behavior: 'instant' });
  } catch (err) {
    landing.target.scrollIntoView(true);
  }
}

function hashTarget() {
  if (!location.hash || location.hash.length < 2) return null;
  try {
    return document.getElementById(decodeURIComponent(location.hash.slice(1)));
  } catch (err) {
    return null;
  }
}

/* The element a link points at, when the link stays on this page. */
function inPageTarget(link) {
  let url;
  try {
    url = new URL(link.href, location.href);
  } catch (err) {
    return null;
  }
  if (url.origin !== location.origin || url.pathname !== location.pathname) return null;
  if (url.search !== location.search || !url.hash || url.hash.length < 2) return null;
  try {
    return document.getElementById(decodeURIComponent(url.hash.slice(1)));
  } catch (err) {
    return null;
  }
}

function initLanding() {
  /* Held on the click itself, in the capture phase, before the browser
     starts its scroll: hashchange arrives too late when the boot's long
     task lands between the two (tap the burger, which starts the boot,
     then a menu link). The click's own pointerdown has already been, so it
     cannot release the hold it sets. hashchange stays for Back and Forward
     between fragments, and for links that change the hash without a click. */
  document.addEventListener(
    'click',
    (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const t = event.target;
      const link = t && typeof t.closest === 'function' ? t.closest('a[href]') : null;
      if (!link || (link.target && link.target !== '_self')) return;
      const target = inPageTarget(link);
      if (target) holdLanding(target);
    },
    true
  );
  window.addEventListener('hashchange', () => {
    const target = hashTarget();
    if (target && (landing.done || landing.target !== target)) holdLanding(target);
  });

  /* A reload or a Back to this page: the browser is putting the visitor
     back where they were, which is not necessarily the hash in the URL. */
  const navEntry =
    typeof performance.getEntriesByType === 'function'
      ? performance.getEntriesByType('navigation')[0]
      : null;
  if (navEntry && (navEntry.type === 'reload' || navEntry.type === 'back_forward')) return;

  const target = hashTarget();
  if (!target) return;
  holdLanding(target);
  const afterLoad = () => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(reaimLanding));
  };
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
}

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
 * "Say hi" bubble. Shown only when the 3D experience is running
 * (body not .no-3d), on precise pointers at >=900px. Hidden while #book
 * is on screen, so it never sits beside the booking button it repeats.
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
      /* 144px bubble: the 2x file for any screen denser than 1x. */
      attachPoster(sayHi.video, (window.devicePixelRatio || 1) > 1);
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

/* ====================================================================
 * Video posters. data-poster (1x) and data-poster-hd (2x) sit beside the
 * real attribute, and the right one is set only when it is worth fetching.
 * The VSL ships a 400px poster in the markup, so there is never a black
 * box or a stray first frame (it is preload="none") and a phone that never
 * scrolls that far pays 9KB, not 31KB. Once the video is about a screen
 * away the 960px file replaces it, or the 1920px one on a box wide and
 * dense enough to show the difference. The "Say hi" bubble has none in the
 * markup, because it is hidden until the 3D runs: its poster is fetched on
 * the first sign of a person (warmSayHi), ahead of the bubble appearing.
 * ================================================================== */
function attachPoster(video, hd) {
  if (!video) return;
  const src =
    (hd && video.getAttribute('data-poster-hd')) || video.getAttribute('data-poster');
  if (src && video.getAttribute('poster') !== src) video.setAttribute('poster', src);
}

/* Only where the bubble can ever show: a precise pointer on a wide screen. */
function warmSayHi() {
  if (!sayHi.video) return;
  if (!(mqPointerFine && mqPointerFine.matches) || !(mqWide && mqWide.matches)) return;
  attachPoster(sayHi.video, (window.devicePixelRatio || 1) > 1);
}

function initVslPoster() {
  const video = document.querySelector('#vsl video[data-poster-hd]');
  if (!video) return;
  /* The 960px file is enough unless the box, in device pixels, is wider
     than that. A phone never needs the HD one: at its width the difference
     cannot be seen. Measured at attach time. */
  const attach = () => {
    const width = video.clientWidth || video.getBoundingClientRect().width;
    attachPoster(video, width > 480 && width * (window.devicePixelRatio || 1) > 960);
  };
  if (!('IntersectionObserver' in window)) {
    attach();
    return;
  }
  const observer = new window.IntersectionObserver(
    (entries) => {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          observer.disconnect();
          attach();
          return;
        }
      }
    },
    { rootMargin: '100% 0px' }
  );
  observer.observe(video);
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
  initMailLinks();
  initSayHi();
  initVslPoster();
  initEgg();
  /* Always-on: the typewriter is plain DOM work, so it runs whether or not
     the WebGL gate below opens. */
  initNetwork();
  armPixel();
  initLanding();
  scheduleBoot();
  watchCylinder();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
