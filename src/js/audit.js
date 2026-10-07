/*
 * Peak Leads - audit.js
 * Entry for /free-audit/: the six step audit funnel plus its own particle
 * scene boot. No GSAP here - formation morphs run on a tiny rAF lerp so the
 * funnel stays light. Every scene call is guarded; any boot failure or
 * prefers-reduced-motion adds body.no-3d and the page runs on the static
 * gradient fallback.
 *
 * The audit is also the only way to book a call: every "Book a call" on the
 * site links here, and the calendar lives on /book-a-call/ alone. Every
 * finished audit is emailed to the team. Then:
 *   - a monthly revenue band at or above BOOKING_MIN_REVENUE goes straight
 *     on to /book-a-call/;
 *   - anything below it stays here on a polite ending that offers no call,
 *     and so does any browser turned away in the last DECLINE_HOLDS_FOR,
 *     whatever it answers now, so reloading and picking a bigger number
 *     does not open the calendar.
 * The rule lives in this file and nowhere in the markup. Nothing a visitor
 * sees may hint that one answer leads somewhere different from another, or
 * people would simply pick the other answer.
 */
import '../styles/main.css';
import { armPixel, trackPixel, pixelUp, pixelBlocked } from './pixel.js';
import { initMailLinks } from './email.js';
import {
  sendLead,
  flushOutbox,
  readHandoff,
  writeHandoff,
  handoffWithin
} from './lead.js';

/* ==================================================================== *
 * Config
 * ==================================================================== */
const CONTACT_EMAIL = 'bradley@peakleads.agency';
const LEAD_KEY = 'pl_lead';
const PAGE_URL = 'https://peakleads.agency/free-audit/';
const BOOKING_PAGE = '/book-a-call/';

/* Bradley's qualifier (October 2026): a business turning over less than
   R75,000 a month is not offered a call. Compared with the data-floor on
   the chosen revenue option, which is the bottom of its band in rand. */
const BOOKING_MIN_REVENUE = 75000;
/* How long a browser that was turned away keeps that answer. Short on
   purpose (Ronnie, 7 October 2026): long enough to stop an instant retry
   with a bigger number, never long enough to shut a business out. */
const DECLINE_HOLDS_FOR = 2 * 60 * 60 * 1000;

/* The "All of the above" box on the help question ticks every other box,
   and ticking every other box ticks it. */
const HELP_ALL = 'All of the above';

/* Pages that are part of the funnel itself, never "where they came from". */
const FUNNEL_PATHS = /^\/(free-audit|book-a-call|thank-you)(\/|$)/;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

/* The hop to the calendar. Long enough to read "You're on the way up" and
   see the condense pulse; a Pixel that comes up mid-wait gets PIXEL_GRACE
   to send the Lead; LEAVE_BY overrides both, so a slow inbox relay or a
   stalled Pixel can never strand a qualified visitor here. */
const SHOW_FOR = 1400;
const PIXEL_GRACE = 1000;
const LEAVE_BY = 6000;

const $ = (id) => document.getElementById(id);

const motionQuery =
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
const prefersReduced = () => !!(motionQuery && motionQuery.matches);

/* ==================================================================== *
 * Funnel map
 * ==================================================================== */
const SCREEN_IDS = [
  'screen-intro',
  'screen-1', 'screen-2', 'screen-3',
  'screen-4', 'screen-5', 'screen-6',
  'screen-next',
  'screen-thanks'
];
/* The first screen after the audit is sent. The two endings sit at and
   after it: screen-next goes on to the calendar, screen-thanks does not. */
const DONE_INDEX = 7;
const NEXT_INDEX = 7;
const THANKS_INDEX = 8;
const TOTAL_STEPS = 6;

/* intro = 0 (PEAK); steps 1-6 walk PEAK, PLAY, FRAME, RANKS, FUNNEL and
   GROWTH (the revenue question gets the rising curve); the calendar hop
   returns to the PEAK to match "You're on the way up."; the other ending
   settles on the SPHERE, with no pulse. */
const FORMATION_BY_SCREEN = [0, 0, 1, 2, 3, 4, 5, 0, 6];

