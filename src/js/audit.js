/*
 * Peak Leads - audit.js
 * Entry for /free-audit/: the eight step audit funnel plus its own particle
 * scene boot. No GSAP here - formation morphs run on a tiny rAF lerp so the
 * funnel stays light. Every scene call is guarded; any boot failure or
 * prefers-reduced-motion adds body.no-3d and the page runs on the static
 * gradient fallback.
 */
import '../styles/main.css';
import { armPixel, trackPixel } from './pixel.js';
import { initBookSection } from './book.js';

/* ==================================================================== *
 * Config
 * ==================================================================== */
/* Set LEAD_WEBHOOK to a JSON POST endpoint (Apps Script, Web3Forms, a
   worker) to take over lead delivery. While empty, leads POST to
   formsubmit.co and land in Bradley's inbox. */
const LEAD_WEBHOOK = '';
const FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/ajax/bradley@peakleads.agency';
const CONTACT_EMAIL = 'bradley@peakleads.agency';
const LEAD_KEY = 'pl_lead';
const OUTBOX_KEY = 'pl_lead_outbox';
const PAGE_URL = 'https://peakleads.agency/free-audit/';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  'screen-1', 'screen-2', 'screen-3', 'screen-4',
  'screen-5', 'screen-6', 'screen-7', 'screen-8',
  'screen-thanks'
];
const THANKS_INDEX = SCREEN_IDS.length - 1;
const TOTAL_STEPS = 8;

/* intro = 0 (PEAK); steps 1-8 walk the seven formations (PEAK, PLAY,
   FRAME, RANKS, FUNNEL, GROWTH, SPHERE); the thanks screen returns to
   the PEAK to match "You're on the way up." */
const FORMATION_BY_SCREEN = [0, 0, 1, 2, 3, 4, 5, 6, 2, 0];

const FIELD_IDS = { 1: 'f-name', 2: 'f-email', 3: 'f-phone', 4: 'f-business', 5: 'f-trade', 8: 'f-website' };
const ERROR_IDS = { 1: 'err-name', 2: 'err-email', 3: 'err-phone', 4: 'err-business', 5: 'err-trade', 6: 'err-service', 7: 'err-spend', 8: 'err-website' };

const answers = { name: '', email: '', phone: '', business: '', trade: '', service: '', adSpend: '', website: '' };
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

/* Condense pulse for the thanks screen: gather in, small bang, settle. */
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
  return THANKS_INDEX ? i / THANKS_INDEX : 0;
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
  const text = section.querySelector('input:not([type="radio"])');
  if (text) { focusEl(text); return; }
  const radio =
    section.querySelector('input[type="radio"]:checked') ||
    section.querySelector('input[type="radio"]');
  if (radio) { focusEl(radio); return; }
  const heading = section.querySelector('[tabindex="-1"]');
  if (heading) { focusEl(heading); return; }
  focusEl(section.querySelector('.btn'));
}

function updateProgress(i) {
  const fill = $('progress-fill');
  const count = $('step-count');
  if (fill) {
    if (i <= 0) fill.style.width = '0%';
    else if (i >= THANKS_INDEX) fill.style.width = '100%';
    else fill.style.width = (i / TOTAL_STEPS) * 100 + '%';
  }
  if (count) {
    if (i <= 0) count.textContent = '';
    else if (i >= THANKS_INDEX) count.textContent = 'All done';
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
  if (back) back.hidden = i < 2 || i >= THANKS_INDEX;
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

function normalizeWebsite(raw) {
  let s = (raw || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try {
    u = new URL(s);
  } catch (err) {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (!u.hostname || u.hostname.indexOf('.') === -1) return null;
  return u.href;
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
 * Lead storage: prefill + outbox retry queue
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

function readOutbox() {
  try {
    const box = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
    return Array.isArray(box) ? box : [];
  } catch (err) {
    return [];
  }
}

function writeOutbox(box) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(box));
  } catch (err) {
    /* storage unavailable */
  }
}

function pushOutbox(entry) {
  const box = readOutbox();
  box.push(entry);
  while (box.length > 20) box.shift();
  writeOutbox(box);
}

function removeFromOutbox(entry) {
  writeOutbox(readOutbox().filter((e) => !(e && e.ts === entry.ts)));
}

function flushOutbox() {
  const box = readOutbox().filter((e) => e && e.payload);
  writeOutbox(box);
  for (const entry of box) {
    deliver(entry.payload)
      .then(() => removeFromOutbox(entry))
      .catch(() => {
        /* stays queued for the next visit */
      });
  }
}

/* ==================================================================== *
 * Lead delivery
 * ==================================================================== */
function buildPayload() {
  return {
    name: answers.name,
    email: answers.email,
    phone: answers.phone,
    business: answers.business,
    trade: answers.trade,
    service: answers.service,
    adSpend: answers.adSpend,
    website: answers.website,
    page: PAGE_URL,
    _subject: 'New free audit request: ' + (answers.business || 'unknown business')
  };
}

function deliver(payload) {
  const endpoint = LEAD_WEBHOOK || FORMSUBMIT_ENDPOINT;
  return fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true
  }).then((res) => {
    if (!res.ok) throw new Error('HTTP ' + res.status);
  });
}

