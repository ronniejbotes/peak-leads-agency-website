/*
 * Peak Leads - src/js/network.js
 * #network typewriter heading.
 *
 * Ported from a React spec's TypewriterHeading component. The count-up in
 * the orbit core is NOT here: that element carries .stat/.stat-value, so the
 * existing #proof counter in scroll.js drives it and there is one count-up
 * implementation on the site rather than two.
 *
 * Contract, as everywhere else:
 * - CSS never pre-hides content. The full heading is in the markup; this
 *   only empties it once it has decided to animate, so JS off (or a throw
 *   before init) leaves the heading fully readable.
 * - Reduced motion renders the finished state immediately.
 * - Nothing starts until the heading is actually on screen, so the effect is
 *   not already over by the time it is scrolled to.
 */

const SPEED = 35;      /* ms per character */
const START_DELAY = 400;

/* Count-up for the orbit core. Deliberately not scroll.js's initStatCounters:
   that one keys off .stat, and those classes carry #proof's container-query
   sizing (container-type + 26cqi), which collapses on this absolutely
   positioned box. It also means the figure still animates under body.no-3d,
   where scroll.js never loads at all. */
function initCount() {
  const el = document.querySelector('[data-count-to]');
  if (!el) return;

  const to = parseFloat(el.getAttribute('data-count-to'));
  if (!Number.isFinite(to)) return;
  const prefix = el.getAttribute('data-prefix') || '';
  const suffix = el.getAttribute('data-suffix') || '';
  const decimals = (String(to).split('.')[1] || '').length;
  const render = (v) => {
    el.textContent = prefix + v.toFixed(decimals) + suffix;
  };

  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced || !('IntersectionObserver' in window) ||
      typeof window.requestAnimationFrame !== 'function') {
    render(to);
    return;
  }

  const DURATION = 1600;
  let ran = false;
  const observer = new IntersectionObserver(
    (entries) => {
      for (let n = 0; n < entries.length; n++) {
        if (!entries[n].isIntersecting || ran) continue;
        ran = true;
        observer.disconnect();
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / DURATION);
          render(to * (1 - Math.pow(1 - t, 3))); /* ease-out cubic */
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        break;
      }
    },
    { threshold: 0.4 }
  );
  observer.observe(el);
}

export function initNetwork() {
  initCount();

  const el = document.querySelector('[data-typewriter]');
  if (!el) return;

  const full = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (!full) return;

  const split = Math.min(
    Math.max(parseInt(el.getAttribute('data-split'), 10) || 0, 0),
    full.length
  );
  const head = full.slice(0, split);
  const tail = full.slice(split);

  /* Build the two-tone structure once. Written straight to textContent per
     frame afterwards, so no markup is parsed on the hot path. */
  el.textContent = '';
  const headEl = document.createElement('span');
  headEl.className = 'tw-head';
  const tailEl = document.createElement('span');
  tailEl.className = 'tw-tail';
  const caret = document.createElement('span');
  caret.className = 'tw-caret';
  caret.setAttribute('aria-hidden', 'true');
  el.append(headEl, tailEl, caret);

  const finish = () => {
    headEl.textContent = head;
    tailEl.textContent = tail;
    el.setAttribute('data-done', '');
  };

  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced || typeof window.requestAnimationFrame !== 'function') {
    finish();
    return;
  }

  /* Screen readers get the whole string up front rather than a per-character
     stutter; the visible spans are the animation only. */
  el.setAttribute('aria-label', full);
  headEl.setAttribute('aria-hidden', 'true');
  tailEl.setAttribute('aria-hidden', 'true');

  let started = false;
  const run = () => {
    if (started) return;
    started = true;
    let i = 0;
    const startAt = performance.now() + START_DELAY;
    const tick = (now) => {
      if (now < startAt) {
        requestAnimationFrame(tick);
        return;
      }
      /* Derive the index from elapsed time rather than incrementing once per
         frame: a background tab or a slow frame must not stretch the effect. */
      i = Math.min(full.length, Math.floor((now - startAt) / SPEED));
      headEl.textContent = full.slice(0, Math.min(i, split));
      tailEl.textContent = i > split ? full.slice(split, i) : '';
      if (i < full.length) {
        requestAnimationFrame(tick);
      } else {
        finish();
      }
    };
    requestAnimationFrame(tick);
  };

  if (!('IntersectionObserver' in window)) {
    run();
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (let n = 0; n < entries.length; n++) {
        if (entries[n].isIntersecting) {
          observer.disconnect();
          run();
          break;
        }
      }
    },
    { threshold: 0.35 }
  );
  observer.observe(el);
}