const FIELD_IDS = { 1: 'f-name', 2: 'f-email', 3: 'f-phone', 4: 'f-business' };
const ERROR_IDS = {
  1: 'err-name', 2: 'err-email', 3: 'err-phone',
  4: 'err-business', 5: 'err-help', 6: 'err-revenue'
};

const answers = { name: '', email: '', phone: '', business: '', helpWith: [], revenue: '' };
let revenueFloor = NaN;
let origin = { path: '', host: '', utm: {} };
let cur = 0;
let done = false;

/* ==================================================================== *
 * Scene boot (all or nothing)
 * ==================================================================== */
let scene = null;
let sceneActive = false;
let sceneBootTried = false;
let rafId = null;
let currentF = 0;
let targetF = 0;
let condenseAnim = null;
let pointerBound = false;
let resizeBound = false;

function sceneCall(method, ...args) {
  if (!sceneActive || !scene) return;
  try {
    if (typeof scene[method] === 'function') scene[method](...args);
  } catch (err) {
    /* decorative only */
  }
}

/* Condense pulse for the calendar hop: gather in, small bang, settle. */
function condenseValue(t) {
  if (t < 0.35) {
    const k = t / 0.35;
    return k * k;
  }
  if (t < 0.5) return 1 - ((t - 0.35) / 0.15) * 1.45;
  const k = (t - 0.5) / 0.5;
  return -0.45 * (1 - k) * (1 - k);
}

function frame() {
  rafId = requestAnimationFrame(frame);
  const d = targetF - currentF;
  if (Math.abs(d) > 0.001) {
    currentF += d * 0.08;
    if (Math.abs(targetF - currentF) < 0.001) currentF = targetF;
    sceneCall('setFormation', currentF);
  }
  if (condenseAnim) {
    const t = (performance.now() - condenseAnim.start) / condenseAnim.duration;
    if (t >= 1) {
      condenseAnim = null;
      sceneCall('setCondense', 0);
    } else {
      sceneCall('setCondense', condenseValue(t));
    }
  }
}

function startLoop() {
  if (sceneActive && rafId === null) rafId = requestAnimationFrame(frame);
}

function stopLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function pulseCondense() {
  if (!sceneActive) return;
  condenseAnim = { start: performance.now(), duration: 1300 };
}

function teardownScene() {
  stopLoop();
  condenseAnim = null;
  if (scene) {
    try {
      if (typeof scene.destroy === 'function') scene.destroy();
    } catch (err) {
      /* decorative only */
    }
  }
  scene = null;
  sceneActive = false;
  document.body.classList.add('no-3d');
}

/* Viewport dims are cached: per-event innerWidth/innerHeight reads force
   style/layout flushes in several engines (mirrors main.js). Refreshed in
   the debounced resize handler. */
let viewportW = window.innerWidth || 1;
let viewportH = window.innerHeight || 1;

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
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      viewportW = window.innerWidth || 1;
      viewportH = window.innerHeight || 1;
      sceneCall('resize');
    }, 200);
  });
}

function progressFor(i) {
  return Math.min(1, i / DONE_INDEX);
}

function bootScene() {
  if (sceneBootTried) return;
  if (prefersReduced()) {
    document.body.classList.add('no-3d');
    return;
  }
  sceneBootTried = true;
  import('./scene.js')
    .then((mod) => {
      const PeakScene = mod && mod.PeakScene;
      const canvas = document.getElementById('scene-canvas');
      let ok = false;
      if (canvas && PeakScene && typeof PeakScene.init === 'function') {
        try {
          ok = PeakScene.init(canvas, {}) !== false;
        } catch (err) {
          ok = false;
        }
      }
      if (!ok || prefersReduced()) {
        if (ok && typeof PeakScene.destroy === 'function') {
          try { PeakScene.destroy(); } catch (err) { /* decorative only */ }
        }
        document.body.classList.add('no-3d');
        return;
      }
      scene = PeakScene;
      sceneActive = true;
      document.body.classList.remove('no-3d');
      currentF = targetF = FORMATION_BY_SCREEN[cur] || 0;
      sceneCall('setFormation', currentF);
      sceneCall('setDim', 0.6);
      /* The funnel runs on the light ground like every other non-landing
         page, so the points composite as graphite on paper. Set once at
         boot: nothing scrubs --day here, unlike the landing page. */
      sceneCall('setDay', 1);
      sceneCall('setProgress', progressFor(cur));
      bindPointer();
      bindResize();
      startLoop();
    })
    .catch(() => {
      document.body.classList.add('no-3d');
    });
}