function mailtoHref() {
  const lines = [
    'Name: ' + answers.name,
    'Email: ' + answers.email,
    'Phone: ' + answers.phone,
    'Business: ' + answers.business,
    'Trade: ' + answers.trade,
    'Service: ' + answers.service,
    'Monthly ad spend: ' + answers.adSpend,
    'Website: ' + answers.website
  ];
  return (
    'mailto:' + CONTACT_EMAIL +
    '?subject=' + encodeURIComponent('New free audit request: ' + (answers.business || 'my business')) +
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

function submitLead() {
  if (done) return;
  done = true;
  showScreen(THANKS_INDEX);
  pulseCondense();
  const hp = $('pl-extra');
  if (hp && hp.value) return; /* honeypot filled - show thanks, send nothing */
  try {
    trackPixel('track', 'Lead');
  } catch (err) {
    /* pixel is optional */
  }
  /* Queue first, remove on ack - a navigation mid-send must never lose
     the lead. Worst case is a duplicate on the next visit's flush. */
  const entry = { ts: Date.now(), payload: buildPayload() };
  pushOutbox(entry);
  deliver(entry.payload)
    .then(() => removeFromOutbox(entry))
    .catch(async () => {
      await sleep(2000);
      try {
        await deliver(entry.payload);
        removeFromOutbox(entry);
      } catch (err) {
        showMailtoFallback();
      }
    });
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
      const v = $('f-name').value.trim();
      if (v.length < 2) { failField(1, 'Please enter your name.'); return; }
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
      if (v.length < 2) { failField(4, 'Please enter your business name.'); return; }
      setError(4, '');
      answers.business = v;
      storeLead();
      showScreen(5);
      break;
    }
    case 5: {
      const v = $('f-trade').value.trim();
      if (v.length < 2) { failField(5, 'Please tell us your trade. Pick one from the list or type your own.'); return; }
      setError(5, '');
      answers.trade = v;
      storeLead();
      showScreen(6);
      break;
    }
    case 6: {
      const r = document.querySelector('input[name="service"]:checked');
      if (!r) { setError(6, 'Please choose a service.'); focusScreen($(SCREEN_IDS[6])); return; }
      setError(6, '');
      answers.service = r.value;
      storeLead();
      showScreen(7);
      break;
    }
    case 7: {
      const r = document.querySelector('input[name="adSpend"]:checked');
      if (!r) { setError(7, 'Please choose an option.'); focusScreen($(SCREEN_IDS[7])); return; }
      setError(7, '');
      answers.adSpend = r.value;
      storeLead();
      showScreen(8);
      break;
    }
    case 8: {
      const site = normalizeWebsite($('f-website').value);
      if (!site) { failField(8, 'That does not look like a website address. Try something like yourbusiness.com'); return; }
      setError(8, '');
      answers.website = site;
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
  const map = { name: 'f-name', email: 'f-email', phone: 'f-phone', business: 'f-business', trade: 'f-trade' };
  for (const key of Object.keys(map)) {
    const input = $(map[key]);
    if (input && typeof stored[key] === 'string') input.value = stored[key];
  }
  checkRadio('service', stored.service);
  checkRadio('adSpend', stored.adSpend);
  if (typeof stored.website === 'string' && stored.website && stored.website !== 'No website yet') {
    const input = $('f-website');
    if (input) input.value = stored.website;
  }
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

  const noSite = $('no-site-btn');
  if (noSite) {
    noSite.addEventListener('click', () => {
      if (done) return;
      setError(8, '');
      answers.website = 'No website yet';
      storeLead();
      submitLead();
    });
  }

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
  document.querySelectorAll('input[name="service"]').forEach((r) => {
    r.addEventListener('change', () => setError(6, ''));
  });
  document.querySelectorAll('input[name="adSpend"]').forEach((r) => {
    r.addEventListener('change', () => setError(7, ''));
  });
}

function init() {
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

  initBookSection();

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
