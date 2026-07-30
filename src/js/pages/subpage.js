/*
 * Peak Leads - src/js/pages/subpage.js
 * Static-page entry (about, services, contact, blog, posts, 404).
 * Styles + nav burger + footer year only. No Three.js, no GSAP.
 */
import '../../styles/main.css';

/* Nav burger (<900px dropdown). State lives on aria-expanded plus a
   data-open attribute on .site-nav for CSS to target. */
function initNav() {
  const nav = document.querySelector('.site-nav');
  const burger = document.querySelector('.nav-burger');
  const links = document.querySelector('.nav-links');
  if (!nav || !burger || !links) return;

  function isOpen() {
    return burger.getAttribute('aria-expanded') === 'true';
  }

  function setOpen(open) {
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      nav.setAttribute('data-open', '');
    } else {
      nav.removeAttribute('data-open');
    }
  }

  setOpen(isOpen());

  burger.addEventListener('click', () => setOpen(!isOpen()));

  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Escape' || event.key === 'Esc') && isOpen()) {
      setOpen(false);
      burger.focus();
    }
  });

  links.addEventListener('click', (event) => {
    const target = event.target;
    const link =
      target && typeof target.closest === 'function' ? target.closest('a') : null;
    if (link && isOpen()) setOpen(false);
  });
}

/* Footer year. */
function initYear() {
  const year = String(new Date().getFullYear());
  const el = document.querySelector('[data-year], #year');
  if (el) {
    el.textContent = year;
    return;
  }
  const footer = document.querySelector('.site-footer');
  if (!footer || typeof document.createTreeWalker !== 'function' || !window.NodeFilter) {
    return;
  }
  const walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    if (/\b20\d{2}\b/.test(node.nodeValue || '')) {
      node.nodeValue = node.nodeValue.replace(/\b20\d{2}\b/, year);
      return;
    }
  }
}

function init() {
  initNav();
  initYear();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