function onMotionChange() {
  if (prefersReduced()) {
    teardownScene();
  } else if (!sceneActive) {
    sceneBootTried = false;
    bootScene();
  }
}

/* ==================================================================== *
 * Screen engine
 * ==================================================================== */
function focusEl(el) {
  if (!el || typeof el.focus !== 'function') return;
  try {
    el.focus({ preventScroll: true });
  } catch (err) {
    el.focus();
  }
}

function focusScreen(section) {
  if (!section) return;
  const text = section.querySelector('input:not([type="radio"]):not([type="checkbox"])');
  if (text) { focusEl(text); return; }
  const choice =
    section.querySelector('input[type="radio"]:checked') ||
    section.querySelector('input[type="radio"], input[type="checkbox"]');
  if (choice) { focusEl(choice); return; }
  const heading = section.querySelector('[tabindex="-1"]');
  if (heading) { focusEl(heading); return; }
  focusEl(section.querySelector('.btn'));
}

function updateProgress(i) {
  const fill = $('progress-fill');
  const count = $('step-count');
  if (fill) {
    if (i <= 0) fill.style.width = '0%';
    else if (i >= DONE_INDEX) fill.style.width = '100%';
    else fill.style.width = (i / TOTAL_STEPS) * 100 + '%';
  }
  if (count) {
    if (i <= 0) count.textContent = '';
    else if (i >= DONE_INDEX) count.textContent = 'All done';
    else count.textContent = i + ' of ' + TOTAL_STEPS;
  }
}

function showScreen(i) {
  const old = document.querySelector('.audit-shell .screen:not([hidden])');
  if (old) old.hidden = true;
  cur = i;
  const section = $(SCREEN_IDS[i]);
  if (!section) return;
  section.hidden = false;
  section.classList.remove('in');
  void section.offsetWidth; /* restart the entrance animation */
  section.classList.add('in');
  const back = $('back-btn');
  if (back) back.hidden = i < 2 || i >= DONE_INDEX;
  updateProgress(i);
  targetF = FORMATION_BY_SCREEN[i];
  sceneCall('setProgress', progressFor(i));
  focusScreen(section);
}

/* ==================================================================== *
 * Validation
 * ==================================================================== */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validPhone(raw) {
  return /^\+?\d{7,15}$/.test((raw || '').replace(/[\s\-().]/g, ''));
}

/* Name and surname: two words at least. */
function validFullName(raw) {
  return (raw || '').trim().split(/\s+/).filter(Boolean).length >= 2;
}

function setError(step, msg) {
  const err = $(ERROR_IDS[step]);
  if (err) err.textContent = msg || '';
  const input = FIELD_IDS[step] ? $(FIELD_IDS[step]) : null;
  if (input) {
    if (msg) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }
}

function failField(step, msg) {
  setError(step, msg);
  const input = FIELD_IDS[step] ? $(FIELD_IDS[step]) : null;
  if (input) focusEl(input);
}

/* ==================================================================== *
 * The help question's boxes
 * ==================================================================== */
function helpBoxes() {
  return Array.prototype.slice.call(document.querySelectorAll('input[name="helpWith"]'));
}

function syncHelpAll(changed) {
  const boxes = helpBoxes();
  const all = boxes.find((b) => b.value === HELP_ALL);
  if (!all) return;
  const rest = boxes.filter((b) => b !== all);
  if (changed === all) rest.forEach((b) => { b.checked = all.checked; });
  else all.checked = rest.every((b) => b.checked);
}

