/*
 * Peak Leads - src/js/email.js
 * Email links that never put an address in the page HTML. Shared by every
 * entry: main.js, pages/subpage.js (which pages/pricing.js imports) and
 * audit.js.
 *
 * Markup, wherever the address appears, link or plain text:
 *
 *   <a href="/contact/" data-mail="bradley">bradley<span class="mail-at"></span>peakleads.agency</a>
 *
 * CSS paints the "@" (.mail-at::before), so the link reads, and is announced
 * by screen readers, as the full address, while anything harvesting the raw
 * HTML finds no address to collect. With JS off it still goes somewhere
 * useful: the contact page. data-mail-domain overrides peakleads.agency.
 *
 * initMailLinks() arms a link the first time a person reaches it: pointer
 * over, pointer or finger down, keyboard focus, or a click that arrives with
 * none of those first (a screen reader in browse mode can click without
 * moving focus). Arming points the href at the real mailto and swaps the
 * painted "@" for a real one, so hover, click, middle-click, "copy link"
 * and plain copy/paste all get the address. A copy of a selection that
 * takes in a link nobody hovered arms it just before the copy happens.
 *
 * Nothing in the DOM changes until then, so the page a crawler renders
 * matches the page the server sent.
 */

const DEFAULT_DOMAIN = 'peakleads.agency';
const ARM_ON = ['pointerover', 'pointerdown', 'touchstart', 'focusin', 'click'];

let bound = false;
const armed = typeof window.WeakSet === 'function' ? new window.WeakSet() : null;

function arm(link) {
  if (armed) {
    if (armed.has(link)) return;
    armed.add(link);
  }
  const user = link.getAttribute('data-mail');
  if (!user) return;
  const address = user + '@' + (link.getAttribute('data-mail-domain') || DEFAULT_DOMAIN);
  link.setAttribute('href', 'mailto:' + address);
  /* A real "@" in place of the painted one, so a copied selection carries
     it. Same glyph, same metrics: nothing visibly moves. */
  const marks = link.querySelectorAll('.mail-at');
  for (let i = 0; i < marks.length; i++) {
    marks[i].parentNode.replaceChild(document.createTextNode('@'), marks[i]);
  }
}

function onReach(event) {
  const target = event.target;
  const link =
    target && typeof target.closest === 'function' ? target.closest('a[data-mail]') : null;
  if (link) arm(link);
}

/* The copy event fires before the selection is serialised, so arming here
   still lands in the clipboard. */
function onCopy() {
  const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
  if (!selection || selection.isCollapsed || typeof selection.containsNode !== 'function') {
    return;
  }
  const links = document.querySelectorAll('a[data-mail]');
  for (let i = 0; i < links.length; i++) {
    if (selection.containsNode(links[i], true)) arm(links[i]);
  }
}

export function initMailLinks() {
  if (bound) return;
  bound = true;
  /* Delegated, so links added later are covered too. Capture, so a handler
     further down that stops propagation cannot leave a link unarmed. */
  const opts = { capture: true, passive: true };
  ARM_ON.forEach((type) => document.addEventListener(type, onReach, opts));
  document.addEventListener('copy', onCopy, opts);
}
