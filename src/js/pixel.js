/*
 * Peak Leads - src/js/pixel.js
 * Shared Facebook Pixel loader (deferred). Used by main.js and audit.js.
 * Loads after (window load + 1.5s) OR the first pointerdown/keydown,
 * whichever comes first, once. loadPixel() can also be called directly
 * right before a tracked conversion to guarantee fbq exists.
 */
const PIXEL_ID = '1586557796001231';
let pixelLoaded = false;

export function loadPixel() {
  if (pixelLoaded) return;
  pixelLoaded = true;
  if (!window.fbq) {
    const n = (window.fbq = function () {
      if (n.callMethod) {
        n.callMethod.apply(n, arguments);
      } else {
        n.queue.push(arguments);
      }
    });
    if (!window._fbq) window._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }
  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
}

export function armPixel() {
  window.addEventListener('pointerdown', loadPixel, { once: true, passive: true });
  window.addEventListener('keydown', loadPixel, { once: true });
  const afterLoad = () => window.setTimeout(loadPixel, 1500);
  if (document.readyState === 'complete') {
    afterLoad();
  } else {
    window.addEventListener('load', afterLoad, { once: true });
  }
}

/* Fire a pixel event, loading the pixel first if it never armed. */
export function trackPixel(kind, eventName) {
  loadPixel();
  if (typeof window.fbq === 'function') {
    window.fbq(kind, eventName);
  }
}