/* ==================================================================== *
 * Where the visitor came from
 *
 * For the team's email, and for the booking's utm_campaign, which would
 * otherwise read "book-a-call" for every call booked. A page on this site
 * gives its path; anywhere else gives its host. Campaign params on this URL,
 * or on the page that sent the visitor here, travel with the lead, so an ad
 * that brought someone in stays the source of their booking.
 * ==================================================================== */
function utmFrom(params) {
  const found = {};
  if (!params) return found;
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) found[key] = value.slice(0, 120);
  }
  return found;
}

function captureOrigin() {
  const found = { path: '', host: '', utm: {} };
  let ref = null;
  try {
    ref = document.referrer ? new URL(document.referrer) : null;
  } catch (err) {
    ref = null;
  }
  if (ref && ref.origin === window.location.origin) {
    if (!FUNNEL_PATHS.test(ref.pathname)) found.path = ref.pathname.slice(0, 200);
    Object.assign(found.utm, utmFrom(ref.searchParams));
  } else if (ref) {
    found.host = ref.hostname;
  }
  try {
    Object.assign(found.utm, utmFrom(new URLSearchParams(window.location.search)));
  } catch (err) {
    /* no URLSearchParams: the referrer's params, if any, stand */
  }
  return found;
}

function originText() {
  let text = origin.path || origin.host || 'Direct (no referring page)';
  const utm = Object.keys(origin.utm).map((key) => key + '=' + origin.utm[key]);
  if (utm.length) text += ' | ' + utm.join(', ');
  return text;
}

/* ==================================================================== *
 * Lead storage: prefill as you go
 * ==================================================================== */
function storeLead() {
  try {
    localStorage.setItem(LEAD_KEY, JSON.stringify(answers));
  } catch (err) {
    /* storage unavailable - prefill is a nicety */
  }
}

function loadStoredLead() {
  try {
    const v = JSON.parse(localStorage.getItem(LEAD_KEY) || 'null');
    return v && typeof v === 'object' ? v : null;
  } catch (err) {
    return null;
  }
}

/* ==================================================================== *
 * Lead delivery
 * ==================================================================== */
function helpText() {
  return answers.helpWith.join(', ');
}

