/*
 * Peak Leads - src/js/cylinder.js
 * #work "Recent work": the flat conveyor strip upgraded in place into a
 * vertical 3D card cylinder.
 *
 * Contract (DESIGN.md sections 6 + 7):
 * - Progressive enhancement over the markup that is already in index.html.
 *   Every node the no-JS fallback needs (<a>, <img>, <figcaption>) is MOVED,
 *   never cloned, so the accessible copy stays single-sourced: the <a> becomes
 *   the card's front face, the <figcaption> becomes its back face.
 * - Never runs under prefers-reduced-motion - the scroll-snap strip stays.
 * - Independent of the WebGL gate. A machine that fails scene.init() still
 *   gets the cylinder; these are plain CSS 3D transforms.
 * - rAF is parked whenever #work is off screen or the tab is hidden.
 * - Hot path writes transform/opacity/zIndex only. Every measurement is
 *   cached in measure(), which runs on resize, never per frame.
 * - Cards are transform-animated, so their surfaces stay SOLID: no
 *   backdrop-filter anywhere in here.
 */

/* Must match the `perspective` on .conveyor.is-3d in main.css. */
const PERSPECTIVE = 1350;

/* Progress is measured in cards: 1.0 = one card advanced. */
const DRIFT_PER_FRAME = 0.0016; /* at 60fps; dt-normalised below */
const SCROLL_TO_PROGRESS = 0.0024; /* per px of page scroll */

/* The magnetic step. Progress runs linearly but the card positions are read
   off this curve, which parks a card dead center for most of the cycle and
   then flicks to the next one - the dwell is what makes it feel deliberate
   rather than like a spinning wheel.

   The dwell is right for the idle drift and WRONG for direct input: it flattens
   small deltas almost to nothing (0.18 of a card in maps to 0.007 of a card of
   movement), so scrolling reads as if the cards are stuck. So `manual` blends
   the curve out - toward a linear 1:1 response - whenever the visitor is
   actually driving, and eases it back in when they stop, which doubles as the
   snap onto the nearest card. */
const MAGNET_POWER = 4.2;
const MANUAL_ATTACK = 0.25; /* how fast input takes over from the magnet */
const MANUAL_RELEASE = 0.022; /* how slowly it hands back + snaps */
const TARGET_DAMP = 0.14; /* glide rate when rotating to a clicked card */

const MOUSE_DAMP = 0.08; /* pointer inertia; lower = laggier follow */
const HOVER_DAMP = 0.055; /* how fast the drift stalls under the cursor */
const MAX_TILT_X = 12; /* deg, cursor up/down */
const MAX_TILT_Y = 15; /* deg, cursor left/right */
const CARD_TILT_Z = -3; /* deg, the constant jaunty roll */

const CARD_RATIO = 16 / 9; /* website screenshots, not credit cards */

/* Keyframes the cards interpolate between, in card-offset order:
   0 = dead center, 1 = the neighbour above/below, 2 = clipped by the stage
   edge, 3 = fully gone. z is absolute px against PERSPECTIVE, so the scale
   factors (1.42x center, 1.19x neighbour) hold at every card size. */
const Z_CENTER = 400;
const Z_NEAR = 220;
const Z_EDGE = -60;
const Z_GONE = -250;
const ROT_NEAR = 132; /* deg - far enough over to show the back face */
const ROT_EDGE = 175;
const ROT_GONE = 195;

/* Fractions of card height, so the whole rig scales with the viewport. */
const GAP_RATIO = 0.17; /* clear space between center and neighbour */
const PEEK_RATIO = 0.26; /* how far past the stage edge card 2 is pushed */
const CARD_H_TO_STAGE = 0.25; /* tallest card that still leaves room for 5 */
const CARD_W_TO_STAGE = 0.86; /* center card may span this much of the stage */

/* Half-thicknesses of the volumetric slices, in px. The front and back faces
   sit on the outer pair; the inner ones are the extruded card edge. */
const SLICE = 1.47;
const EDGE_SLICES_WIDE = [-0.5, 0, 0.5];
const EDGE_SLICES_NARROW = [0]; /* phones get one - it reads the same */

