/*
 * Peak Leads - src/js/lead.js
 * Lead delivery for the booking questions, and the hand-off from the
 * questions to the calendar. Shared by audit.js (/book-a-call/) and
 * pages/booking.js (/book-a-call/pick-a-time/).
 *
 *   Delivery   A lead is queued in localStorage BEFORE it is sent and comes
 *              off the queue only when the endpoint acknowledges it, so a
 *              navigation mid-send, a dropped connection or a closed tab
 *              never loses one: the next page that calls flushOutbox()
 *              retries it, and both entries do. Worst case is a duplicate
 *              email, never a missing lead.
 *   HubSpot    Qualified answers also go to /api/hubspot-lead.php, which
 *              puts the contact in HubSpot and gives it an owner. They wait
 *              in a queue of their own, so a HubSpot outage can never push an
 *              email off the email queue, and nothing waits on them: the
 *              visitor moves on as soon as the email is acknowledged.
 *   Hand-off   What the answers decided, kept under pl_booking: whether the
 *              booking calendar is open to this browser, since when, and what
 *              the calendar is filled in with. The inline gate in
 *              book-a-call/pick-a-time/index.html reads the same key and the same seven
 *              days without importing this file, so change the two together.
 */

/* Set LEAD_WEBHOOK to a JSON POST endpoint (Apps Script, Web3Forms, a
   worker) to take over lead delivery. While empty, leads POST to
   formsubmit.co and land in Bradley's inbox. */
const LEAD_WEBHOOK = '';
const FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/ajax/bradley@peakleads.agency';
const OUTBOX_KEY = 'pl_lead_outbox';
const CRM_ENDPOINT = '/api/hubspot-lead.php';
const CRM_OUTBOX_KEY = 'pl_crm_outbox';
const HANDOFF_KEY = 'pl_booking';

const DAY = 24 * 60 * 60 * 1000;

/* How long finished answers keep /book-a-call/pick-a-time/ open to their
   browser. */
export const BOOKING_OPEN_FOR = 7 * DAY;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ==================================================================== *
 * Outbox
 * ==================================================================== */
function readOutbox(key = OUTBOX_KEY) {
  try {
    const box = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(box) ? box : [];
  } catch (err) {
    return [];
  }
}

function writeOutbox(box, key = OUTBOX_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(box));
  } catch (err) {
    /* storage unavailable */
  }
}

function pushOutbox(entry, key = OUTBOX_KEY) {
  const box = readOutbox(key);
  box.push(entry);
  while (box.length > 20) box.shift();
  writeOutbox(box, key);
}

function removeFromOutbox(entry, key = OUTBOX_KEY) {
  writeOutbox(readOutbox(key).filter((e) => !(e && e.ts === entry.ts)), key);
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

/* A 4xx means the endpoint read the lead and will never take it (a bad
   email, say): it comes off the queue like a success. Anything else (5xx,
   not configured yet, offline, the dev server's missing PHP) leaves it
   queued for the next flushOutbox(). */
function deliverCrm(entry) {
  return fetch(CRM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...entry.payload, leadId: String(entry.ts) }),
    keepalive: true
  }).then((res) => {
    const refused = res.status >= 400 && res.status < 500 && ![404, 408, 429].includes(res.status);
    if (!res.ok && !refused) throw new Error('HTTP ' + res.status);
  });
}

function sendCrm(entry) {
  deliverCrm(entry)
    .then(() => removeFromOutbox(entry, CRM_OUTBOX_KEY))
    .catch(() => {
      /* stays queued for the next visit */
    });
}

/* Queue, send, and try once more two seconds later. Resolves once the lead
   is acknowledged; rejects if both tries fail, leaving it queued for the
   next flushOutbox(). { crm: true } also hands the lead to HubSpot, on its
   own queue; the promise does not wait for it. */
export function sendLead(payload, options) {
  const entry = { ts: Date.now(), payload };
  if (options && options.crm) {
    pushOutbox(entry, CRM_OUTBOX_KEY);
    sendCrm(entry);
  }
  pushOutbox(entry);
  return deliver(payload)
    .catch(() => sleep(2000).then(() => deliver(payload)))
    .then(() => removeFromOutbox(entry));
}

export function flushOutbox() {
  const box = readOutbox().filter((e) => e && e.payload);
  writeOutbox(box);
  for (const entry of box) {
    deliver(entry.payload)
      .then(() => removeFromOutbox(entry))
      .catch(() => {
        /* stays queued for the next visit */
      });
  }
  const crm = readOutbox(CRM_OUTBOX_KEY).filter((e) => e && e.payload);
  writeOutbox(crm, CRM_OUTBOX_KEY);
  crm.forEach(sendCrm);
}

/* ==================================================================== *
 * Hand-off
 *
 * { v: 1, ts, open, revenue, name?, email?, from?, utm? }
 *   ts       when the answers were sent (ms)
 *   open     true: /book-a-call/pick-a-time/ is open to this browser
 *   revenue  the monthly revenue answer that decided it
 *   name, email, from, utm   only when open: the calendar's prefill, the
 *            path of the page that sent the visitor to the questions, and the
 *            campaign params they arrived with
 * ==================================================================== */
export function readHandoff() {
  try {
    const record = JSON.parse(localStorage.getItem(HANDOFF_KEY) || 'null');
    return record && typeof record === 'object' && typeof record.ts === 'number' ? record : null;
  } catch (err) {
    return null;
  }
}

export function writeHandoff(record) {
  try {
    localStorage.setItem(HANDOFF_KEY, JSON.stringify(record));
  } catch (err) {
    /* storage unavailable: the booking page's gate lets an unreadable
       store through, so finished answers still reach their calendar */
  }
}

/* Whether a hand-off record was written within the last `ms`. A clock that
   has gone backwards since does not count as recent. */
export function handoffWithin(record, ms) {
  if (!record) return false;
  const age = Date.now() - record.ts;
  return age >= 0 && age < ms;
}