function rand(n) {
  return 'R' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* "25 minutes", "1 hour 5 minutes". Relative rather than a clock time, so
   it means the same in Bradley's inbox whatever the visitor's time zone. */
function agoText(ts) {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (!mins) return 'under a minute';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const parts = [];
  if (h) parts.push(h + (h === 1 ? ' hour' : ' hours'));
  if (m) parts.push(m + (m === 1 ? ' minute' : ' minutes'));
  return parts.join(' ');
}

/* For the team only. It goes in the email, never on the page and never in
   the visitor's own mailto fallback. */
function bookingNote(open, earlier) {
  if (open) return 'Qualified. Sent to the booking calendar.';
  if (earlier) {
    return (
      'Disqualified. This browser was turned away ' + agoText(earlier.ts) + ' earlier' +
      (earlier.revenue ? ' (answered "' + earlier.revenue + '")' : '') +
      ', so no call was offered, whatever it answered this time.'
    );
  }
  return 'Disqualified. Monthly revenue under ' + rand(BOOKING_MIN_REVENUE) + ', so no call was offered.';
}

function buildPayload(open, earlier) {
  return {
    name: answers.name,
    email: answers.email,
    phone: answers.phone,
    business: answers.business,
    helpWith: helpText(),
    monthlyRevenue: answers.revenue,
    booking: bookingNote(open, earlier),
    cameFrom: originText(),
    page: PAGE_URL,
    _subject: (open ? 'New free audit request: ' : 'New free audit request (disqualified): ') + answers.name
  };
}

/* The visitor's own copy, so nothing here may say how the audit was
   judged. */
function mailtoHref() {
  const lines = [
    'Name: ' + answers.name,
    'Email: ' + answers.email,
    'Phone: ' + answers.phone,
    'About the business: ' + answers.business,
    'Help with: ' + helpText(),
    'Monthly revenue: ' + answers.revenue
  ];
  return (
    'mailto:' + CONTACT_EMAIL +
    '?subject=' + encodeURIComponent('New free audit request: ' + (answers.name || 'my business')) +
    '&body=' + encodeURIComponent(lines.join('\r\n'))
  );
}

function showMailtoFallback() {
  /* The note is an always-present empty live region: injecting content
     (rather than un-hiding) is what makes screen readers announce it. */
  const note = $('send-fallback');
  if (!note) return;
  note.textContent = 'Your answers could not be sent automatically. ';
  const link = document.createElement('a');
  link.id = 'send-mailto';
  link.href = mailtoHref();
  link.textContent = 'Email them to us';
  note.appendChild(link);
  note.appendChild(document.createTextNode(' and we will take it from there.'));
}

/* ", Jane" after "Thanks" on both endings. */
function fillName() {
  const first = (answers.name || '').trim().split(/\s+/)[0] || '';
  document.querySelectorAll('[data-name-tail]').forEach((el) => {
    el.textContent = first ? ', ' + first : '';
  });
}

/* Onward to the calendar once the lead is acknowledged (or given up on:
   it is still queued, and /book-a-call/ flushes the queue) and the Lead
   event has had its chance to leave. */
function leaveForBooking(sent) {
  let settled = false;
  sent.then(
    () => { settled = true; },
    () => { settled = true; }
  );
  const start = Date.now();
  let pixelClearAt = pixelUp() ? start : 0;
  const status = $('next-status');
  const tick = () => {
    const now = Date.now();
    if (!pixelClearAt && pixelUp()) pixelClearAt = now + PIXEL_GRACE;
    const pixelDone = pixelBlocked() || (pixelClearAt && now >= pixelClearAt);
    const waited = now - start;
    if ((settled && pixelDone && waited >= SHOW_FOR) || waited >= LEAVE_BY) {
      if (status) status.textContent = 'Opening the calendar now.';
      window.location.assign(BOOKING_PAGE);
    } else {
      window.setTimeout(tick, 100);
    }
  };
  window.setTimeout(tick, 100);
}

function submitLead() {
  if (done) return;
  done = true;
  fillName();
  const hp = $('pl-extra');
  if (hp && hp.value) {
    /* Honeypot filled: a bot. It gets the ending that offers no call, and
       nothing is sent or stored. */
    showScreen(THANKS_INDEX);
    return;
  }

  const earlier = readHandoff();
  const turnedAway = !!(earlier && earlier.open === false && handoffWithin(earlier, DECLINE_HOLDS_FOR));
  /* A missing or unreadable floor counts as qualifying: a markup slip must
     never quietly close the calendar to everyone. */
  const qualifies = !(revenueFloor < BOOKING_MIN_REVENUE);
  const open = qualifies && !turnedAway;

  if (open) {
    writeHandoff({
      v: 1,
      ts: Date.now(),
      open: true,
      revenue: answers.revenue,
      name: answers.name,
      email: answers.email,
      from: origin.path,
      utm: origin.utm
    });
  } else if (!turnedAway) {
    /* A repeat visit keeps the first refusal's date and answer, so the
       window runs from the first answer and the email can quote it. */
    writeHandoff({ v: 1, ts: Date.now(), open: false, revenue: answers.revenue });
  }

  try {
    trackPixel('track', 'Lead');
  } catch (err) {
    /* pixel is optional */
  }

  const sent = sendLead(buildPayload(open, turnedAway ? earlier : null));

  if (open) {
    showScreen(NEXT_INDEX);
    pulseCondense();
    leaveForBooking(sent);
  } else {
    showScreen(THANKS_INDEX);
    sent.catch(showMailtoFallback);
  }
}

/* ==================================================================== *
 * Advance / back
 * ==================================================================== */
function advance() {
  if (done) return;
  switch (cur) {
    case 0: {
      showScreen(1);
      break;
    }
    case 1: {
      const v = $('f-name').value.trim().replace(/\s+/g, ' ');
      if (!validFullName(v)) { failField(1, 'Please enter your name and surname.'); return; }
      setError(1, '');
      answers.name = v;
      storeLead();
      showScreen(2);
      break;
    }
    case 2: {
      const v = $('f-email').value.trim();
      if (!EMAIL_RE.test(v)) { failField(2, 'Enter a valid email address, like name@company.com.'); return; }
      setError(2, '');
      answers.email = v;
      storeLead();
      showScreen(3);
      break;
    }
    case 3: {
      const v = $('f-phone').value.trim();
      if (!validPhone(v)) { failField(3, 'Enter a number we can reach you on. Digits only, with an optional leading +.'); return; }
      setError(3, '');
      answers.phone = v;
      storeLead();
      showScreen(4);
      break;
    }
    case 4: {
      const v = $('f-business').value.trim();
      if (v.length < 2) { failField(4, 'Please tell us your industry, and your website or social media link if you have one.'); return; }
      setError(4, '');
      answers.business = v;
      storeLead();
      showScreen(5);
      break;
    }
    case 5: {
      const picked = helpBoxes().filter((b) => b.checked).map((b) => b.value);
      if (!picked.length) { setError(5, 'Please choose at least one.'); focusScreen($(SCREEN_IDS[5])); return; }
      setError(5, '');
      answers.helpWith = picked.indexOf(HELP_ALL) !== -1 ? [HELP_ALL] : picked;
      storeLead();
      showScreen(6);
      break;
    }
    case 6: {
      const r = document.querySelector('input[name="revenue"]:checked');
      if (!r) { setError(6, 'Please choose an option.'); focusScreen($(SCREEN_IDS[6])); return; }
      setError(6, '');
      answers.revenue = r.value;
      revenueFloor = parseFloat(r.getAttribute('data-floor'));
      storeLead();
      submitLead();
      break;
    }
  }
}

function goBack() {
  if (done || cur < 2) return;
  setError(cur, '');
  showScreen(cur - 1);
}

/* ==================================================================== *
 * Prefill
 * ==================================================================== */
function checkRadio(name, value) {
  if (!value) return;
  const radios = document.querySelectorAll('input[name="' + name + '"]');
  for (const r of radios) {
    if (r.value === value) {
      r.checked = true;
      return;
    }
  }
}

function prefill() {
  const stored = loadStoredLead();
  if (!stored) return;
  const map = { name: 'f-name', email: 'f-email', phone: 'f-phone', business: 'f-business' };
  for (const key of Object.keys(map)) {
    const input = $(map[key]);
    if (input && typeof stored[key] === 'string') input.value = stored[key];
  }
  if (Array.isArray(stored.helpWith)) {
    const all = stored.helpWith.indexOf(HELP_ALL) !== -1;
    helpBoxes().forEach((b) => {
      b.checked = all || stored.helpWith.indexOf(b.value) !== -1;
    });
    syncHelpAll(null);
  }
  checkRadio('revenue', stored.revenue);
}

/* ==================================================================== *
 * Events + init
 * ==================================================================== */
function bindFunnelEvents() {
  document.querySelectorAll('[data-next]').forEach((btn) => {
    btn.addEventListener('click', advance);
  });

  const back = $('back-btn');
  if (back) back.addEventListener('click', goBack);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing || done) return;
    const t = event.target;
    if (t && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'TEXTAREA')) return;
    event.preventDefault();
    advance();
  });

  /* Clear inline errors as the visitor types or picks */
  for (const step of Object.keys(FIELD_IDS)) {
    const input = $(FIELD_IDS[step]);
    if (input) input.addEventListener('input', () => setError(Number(step), ''));
  }
  helpBoxes().forEach((box) => {
    box.addEventListener('change', () => {
      syncHelpAll(box);
      setError(5, '');
    });
  });
  document.querySelectorAll('input[name="revenue"]').forEach((r) => {
    r.addEventListener('change', () => setError(6, ''));
  });
}

function init() {
  origin = captureOrigin();
  prefill();
  updateProgress(0);
  bindFunnelEvents();
  flushOutbox();
  armPixel();

  /* Scene boots after first paint so the intro copy is the LCP */
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
  idle(() => bootScene());

  if (motionQuery) {
    if (typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', onMotionChange);
    } else if (typeof motionQuery.addListener === 'function') {
      motionQuery.addListener(onMotionChange);
    }
  }

  initMailLinks();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLoop();
    else startLoop();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
