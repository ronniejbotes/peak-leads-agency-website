/*
 * Peak Leads - src/js/pages/booking.js
 * Entry for /book-a-call/pick-a-time/, the one page on the site with a
 * booking calendar. A visitor gets here only by answering the questions on
 * /book-a-call/ in a way that opens it: the inline script in the page's
 * <head> sends everyone else back to /book-a-call/ before anything draws.
 *
 *   Calendar   Calendly's inline embed, filled in with the name and email
 *              the questions have just taken, so nobody types them twice. The
 *              event URL is set here, not in the markup, so the page source
 *              carries no booking link. src/js/book.js loads the widget,
 *              reports the booking to the Pixel and sends the visitor on to
 *              /thank-you/.
 *   Source     utm_campaign names the page that sent the visitor to the
 *              questions, not this one, and the campaign params they arrived
 *              with ride along, so Calendly still shows where a booking came
 *              from now that every booking happens on this page.
 *   Outbox     Retries answers that had not been acknowledged when the
 *              funnel moved on, in case that send failed.
 */
import '../../styles/main.css';
import { armPixel, trackPixel } from '../pixel.js';
import { initMailLinks } from '../email.js';
import { initBookSection, slugFor, spacesAsPercent20 } from '../book.js';
import { readHandoff, flushOutbox } from '../lead.js';

const EVENT_URL = 'https://calendly.com/bradley-hart/30min';

function bookingUrl(handoff) {
  const url = new URL(EVENT_URL);
  url.searchParams.set('hide_gdpr_banner', '1');
  if (!handoff || handoff.open !== true) return url.toString();
  addPrefill(url, handoff);
  return spacesAsPercent20(url.toString());
}

function addPrefill(url, handoff) {
  if (handoff.name) url.searchParams.set('name', handoff.name);
  if (handoff.email) url.searchParams.set('email', handoff.email);
  /* "book-a-call" when they came straight into the questions from outside. */
  url.searchParams.set('utm_campaign', handoff.from ? slugFor(handoff.from) : 'book-a-call');
  /* Set after the campaign above, so an ad's own params win, as they always
     have. book.js fills in whichever utm_* keys are still missing. */
  const utm = handoff.utm && typeof handoff.utm === 'object' ? handoff.utm : {};
  for (const key of Object.keys(utm)) {
    if (/^utm_[a-z]+$/.test(key) && utm[key]) url.searchParams.set(key, String(utm[key]));
  }
}

/* ", Jane" in "Pick a time for your call, Jane." */
function greet(handoff) {
  const first = handoff && handoff.name ? String(handoff.name).trim().split(/\s+/)[0] : '';
  document.querySelectorAll('[data-name-tail]').forEach((el) => {
    el.textContent = first ? ', ' + first : '';
  });
}

function init() {
  /* Null when storage is unreadable: the gate let the visitor through, and
     the calendar simply opens empty. */
  const handoff = readHandoff();
  greet(handoff);

  const url = bookingUrl(handoff);
  /* data-url before initBookSection(): widget.js reads it once, when the
     embed is injected. */
  const embed = document.querySelector('.calendly-inline-widget');
  if (embed) embed.setAttribute('data-url', url);
  const direct = document.getElementById('calendly-direct');
  if (direct) {
    direct.setAttribute('href', url);
    direct.setAttribute('rel', 'noopener');
  }

  initBookSection({ onBooked: () => trackPixel('trackCustom', 'CallScheduled') });
  initMailLinks();
  armPixel();
  flushOutbox();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
