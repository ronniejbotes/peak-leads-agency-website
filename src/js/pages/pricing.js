/*
 * Peak Leads - src/js/pages/pricing.js
 * Entry for /pricing/. Layers the pricing-only behaviour on top of the
 * shared static-page entry (styles + nav burger + footer year).
 *
 * Ported from a React/framer-motion reference block. No React here, so the
 * three pieces of that component that carry the feel are hand-rolled:
 *   - NumberFlow price roll  -> countTo(), eased rAF over the digits
 *   - framer whileInView     -> IntersectionObserver + a CSS transition
 *   - canvas-confetti        -> burst(), ~40 lines on a throwaway canvas
 * Doing it this way keeps the page at zero new dependencies and lets the
 * whole lot switch off cleanly under prefers-reduced-motion.
 *
 * Contract, same as the rest of the site:
 * - CSS never pre-hides content. Reveal from-states are set by JS only.
 * - Reduced motion keeps every feature, drops every animation.
 */
import './subpage.js';

const reduced =
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/* ==================================================================
 * Region switch. The prices are already in the DOM as data-za/data-us,
 * and the inline script in the page picked the opening region, so this
 * only has to animate between two known numbers.
 * ================================================================== */
function initRegionSwitch() {
  const root = document.querySelector('[data-region-switch]');
  if (!root) return;

  const buttons = Array.prototype.slice.call(
    root.querySelectorAll('[data-region-btn]')
  );
  const prices = Array.prototype.slice.call(document.querySelectorAll('[data-price]'));
  const swaps = Array.prototype.slice.call(
    document.querySelectorAll('[data-setup], [data-saving]')
  );
  if (!buttons.length) return;

  let current = root.getAttribute('data-active') === 'za' ? 'za' : 'us';

  function apply(key, animate) {
    if (key === current) return;
    current = key;
    root.setAttribute('data-active', key);
    buttons.forEach((b) =>
      b.setAttribute('aria-checked', b.getAttribute('data-region-btn') === key ? 'true' : 'false')
    );
    /* Text swaps land immediately; only the big numbers roll. */
    swaps.forEach((el) => {
      el.textContent = el.getAttribute('data-' + key);
    });
    prices.forEach((el) => {
      const to = Number(el.getAttribute('data-' + key)) || 0;
      const prefix = el.getAttribute('data-prefix-' + key) || '';
      if (!animate) {
        el.textContent = prefix + fmt(to);
        return;
      }
      const from = Number(String(el.textContent).replace(/[^\d]/g, '')) || 0;
      countTo(el, from, to, prefix);
    });
    if (animate) burst(root);
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => apply(btn.getAttribute('data-region-btn'), true));
  });

  /* Arrow keys move between the two radios, per the radiogroup pattern. */
  root.addEventListener('keydown', (event) => {
    const key = event.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowDown') {
      return;
    }
    event.preventDefault();
    const next = current === 'za' ? 'us' : 'za';
    apply(next, true);
    const btn = buttons.filter((b) => b.getAttribute('data-region-btn') === next)[0];
    if (btn) btn.focus();
  });
}

/* Eased count between two prices. Mirrors the #proof stat count-up on the
   homepage: ease-out cubic, mutates textContent only, jumps straight to the
   end under reduced motion. */
function countTo(el, from, to, prefix) {
  if (reduced || typeof window.requestAnimationFrame !== 'function') {
    el.textContent = prefix + fmt(to);
    return;
  }
  if (el._raf) cancelAnimationFrame(el._raf);
  const DURATION = 520;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / DURATION);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = prefix + fmt(Math.round(from + (to - from) * eased));
    if (t < 1) {
      el._raf = requestAnimationFrame(step);
    } else {
      el._raf = 0;
    }
  };
  el._raf = requestAnimationFrame(step);
}

/* ==================================================================
 * Confetti. A throwaway fixed canvas over the viewport, torn down the
 * moment the last particle falls out of frame - nothing persists.
 * ================================================================== */
