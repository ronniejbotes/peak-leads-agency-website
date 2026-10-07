/*
 * Peak Leads - src/js/lead.js
 * Free-audit lead delivery, and the hand-off from the audit to the booking
 * page. Shared by audit.js (/free-audit/) and pages/booking.js
 * (/book-a-call/).
 *
 *   Delivery   A lead is queued in localStorage BEFORE it is sent and comes
 *              off the queue only when the endpoint acknowledges it, so a
 *              navigation mid-send, a dropped connection or a closed tab
 *              never loses one: the next page that calls flushOutbox()
 *              retries it, and both entries do. Worst case is a duplicate
 *              email, never a missing lead.
 *   Hand-off   What the audit decided, kept under pl_booking: whether the
 *              booking calendar is open to this browser, since when, and what
 *              the calendar is filled in with. The inline gate in
 *              book-a-call/index.html reads the same key and the same seven
 *              days without importing this file, so change the two together.
 */

/* Set LEAD_WEBHOOK to a JSON POST endpoint (Apps Script, Web3Forms, a
   worker) to take over lead delivery. While empty, leads POST to
   formsubmit.co and land in Bradley's inbox. */
const LEAD_WEBHOOK = '';
const FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/ajax/bradley@peakleads.agency';
const OUTBOX_KEY = 'pl_lead_outbox';
const HANDOFF_KEY = 'pl_booking';

const DAY = 24 * 60 * 60 * 1000;

/* How long a finished audit keeps /book-a-call/ open to its browser. */
export const BOOKING_OPEN_FOR = 7 * DAY;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ==================================================================== *
 * Outbox
 * ==================================================================== */
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

/* Queue, send, and try once more two seconds later. Resolves once the lead
   is acknowledged; rejects if both tries fail, leaving it queued for the
   next flushOutbox(). */
export function sendLead(payload) {
  const entry = { ts: Date.now(), payload };
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
}

/* ==================================================================== *
 * Hand-off
 *
 * { v: 1, ts, open, revenue, name?, email?, from?, utm? }
 *   ts       when the audit was sent (ms)
 *   open     true: /book-a-call/ is open to this browser
 *   revenue  the monthly revenue answer that decided it
 *   name, email, from, utm   only when open: the calendar's prefill, the
 *            path of the page that sent the visitor to the audit, and the
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
       store through, so a finished audit still reaches its calendar */
  }
}

/* Whether a hand-off record was written within the last `ms`. A clock that
   has gone backwards since does not count as recent. */
export function handoffWithin(record, ms) {
  if (!record) return false;
  const age = Date.now() - record.ts;
  return age >= 0 && age < ms;
}