const clamp = (min, max, v) => (v < min ? min : v > max ? max : v);
const smoothstep = (t) => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;

/**
 * Upgrade #work's conveyor into the 3D cylinder.
 * @returns {(() => void)|null} teardown, or null if the strip was left alone.
 */
export function initWorkCylinder() {
  const stage = document.querySelector('.conveyor[data-cylinder]');
  const track = stage ? stage.querySelector('.conveyor-track') : null;
  if (!stage || !track) return null;

  const cards = Array.prototype.slice.call(
    track.querySelectorAll('.work-card')
  );
  /* Under four cards the ring is too short to hide its own seam. */
  if (cards.length < 4) return null;

  const count = cards.length;
  const half = count / 2;
  /* Cards dissolve over the last half-step before the seam, so the wrap is
     never witnessed - at five cards that band is already off stage, at four
     it becomes a visible (but graceful) fade. */
  const fadeFrom = half - 0.5;

  const narrow =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 640px)').matches;
  const edgeSlices = narrow ? EDGE_SLICES_NARROW : EDGE_SLICES_WIDE;

  /* ------------------------------------------------------------------
   * Build. Each figure becomes one 3D card:
   *   <figure.work-card>            <- the transformed node
   *     <a.wc-face.wc-front>        <- moved, keeps the real link + img
   *     <i.wc-edge> x N             <- injected, the extruded edge
   *     <figcaption.wc-face.wc-back><- moved, flipped 180deg
   * figcaption stays the last child of figure, so the markup stays valid.
   * ------------------------------------------------------------------ */
  const built = [];

  cards.forEach((card) => {
    const link = card.querySelector('a');
    const img = card.querySelector('img');
    const caption = card.querySelector('figcaption');
    if (!link || !img || !caption) return;

    const name = caption.querySelector('strong');
    const tag = caption.querySelector('span');
    const label = name ? name.textContent.trim() : '';
    const trade = tag ? tag.textContent.trim() : '';

    let domain = '';
    try {
      domain = new URL(link.href).hostname.replace(/^www\./, '');
    } catch (err) {
      domain = '';
    }

    link.classList.add('wc-face', 'wc-front');

    /* Browser chrome, so a screenshot reads as a shipped site rather than a
       stray image. Decorative: the domain is already in the link target. */
    const chrome = document.createElement('span');
    chrome.className = 'wc-chrome';
    chrome.setAttribute('aria-hidden', 'true');
    chrome.innerHTML =
      '<span class="wc-dots"></span><span class="wc-url"></span>';
    chrome.querySelector('.wc-url').textContent = domain;
    link.insertBefore(chrome, link.firstChild);

    /* Visible duplicate of the caption - hidden from AT, which reads the
       real <figcaption> on the back face instead. */
    const plate = document.createElement('span');
    plate.className = 'wc-plate';
    plate.setAttribute('aria-hidden', 'true');
    plate.innerHTML =
      '<span class="wc-plate-name"></span><span class="wc-plate-tag"></span>';
    plate.querySelector('.wc-plate-name').textContent = label;
    plate.querySelector('.wc-plate-tag').textContent = trade;
    link.appendChild(plate);

    caption.classList.add('wc-face', 'wc-back');
    /* The back face reuses the already-decoded screenshot as a blurred
       ground; ::before owns the filter so the text stays sharp. */
    caption.style.setProperty(
      '--wc-shot',
      'url("' + (img.currentSrc || img.src) + '")'
    );

    const stripe = document.createElement('span');
    stripe.className = 'wc-stripe';
    stripe.setAttribute('aria-hidden', 'true');
    caption.insertBefore(stripe, caption.firstChild);

    const meta = document.createElement('span');
    meta.className = 'wc-meta';
    meta.setAttribute('aria-hidden', 'true');
    meta.textContent = domain;
    caption.appendChild(meta);

    /* Edge slices go between the two faces, keeping figcaption last. */
    edgeSlices.forEach((s) => {
      const edge = document.createElement('i');
      edge.className = 'wc-edge';
      edge.setAttribute('aria-hidden', 'true');
      edge.style.transform = 'translateZ(' + (s * SLICE).toFixed(2) + 'px)';
      card.insertBefore(edge, caption);
    });

    built.push({ el: card, link, clickable: false, reachable: true });
  });

  if (built.length < 4) return null;

  stage.classList.add('is-3d');
  track.classList.add('is-3d');
  /* No longer a scrollable region, so it should not be a tab stop. */
  stage.removeAttribute('tabindex');
  stage.removeAttribute('role');
  stage.setAttribute('aria-label', 'Recent client websites');

  /* ------------------------------------------------------------------
   * Measure. Everything the frame loop needs, cached.
   * ------------------------------------------------------------------ */
  const dims = { cardH: 160, halfH: 300, gap: 27, peek: 42, yEdge: 0, yGone: 0 };

  function measure() {
    const rect = stage.getBoundingClientRect();
    const stageW = rect.width || 1;
    const stageH = rect.height || 1;

    const byHeight = stageH * CARD_H_TO_STAGE * CARD_RATIO;
    /* 1.42 = the center card's perspective scale at Z_CENTER. */
    const byWidth = (stageW * CARD_W_TO_STAGE) / (PERSPECTIVE / (PERSPECTIVE - Z_CENTER));
    const cardW = Math.round(clamp(180, 430, Math.min(byHeight, byWidth)));
    const cardH = Math.round(cardW / CARD_RATIO);

    track.style.width = cardW + 'px';
    track.style.height = cardH + 'px';
    /* Card furniture sizes itself off this, so type scales with the ring
       instead of needing its own breakpoints. */
    track.style.setProperty('--wc-h', cardH + 'px');

    dims.cardH = cardH;
    dims.halfH = stageH / 2;
    dims.gap = cardH * GAP_RATIO;
    dims.peek = cardH * PEEK_RATIO;

    /* Perspective-aware edge alignment: solve for the translateY that puts
       the card's far edge exactly `peek` px beyond the stage boundary once
       the projection at that depth is accounted for. */
    const sEdge = PERSPECTIVE / (PERSPECTIVE - Z_EDGE);
    dims.yEdge = (dims.halfH + dims.peek) / sEdge - cardH / 2;
    const sGone = PERSPECTIVE / (PERSPECTIVE - Z_GONE);
    dims.yGone = (dims.halfH + cardH) / sGone + cardH / 2;
  }

  /* ------------------------------------------------------------------
   * Input: pointer parallax, hover stall, page-scroll nudge, focus.
   * ------------------------------------------------------------------ */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const hover = { now: 1, target: 1 }; /* 1 = drifting, 0 = stalled */
  const manual = { now: 0 }; /* 0 = magnetic dwell, 1 = linear 1:1 */
  let progress = 0;
  let target = null; /* set while gliding to a clicked/focused card */
  let lastScrollY = window.scrollY || window.pageYOffset || 0;
  let lastTime = 0;
  let onScreen = false;
  let rafId = 0;

  /* Shortest way round the ring to `index`, so a card two slots back never
     takes the long way through the other three. */
  function goTo(index) {
    let delta = index - progress;
    while (delta > half) delta -= count;
    while (delta < -half) delta += count;
    target = progress + delta;
  }

  function indexOfCard(el) {
    for (let i = 0; i < built.length; i++) if (built[i].el === el) return i;
    return -1;
  }

  function onPointerMove(e) {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    mouse.tx = clamp(-1, 1, (e.clientX - w / 2) / (w / 2));
    mouse.ty = clamp(-1, 1, (e.clientY - h / 2) / (h / 2));
  }

  function onPointerLeave() {
    mouse.tx = 0;
    mouse.ty = 0;
  }

  /* Stall under the cursor: the cards are links, and you cannot click a
     moving target. */
  function onEnter() {
    hover.target = 0;
  }
  function onLeave() {
    hover.target = 1;
  }

  /* Keyboard tabbing into an off-center card turns the ring to it, so focus
     is never parked on something the eye cannot find. */
  function onFocusIn(e) {
    const card = e.target && e.target.closest ? e.target.closest('.work-card') : null;
    if (!card) return;
    const idx = indexOfCard(card);
    if (idx < 0) return;
    goTo(idx);
    hover.target = 0;
  }

  function onFocusOut() {
    hover.target = 1;
  }

  /* Click an off-center card to bring it to the front; click the front card
     to open the site. The front card's <a> is the only one left clickable,
     so a first click on any other card lands here and never navigates -
     which is also what stops a mis-aimed click on a card that is halfway
     through its flip from opening the wrong client's site.
     Keyboard is deliberately NOT two-step: Enter on a focused link navigates
     straight away, since focusin has already turned the ring to it. */
  function onClick(e) {
    const node = e.target && e.target.closest ? e.target.closest('.work-card') : null;
    if (!node) return;
    const idx = indexOfCard(node);
    if (idx < 0 || built[idx].clickable) return; /* front card: let it through */
    e.preventDefault();
    goTo(idx);
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('mouseleave', onPointerLeave);
  stage.addEventListener('pointerenter', onEnter);
  stage.addEventListener('pointerleave', onLeave);
  stage.addEventListener('focusin', onFocusIn);
  stage.addEventListener('focusout', onFocusOut);
  stage.addEventListener('click', onClick);

  /* ------------------------------------------------------------------
   * Frame loop.
   * ------------------------------------------------------------------ */
  function frame(now) {
    rafId = window.requestAnimationFrame(frame);

    /* dt-normalised so a 120Hz panel does not run the ring twice as fast. */
    const dt = lastTime ? clamp(0.2, 3, (now - lastTime) / 16.667) : 1;
    lastTime = now;

    /* Scroll nudge: reading scrollY is cheap and never forces layout. */
    const y = window.scrollY || window.pageYOffset || 0;
    const dy = y - lastScrollY;
    lastScrollY = y;

    hover.now += (hover.target - hover.now) * HOVER_DAMP * dt;
    mouse.x += (mouse.tx - mouse.x) * MOUSE_DAMP * dt;
    mouse.y += (mouse.ty - mouse.y) * MOUSE_DAMP * dt;

    /* Scrolling always wins: it cancels a click glide rather than fighting it. */
    if (dy !== 0) target = null;

    let driven = dy !== 0;
    if (target !== null) {
      const remaining = target - progress;
      if (Math.abs(remaining) < 0.003) {
        progress = target;
        target = null;
      } else {
        progress += remaining * TARGET_DAMP * dt;
        driven = true;
      }
    } else {
      progress += DRIFT_PER_FRAME * dt * hover.now + dy * SCROLL_TO_PROGRESS;
    }

    /* Ramp the magnet out while the visitor drives, back in when they stop. */
    const attack = driven ? MANUAL_ATTACK : MANUAL_RELEASE;
    manual.now += ((driven ? 1 : 0) - manual.now) * attack * dt;

    /* Keep progress bounded so precision never drifts on a long session.
       The pending target rides along, otherwise it would aim a full ring away. */
    if (progress > count) {
      progress -= count;
      if (target !== null) target -= count;
    } else if (progress < -count) {
      progress += count;
      if (target !== null) target += count;
    }

    const rounded = Math.round(progress);
    const diff = progress - rounded; /* [-0.5, 0.5] */
    const eased =
      (Math.sign(diff) * Math.pow(Math.abs(diff) * 2, MAGNET_POWER)) / 2;
    const active = rounded + mix(eased, diff, manual.now);

    const { cardH, halfH, gap, yEdge, yGone } = dims;

    for (let i = 0; i < built.length; i++) {
      const item = built[i];
      const el = item.el;

      let offset = i - active;
      while (offset > half) offset -= count;
      while (offset < -half) offset += count;

      const abs = Math.abs(offset);
      const sign = Math.sign(offset);

      if (abs > half - 0.001) {
        if (el.style.visibility !== 'hidden') el.style.visibility = 'hidden';
        continue;
      }
      if (el.style.visibility === 'hidden') el.style.visibility = '';

      let dist;
      let z;
      let rot;

      if (abs <= 1) {
        const e = smoothstep(abs);
        dist = e * (cardH + gap);
        z = mix(Z_CENTER, Z_NEAR, e);
        rot = e * ROT_NEAR;
      } else if (abs <= 2) {
        const e = smoothstep(abs - 1);
        dist = mix(cardH + gap, yEdge, e);
        z = mix(Z_NEAR, Z_EDGE, e);
        rot = mix(ROT_NEAR, ROT_EDGE, e);
      } else {
        const e = smoothstep(Math.min(abs - 2, 1));
        dist = mix(yEdge, yGone, e);
        z = mix(Z_EDGE, Z_GONE, e);
        rot = mix(ROT_EDGE, ROT_GONE, e);
      }

      /* Positive offset = later in the ring = travelling upward. */
      const ty = -sign * dist;

      /* Only the card at dead center answers the cursor. */
      const centered = Math.max(0, 1 - abs);
      const rotX = -sign * rot + -mouse.y * MAX_TILT_X * centered;
      const rotY = mouse.x * MAX_TILT_Y * centered;

      el.style.transform =
        'translate3d(0,' +
        ty.toFixed(2) +
        'px,' +
        z.toFixed(2) +
        'px) rotateX(' +
        rotX.toFixed(2) +
        'deg) rotateY(' +
        rotY.toFixed(2) +
        'deg) rotateZ(' +
        CARD_TILT_Z +
        'deg)';
      el.style.zIndex = String(Math.round(z));

      const fade = abs > fadeFrom ? clamp(0, 1, (half - abs) / 0.5) : 1;
      el.style.opacity = fade === 1 ? '' : fade.toFixed(3);

      /* Two levels of hit-testing. The card itself stays clickable while it
         is solid enough to aim at (click = bring to front); the <a> inside it
         only opens the site once the card IS the front one. */
      const reachable = fade > 0.6;
      if (reachable !== item.reachable) {
        item.reachable = reachable;
        el.style.pointerEvents = reachable ? '' : 'none';
      }

      const clickable = centered > 0.5;
      if (clickable !== item.clickable) {
        item.clickable = clickable;
        item.link.style.pointerEvents = clickable ? 'auto' : 'none';
      }
    }
  }

  function start() {
    if (rafId) return;
    lastTime = 0;
    lastScrollY = window.scrollY || window.pageYOffset || 0;
    rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (!rafId) return;
    window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function sync() {
    if (onScreen && !document.hidden) start();
    else stop();
  }

  /* ------------------------------------------------------------------
   * Lifecycle.
   * ------------------------------------------------------------------ */
  let resizeTimer = null;
  function onResize() {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resizeTimer = null;
      measure();
    }, 160);
  }
  window.addEventListener('resize', onResize);

  function onVisibility() {
    sync();
  }
  document.addEventListener('visibilitychange', onVisibility);

  let observer = null;
  if ('IntersectionObserver' in window) {
    observer = new window.IntersectionObserver(
      (entries) => {
        for (let i = 0; i < entries.length; i++) {
          onScreen = entries[i].isIntersecting;
        }
        sync();
      },
      { rootMargin: '120px 0px' }
    );
    observer.observe(stage);
  } else {
    onScreen = true;
  }

  measure();
  /* One frame at rest so nothing flashes in the strip layout before the
     observer decides whether we are on screen. */
  frame(0);
  stop();
  sync();

  return function destroy() {
    stop();
    if (observer) observer.disconnect();
    if (resizeTimer) window.clearTimeout(resizeTimer);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('mouseleave', onPointerLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    stage.removeEventListener('pointerenter', onEnter);
    stage.removeEventListener('pointerleave', onLeave);
    stage.removeEventListener('focusin', onFocusIn);
    stage.removeEventListener('focusout', onFocusOut);
    stage.removeEventListener('click', onClick);
    stage.classList.remove('is-3d');
    track.classList.remove('is-3d');
    track.style.width = '';
    track.style.height = '';
    built.forEach((b) => {
      b.el.style.cssText = '';
      b.link.style.pointerEvents = '';
    });
  };
}
