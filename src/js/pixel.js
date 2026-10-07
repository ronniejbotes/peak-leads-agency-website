/*
 * Peak Leads - src/js/pixel.js
 * Shared Facebook Pixel loader (deferred). Used by main.js, audit.js and
 * pages/booking.js.
 * Loads once, on the first sign of a person: pointerdown, pointermove,
 * touchstart, keydown or wheel. There is no timer, and a bare scroll event
 * does not count: the browser fires one for an anchor jump or a restored
 * scroll position with nobody touching anything. A lab run or a crawler
 * never interacts, so it never pays for fbevents.js and the config script it
 * pulls in, while a real visitor almost always does within seconds. The cost
 * is that a visitor who never moves, taps, types or scrolls sends no
 * PageView. loadPixel() can also be called directly right before a tracked
 * conversion to guarantee fbq exists (trackPixel does).
 */
const PIXEL_ID = '1586557796001231';
let pixelLoaded = false;
let pixelFailed = false;

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
    script.onerror = () => {
      pixelFailed = true;
    };
    document.head.appendChild(script);
  }
  /* No automatic events: without this, Meta's code also reports button
     clicks and page metadata of its own accord, and the privacy notice
     promises exactly three events (PageView, CallScheduled, Lead). */
  window.fbq('set', 'autoConfig', false, PIXEL_ID);
  window.fbq('init', PIXEL_ID);
  window.fbq('track', 'PageView');
}

const INTENT = ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'wheel'];

export function armPixel() {
  /* Capture on window, so nothing further down can swallow the signal. */
  const opts = { capture: true, passive: true };
  const onIntent = () => {
    INTENT.forEach((type) => window.removeEventListener(type, onIntent, opts));
    loadPixel();
  };
  INTENT.forEach((type) => window.addEventListener(type, onIntent, opts));
}

/* Fire a pixel event, loading the pixel first if it never armed. */
export function trackPixel(kind, eventName) {
  loadPixel();
  if (typeof window.fbq === 'function') {
    window.fbq(kind, eventName);
  }
}

/* fbevents.js is up and has taken over the queue (it sets callMethod on the
   stub when it does), so an event handed to fbq now is sent straight away. */
export function pixelUp() {
  return typeof window.fbq === 'function' && typeof window.fbq.callMethod === 'function';
}

/* fbevents.js failed to load: an ad blocker or tracking protection, almost
   always. Nothing queued will ever be sent, so a page holding a navigation
   for the Pixel can stop waiting. */
export function pixelBlocked() {
  return pixelFailed;
}