function burst(anchor) {
  if (reduced || typeof window.requestAnimationFrame !== 'function') return;

  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.className = 'confetti-layer';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const rect = anchor.getBoundingClientRect();
  const ox = rect.left + rect.width / 2;
  const oy = rect.top + rect.height / 2;
  /* Chalk through to accent - the page palette, nothing louder. */
  const colors = ['#D9C7A0', '#F2EFE9', '#B8A47A', '#D9A441'];
  const bits = [];
  for (let i = 0; i < 60; i++) {
    const angle = (Math.PI * 2 * i) / 60 + Math.random() * 0.4;
    const speed = 3 + Math.random() * 5;
    bits.push({
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      r: 2 + Math.random() * 3,
      life: 1,
      color: colors[i % colors.length]
    });
  }

  let raf = 0;
  const tick = () => {
    ctx.clearRect(0, 0, w, h);
    let alive = 0;
    for (let i = 0; i < bits.length; i++) {
      const b = bits[i];
      if (b.life <= 0) continue;
      b.vy += 0.16; /* gravity */
      b.vx *= 0.99;
      b.vy *= 0.99;
      b.x += b.vx;
      b.y += b.vy;
      b.life -= 0.012;
      if (b.y > h + 20 || b.life <= 0) continue;
      alive++;
      ctx.globalAlpha = Math.max(0, b.life);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (alive) {
      raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
      canvas.remove();
    }
  };
  raf = requestAnimationFrame(tick);
}

/* ==================================================================
 * Pointer-reactive cards. Two effects off one mousemove:
 *   1. a slight 3D tilt toward the cursor
 *   2. a specular glow that tracks the cursor across the card face
 * Both are written as CSS custom properties and applied by the sheet, so
 * this handler never touches layout and the card keeps whatever transition
 * the stylesheet gives it. Pointer-fine only: on touch there is no hover
 * state to reward, and the tilt would fight the scroll.
 * ================================================================== */
function initTilt() {
  if (reduced) return;
  if (typeof window.matchMedia === 'function' && !window.matchMedia('(pointer: fine)').matches) {
    return;
  }

  const cards = Array.prototype.slice.call(document.querySelectorAll('[data-tilt]'));
  if (!cards.length) return;

  const MAX_TILT = 5; /* degrees; past ~6 it reads as a gimmick */

  cards.forEach((card) => {
    let raf = 0;
    let px = 0;
    let py = 0;

    const write = () => {
      raf = 0;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = (px - rect.left) / rect.width;  /* 0..1 */
      const ny = (py - rect.top) / rect.height;
      card.style.setProperty('--mx', (nx * 100).toFixed(2) + '%');
      card.style.setProperty('--my', (ny * 100).toFixed(2) + '%');
      card.style.setProperty('--ry', ((nx - 0.5) * 2 * MAX_TILT).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((0.5 - ny) * 2 * MAX_TILT).toFixed(2) + 'deg');
    };

    card.addEventListener('pointermove', (event) => {
      px = event.clientX;
      py = event.clientY;
      if (!raf) raf = requestAnimationFrame(write);
    });

    card.addEventListener('pointerenter', () => card.setAttribute('data-hover', ''));

    card.addEventListener('pointerleave', () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      card.removeAttribute('data-hover');
      /* Back to rest. The stylesheet's transition carries it home. */
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

/* ==================================================================
 * Reveal. The cards settle in with the staggered lift the reference
 * component got from framer's whileInView. CSS never pre-hides them:
 * the from-state is set here, so with JS off they are simply visible.
 * ================================================================== */
function initReveal() {
  const cards = Array.prototype.slice.call(document.querySelectorAll('[data-tilt]'));
  if (!cards.length || reduced || !('IntersectionObserver' in window)) return;

  cards.forEach((card, i) => {
    card.style.transitionDelay = i * 90 + 'ms';
    card.setAttribute('data-enter', '');
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.removeAttribute('data-enter');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.2 }
  );
  cards.forEach((card) => observer.observe(card));
}

/* ==================================================================
 * Calendly. Same lazy-load as the homepage (see main.js initCalendly):
 * the embed div carries data-url and Calendly's widget.js picks it up
 * once injected. Injection waits until #book is within 800px so the
 * third-party bundle never competes with the cards for the first paint.
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
  if (!book || !document.querySelector('.calendly-inline-widget')) return;

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

  /* A card CTA is an in-page jump to a widget that may not have loaded yet.
     Inject on the click so the embed is already building while the smooth
     scroll runs, instead of landing on an empty box. */
  document.addEventListener('click', (event) => {
    const target = event.target;
    const link = target && typeof target.closest === 'function' ? target.closest('a') : null;
    if (link && (link.getAttribute('href') || '').indexOf('#book') !== -1) injectCalendly();
  });
}

function init() {
  initRegionSwitch();
  initTilt();
  initReveal();
  initCalendly();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
