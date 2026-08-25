/*
 * Peak Leads - src/js/book.js
 * The closing "book a call" band, shared by every page.
 *
 * Two jobs, deliberately split so the two pages that already own their own
 * lazy-load (home, pricing) can take the first without the second:
 *
 *   decorateBookingLinks()  Stamps page context onto every Calendly URL on
 *                           the page - the embed's data-url and any plain
 *                           link to calendly.com. Must run BEFORE Calendly's
 *                           widget.js is injected, because widget.js reads
 *                           data-url once and never looks again.
 *   initBookSection()       Lazy-loads the widget when #book comes near the
 *                           viewport, and reports the booking to the Pixel.
 *
 * Adding the band to a new page needs no JS change: drop the markup in
 * (see DESIGN.md > Book-a-call band) and the page entry already calls both.
 */

const CALENDLY_HOST = 'calendly.com';
const WIDGET_CSS = 'https://assets.calendly.com/assets/external/widget.css';
const WIDGET_JS = 'https://assets.calendly.com/assets/external/widget.js';

/* Inbound campaign params beat anything we synthesise: if the visitor
   arrived on a Google Ad, that ad is the true source of the booking and
   must survive the hop into Calendly. */
const PASS_THROUGH = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

/* ====================================================================
 * Page context
 * ================================================================== */

/* /blog/how-much-do-roofing-leads-cost/ -> blog-how-much-do-roofing-leads-cost
   /                                     -> home
   On 404 this is whatever URL the visitor missed, which is worth knowing. */
function pageSlug() {
  let path = '';
  try {
    path = window.location.pathname || '';
  } catch (err) {
    return 'unknown';
  }
  path = path
    .replace(/index\.html?$/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
  if (!path) return 'home';
  return (
    path
      .toLowerCase()
      .replace(/\//g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .slice(0, 60) || 'home'
  );
}

/* The page title, minus the " | Peak Leads" tail, so the Calendly event
   reads as the page the visitor was actually on. */
function pageLabel() {
  const title = (document.title || '').split('|')[0].trim();
  return title.slice(0, 80);
}

function inboundParams() {
  const found = {};
  let search = '';
  try {
    search = window.location.search || '';
  } catch (err) {
    return found;
  }
  if (!search || typeof window.URLSearchParams !== 'function') return found;
  const params = new window.URLSearchParams(search);
  for (let i = 0; i < PASS_THROUGH.length; i++) {
    const key = PASS_THROUGH[i];
    const value = params.get(key);
    if (value) found[key] = value;
  }
  return found;
}

/* ====================================================================
 * URL decoration
 * ================================================================== */

/* placement distinguishes the embed from the "book directly" text links,
   so we can see which one people actually use. */
function decorate(rawUrl, placement, inbound) {
  let url;
  try {
    url = new window.URL(rawUrl, window.location.href);
  } catch (err) {
    return rawUrl;
  }
  if (url.hostname.indexOf(CALENDLY_HOST) === -1) return rawUrl;

  const context = {
    utm_source: 'peakleads.agency',
    utm_medium: 'website',
    utm_campaign: pageSlug(),
    utm_content: placement,
    utm_term: pageLabel(),
  };

  for (let i = 0; i < PASS_THROUGH.length; i++) {
    const key = PASS_THROUGH[i];
    /* Params hand-written into the markup win over both, so a one-off page
       can always override by putting the value in the href. */
    if (url.searchParams.has(key)) continue;
    const value = inbound[key] || context[key];
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

export function decorateBookingLinks() {
  if (typeof window.URL !== 'function' || typeof window.URLSearchParams !== 'function') return;
  const inbound = inboundParams();

  const embeds = document.querySelectorAll('.calendly-inline-widget[data-url]');
  for (let i = 0; i < embeds.length; i++) {
    const raw = embeds[i].getAttribute('data-url');
    if (raw) embeds[i].setAttribute('data-url', decorate(raw, 'book-embed', inbound));
  }

  const links = document.querySelectorAll('a[href*="' + CALENDLY_HOST + '"]');
  for (let i = 0; i < links.length; i++) {
    const raw = links[i].getAttribute('href');
    if (raw) links[i].setAttribute('href', decorate(raw, 'text-link', inbound));
  }
}

/* ====================================================================
 * Lazy-load
 * ================================================================== */

let injected = false;

export function injectCalendly() {
  if (injected) return;
  injected = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = WIDGET_CSS;
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.src = WIDGET_JS;
  script.async = true;
  document.head.appendChild(script);
}

export function initBookSection() {
  decorateBookingLinks();

  const book = document.getElementById('book');
  if (!book || !document.querySelector('.calendly-inline-widget')) return;

  /* Booked-call conversion: Calendly posts a message from inside the
     iframe when an event is scheduled. */
  window.addEventListener('message', (event) => {
    if (!event || !event.data || event.data.event !== 'calendly.event_scheduled') return;
    if (typeof event.origin === 'string' && event.origin.indexOf(CALENDLY_HOST) === -1) return;
    if (typeof window.fbq === 'function') window.fbq('trackCustom', 'CallScheduled');
  });

  /* Any in-page jump to #book means the visitor is on their way: start
     building the embed on the click rather than when it lands. */
  document.addEventListener('click', (event) => {
    const target = event.target;
    const link = target && typeof target.closest === 'function' ? target.closest('a') : null;
    if (link && (link.getAttribute('href') || '').indexOf('#book') !== -1) injectCalendly();
  });

  if (!('IntersectionObserver' in window)) {
    if (document.readyState === 'complete') injectCalendly();
    else window.addEventListener('load', injectCalendly, { once: true });
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
