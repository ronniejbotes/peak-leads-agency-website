/* ==========================================================================
   Peak Leads - scene.js
   Three.js particle engine for "The climb".
   ES module. Exports ONE object: PeakScene. No GSAP, no DOM queries outside
   the passed canvas (window/document lifecycle listeners only).

   Public API (DESIGN.md section 5):
     init(canvas, opts) -> boolean   // false = caller adds body.no-3d
     setFormation(f)     // float 0..4, integer = fully formed
     setProgress(p)      // 0..1 page progress -> camera drift + subtle warm
     setLateral(offset, strip)  // park the formation left/right of panels
     setPointer(x, y)    // -1..1, eased parallax (lerp 0.06)
     setDim(d)           // brightness 0.35 reading dim .. 1 full
     setCondense(c)      // -1..1 implosion / bang
     resize(), destroy()

   Formations: 0 PEAK, 1 FRAME, 2 RANKS, 3 FUNNEL, 4 GROWTH.
   Colors: chalk #D9C7A0 <-> bone #F2EFE9 uniforms only. Dust layer #6b6456.
   ========================================================================== */

import * as THREE from 'three';

let state = null; // all mutable engine state; null = not inited

/* ------------------------------------------------------------------ *
 * Palette (the only hues in the scene)
 * ------------------------------------------------------------------ */
const CHALK = '#D9C7A0';
const BONE = '#F2EFE9';
const DUST = '#6b6456';

/* ------------------------------------------------------------------ *
 * Small math helpers
 * ------------------------------------------------------------------ */

// Gaussian via Box-Muller with spare caching
let gaussSpare = null;
function gauss() {
  if (gaussSpare !== null) {
    const g = gaussSpare;
    gaussSpare = null;
    return g;
  }
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const mag = Math.sqrt(-2.0 * Math.log(u));
  gaussSpare = mag * Math.sin(2.0 * Math.PI * v);
  return mag * Math.cos(2.0 * Math.PI * v);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/* ------------------------------------------------------------------ *
 * Formation generators - each returns Float32Array(count * 3)
 * ------------------------------------------------------------------ */

// 0 - PEAK: gaussian mountain ridgeline with a sharp central summit.
// Silhouette H(x) = sum of three gaussians: a tall NARROW central spike
// (sigma 0.36 against a 4.8-unit base reads sharp) plus two lower shoulders,
// with a small sine term for rocky texture. Depth (z, gaussian sigma 0.4)
// thins the crest so it reads as a ridgeline, not a wall:
// H *= 0.72 + 0.28 * exp(-z^2 / 0.24).
// 30% of points trace the crest line itself (tight z, tiny jitter) for a
// crisp silhouette; the rest fill the massif below via y = base + H*(1-u^2),
// which piles density toward the surface. Half-width ~2.4.
function buildPeak(count) {
  const arr = new Float32Array(count * 3);
  const half = 2.4; // ridge half-width
  const base = -1.35; // ground line
  const crestN = Math.floor(count * 0.3);

  const profile = (x) =>
    2.6 * Math.exp((-x * x) / (2 * 0.36 * 0.36)) +
    1.05 * Math.exp((-(x + 1.45) * (x + 1.45)) / (2 * 0.52 * 0.52)) +
    0.85 * Math.exp((-(x - 1.35) * (x - 1.35)) / (2 * 0.46 * 0.46)) +
    0.09 * Math.sin(x * 5.1) +
    0.12;

  for (let i = 0; i < count; i++) {
    // bias x toward the summit so density peaks at the peak
    const x =
      Math.random() < 0.45
        ? clamp(gauss() * 0.85, -half, half)
        : (Math.random() * 2 - 1) * half;
    const z = clamp(gauss() * 0.4, -0.9, 0.9);
    const H = profile(x) * (0.72 + 0.28 * Math.exp((-z * z) / 0.24));
    let y;
    if (i < crestN) {
      // crest silhouette line
      y = base + H + (Math.random() - 0.5) * 0.06;
    } else {
      // body fill, denser near the surface (dy/du -> 0 at u = 0)
      const u = Math.random();
      y = base + H * (1 - u * u);
    }
    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z * (i < crestN ? 0.45 : 1);
  }
  return arr;
}

// Point on a rounded-rect perimeter at arc-length s (walking clockwise
// from the start of the top edge). Returns [x, y]. Ported unchanged from
// the proven reference engine.
function roundedRectPoint(s, w, h, r) {
  const hw = w / 2;
  const hh = h / 2;
  const straightW = w - 2 * r;
  const straightH = h - 2 * r;
  const arc = (Math.PI / 2) * r;
  // segment lengths in walking order
  const lens = [straightW, arc, straightH, arc, straightW, arc, straightH, arc];
  let total = 0;
  for (let i = 0; i < lens.length; i++) total += lens[i];
  s = ((s % total) + total) % total;
  let seg = 0;
  while (s > lens[seg]) {
    s -= lens[seg];
    seg++;
  }
  const t = s / lens[seg];
  let a;
  switch (seg) {
    case 0: // top edge, left -> right
      return [-hw + r + straightW * t, hh];
    case 1: // top-right arc (90deg -> 0deg)
      a = Math.PI / 2 - (Math.PI / 2) * t;
      return [hw - r + Math.cos(a) * r, hh - r + Math.sin(a) * r];
    case 2: // right edge, top -> bottom
      return [hw, hh - r - straightH * t];
    case 3: // bottom-right arc (0 -> -90)
      a = -(Math.PI / 2) * t;
      return [hw - r + Math.cos(a) * r, -hh + r + Math.sin(a) * r];
    case 4: // bottom edge, right -> left
      return [hw - r - straightW * t, -hh];
    case 5: // bottom-left arc (-90 -> -180)
      a = -Math.PI / 2 - (Math.PI / 2) * t;
      return [-hw + r + Math.cos(a) * r, -hh + r + Math.sin(a) * r];
    default: // top-left arc (180 -> 90)
      a = Math.PI - (Math.PI / 2) * t;
      return [-hw + r + Math.cos(a) * r, hh - r + Math.sin(a) * r];
  }
}

// 1 - FRAME: browser window outline 4.4 x 2.9, corner radius 0.32.
// Budget: 50% of points spaced evenly along the rounded-rect perimeter,
// 8% draw the top bar line at y = h/2 - 0.42, 6% stack into three
// "traffic light" dots on the bar's left (point stacking reads bright
// under additive blending), and the rest lay an interior dot grid
// (step 0.3) in the content area below the bar. Gentle y float idle
// lives in the vertex shader.
function buildFrame(count) {
  const arr = new Float32Array(count * 3);
  const w = 4.4;
  const h = 2.9;
  const r = 0.32;
  const barY = h / 2 - 0.42; // top bar line
  const perim = 2 * (w - 2 * r) + 2 * (h - 2 * r) + Math.PI * 2 * r;

  const outlineN = Math.floor(count * 0.5);
  const barN = Math.floor(count * 0.08);
  const lightN = Math.floor(count * 0.06);

  let i = 0;
  for (; i < outlineN; i++) {
    const p = roundedRectPoint((i / outlineN) * perim, w, h, r);
    arr[i * 3] = p[0] + (Math.random() - 0.5) * 0.045;
    arr[i * 3 + 1] = p[1] + (Math.random() - 0.5) * 0.045;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
  }

  // top bar line spanning inside the outline
  const barX0 = -w / 2 + 0.16;
  const barX1 = w / 2 - 0.16;
  for (let k = 0; k < barN; k++, i++) {
    const t = k / barN;
    arr[i * 3] = barX0 + (barX1 - barX0) * t + (Math.random() - 0.5) * 0.03;
    arr[i * 3 + 1] = barY + (Math.random() - 0.5) * 0.03;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
  }

  // three traffic-light dots in the bar strip, left side
  const lightY = (h / 2 + barY) / 2;
  for (let k = 0; k < lightN; k++, i++) {
    const cx = -w / 2 + 0.34 + (k % 3) * 0.28;
    arr[i * 3] = cx + (Math.random() - 0.5) * 0.07;
    arr[i * 3 + 1] = lightY + (Math.random() - 0.5) * 0.07;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
  }

  // interior dot grid in the content area (points stack per cell)
  const margin = 0.34;
  const step = 0.3;
  const cells = [];
  for (let gy = -h / 2 + margin; gy <= barY - 0.3 + 1e-6; gy += step) {
    for (let gx = -w / 2 + margin; gx <= w / 2 - margin + 1e-6; gx += step) {
      cells.push([gx, gy]);
    }
  }
  for (let k = 0; i < count; k++, i++) {
    const c = cells[k % cells.length];
    arr[i * 3] = c[0] + (Math.random() - 0.5) * 0.045;
    arr[i * 3 + 1] = c[1] + (Math.random() - 0.5) * 0.045;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
  }
  return arr;
}

// RANKS geometry constants - the vertex shader recovers the column index
// from x to drive per-column shimmer, so these numbers are mirrored there.
const RANKS_COLS = 9;
const RANKS_SPACING = 0.55;
const RANKS_X0 = -2.2; // first column center; last lands at +2.2
const RANKS_BASE = -1.5; // shared floor all columns stand on

// 2 - RANKS: 9 ascending columns left -> right (the SEO ladder).
// Column k centers at x = -2.2 + k * 0.55; heights climb
// h(k) = 0.55 + 2.5 * (k/8)^1.15 (0.55 -> 3.05) off the shared base at
// y = -1.5. Points are allocated proportionally to column height (walked
// off cumulative heights) so fill density stays even, with 14% of each
// column piled at the top as a bright cap. x jitter stays within +-0.12,
// under half the 0.55 spacing, so the shader's floor((x+2.475)/0.55)
// column recovery never misfiles a point.
function buildRanks(count) {
  const arr = new Float32Array(count * 3);
  const heights = [];
  const cum = [];
  let totalH = 0;
  for (let k = 0; k < RANKS_COLS; k++) {
    const t = k / (RANKS_COLS - 1);
    const hk = 0.55 + 2.5 * Math.pow(t, 1.15);
    heights.push(hk);
    totalH += hk;
    cum.push(totalH);
  }
  let col = 0;
  for (let i = 0; i < count; i++) {
    const target = (i / count) * totalH;
    while (col < RANKS_COLS - 1 && cum[col] < target) col++;
    const hk = heights[col];
    const x = RANKS_X0 + col * RANKS_SPACING + (Math.random() - 0.5) * 0.24;
    const y =
      Math.random() < 0.14
        ? RANKS_BASE + hk + (Math.random() - 0.5) * 0.06 // top cap
        : RANKS_BASE + Math.random() * hk; // shaft fill
    arr[i * 3] = x;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
  }
  return arr;
}

// 3 - FUNNEL: cone with a wide mouth and a narrow spout.
// Radius profile r(t) = rSpout + (rTop - rSpout) * (1-t)^1.8 over height
// t = 0 (top, y = 1.6) -> 1 (bottom, y = -1.7): a bowl that tightens into
// a stem, mouth radius 2.05 down to 0.2. Budget: 55% ride three spiral
// strands (theta = 4.2 turns * 2pi * t + strand offset), 24% scatter over
// the cone surface (t biased toward the wide top where area is larger),
// 13% densify the top rim ring, and the rest dribble below the spout as a
// thin falling stream. Slow rotation + downward drift idle live in the
// vertex shader.
function buildFunnel(count) {
  const arr = new Float32Array(count * 3);
  const yTop = 1.6;
  const yBot = -1.7;
  const rTop = 2.05;
  const rSpout = 0.2;
  const radiusAt = (t) => rSpout + (rTop - rSpout) * Math.pow(1 - t, 1.8);

  const spiralN = Math.floor(count * 0.55);
  const surfN = Math.floor(count * 0.24);
  const rimN = Math.floor(count * 0.13);
  const strands = 3;
  const turns = 4.2;
  const perStrand = spiralN / strands;

  let i = 0;
  for (let k = 0; k < spiralN; k++, i++) {
    const strand = Math.floor(k / perStrand);
    const t = (k - strand * perStrand) / perStrand; // 0 top -> 1 bottom
    const theta = t * turns * Math.PI * 2 + strand * ((Math.PI * 2) / strands);
    const r = radiusAt(t) * (1 + (Math.random() - 0.5) * 0.07);
    arr[i * 3] = Math.cos(theta) * r;
    arr[i * 3 + 1] = yTop + (yBot - yTop) * t + (Math.random() - 0.5) * 0.05;
    arr[i * 3 + 2] = Math.sin(theta) * r;
  }
  for (let k = 0; k < surfN; k++, i++) {
    const t = Math.pow(Math.random(), 0.75); // bias toward the wide top
    const theta = Math.random() * Math.PI * 2;
    const r = radiusAt(t) * (0.94 + Math.random() * 0.1);
    arr[i * 3] = Math.cos(theta) * r;
    arr[i * 3 + 1] = yTop + (yBot - yTop) * t + (Math.random() - 0.5) * 0.06;
    arr[i * 3 + 2] = Math.sin(theta) * r;
  }
  for (let k = 0; k < rimN; k++, i++) {
    const theta = Math.random() * Math.PI * 2;
    const r = rTop * (1 + (Math.random() - 0.5) * 0.05);
    arr[i * 3] = Math.cos(theta) * r;
    arr[i * 3 + 1] = yTop + (Math.random() - 0.5) * 0.07;
    arr[i * 3 + 2] = Math.sin(theta) * r;
  }
  for (; i < count; i++) {
    // thin stream falling out of the spout
    const theta = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.09;
    arr[i * 3] = Math.cos(theta) * r;
    arr[i * 3 + 1] = yBot - Math.random() * 0.55;
    arr[i * 3 + 2] = Math.sin(theta) * r;
  }
  return arr;
}

// 4 - GROWTH: rising curve band + converging scatter.
// Backbone y = f(x) = -1.05 + 2.35 / (1 + e^(-1.25x)) + 0.14 sin(1.7x)
// over x in [-2.6, 2.6]: a logistic climb with a gentle wave, ending
// (~+1.06) well above where it starts (~-0.8). The band is sampled by
// ARC LENGTH (cumulative polyline lengths, inverted per point) so spacing
// stays even on the steep middle. Budget: 58% band (+-0.07 jitter), 34%
// scatter whose spread ~ 0.55*(1-t)^1.3 collapses onto the line as x
// grows (chaos converging to the trend), 8% pile on the end point as a
// bright terminal. Subtle x drift idle lives in the vertex shader.
function buildGrowth(count) {
  const arr = new Float32Array(count * 3);
  const x0 = -2.6;
  const x1 = 2.6;
  const f = (x) =>
    -1.05 + 2.35 / (1 + Math.exp(-1.25 * x)) + 0.14 * Math.sin(1.7 * x);

  // cumulative arc length over M polyline segments
  const M = 160;
  const cum = new Float32Array(M + 1);
  let len = 0;
  let px = x0;
  let py = f(x0);
  for (let k = 1; k <= M; k++) {
    const x = x0 + ((x1 - x0) * k) / M;
    const y = f(x);
    len += Math.hypot(x - px, y - py);
    cum[k] = len;
    px = x;
    py = y;
  }

  const bandN = Math.floor(count * 0.58);
  const scatterN = Math.floor(count * 0.34);

  let i = 0;
  let seg = 1;
  for (let k = 0; k < bandN; k++, i++) {
    const target = (k / bandN) * len;
    while (seg < M && cum[seg] < target) seg++; // k ordered -> walk forward
    const s0 = cum[seg - 1];
    const segLen = cum[seg] - s0;
    const t = segLen > 0 ? (target - s0) / segLen : 0;
    const x = x0 + ((x1 - x0) * (seg - 1 + t)) / M;
    arr[i * 3] = x + (Math.random() - 0.5) * 0.06;
    arr[i * 3 + 1] = f(x) + (Math.random() - 0.5) * 0.14;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 0.24;
  }
  for (let k = 0; k < scatterN; k++, i++) {
    const t = Math.random();
    const x = x0 + (x1 - x0) * t + (Math.random() - 0.5) * 0.08;
    const spread = 0.55 * Math.pow(1 - t, 1.3) + 0.045;
    arr[i * 3] = x;
    arr[i * 3 + 1] = f(x) + gauss() * spread;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }
  for (; i < count; i++) {
    // bright terminal at the high end of the curve
    arr[i * 3] = x1 + gauss() * 0.06;
    arr[i * 3 + 1] = f(x1) + gauss() * 0.06;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
  }
  return arr;
}

/* ------------------------------------------------------------------ *
 * Shaders
 * ------------------------------------------------------------------ */

const VERT = /* glsl */ `
attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec3 aSeed;
uniform float uMix;
uniform float uTime;
uniform float uFormA;
uniform float uFormB;
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uCondense;
varying float vAlpha;

// Per-formation idle motion, applied to raw formation positions.
// Ids: 0 PEAK, 1 FRAME, 2 RANKS, 3 FUNNEL, 4 GROWTH.
vec3 animatePos(vec3 p, float form) {
  if (form < 0.5) {
    // 0 PEAK: slight breathing of the massif
    float b = 1.0 + 0.025 * sin(uTime * 0.7 + aSeed.x * 6.2831);
    return p * b;
  } else if (form < 1.5) {
    // 1 FRAME: gentle vertical float
    p.y += 0.03 * sin(uTime * 0.8 + p.x * 1.2);
    return p;
  } else if (form < 2.5) {
    // 2 RANKS: per-column height shimmer. Column index recovered from x
    // (columns at x = -2.2 + k * 0.55, jitter < half spacing; constants
    // mirror buildRanks). Heights scale about the shared base at
    // y = -1.5 so the feet stay planted.
    float col = floor((p.x + 2.475) / 0.55);
    float m = 0.95 + 0.05 * sin(uTime * 1.7 + col * 1.9);
    p.y = -1.5 + (p.y + 1.5) * m;
    return p;
  } else if (form < 3.5) {
    // 3 FUNNEL: slow spin about Y plus a downward-travelling compression
    // wave (~5% of the cone height) with matching radial pull toward the
    // axis, so material reads as flowing down the cone.
    float a = uTime * 0.22;
    float c = cos(a);
    float s = sin(a);
    p = vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
    float drift = 0.5 + 0.5 * sin(uTime * 0.9 + p.y * 2.4 + aSeed.x * 1.5);
    p.y -= 0.16 * drift;
    p.x *= 1.0 - 0.05 * drift;
    p.z *= 1.0 - 0.05 * drift;
    return p;
  }
  // 4 GROWTH: subtle x drift with a faint vertical shimmer
  p.x += 0.05 * sin(uTime * 0.5 + aSeed.y * 6.2831);
  p.y += 0.02 * sin(uTime * 0.9 + aSeed.x * 6.2831);
  return p;
}

void main() {
  float m = smoothstep(0.0, 1.0, uMix);
  vec3 pos = mix(animatePos(aStart, uFormA), animatePos(aEnd, uFormB), m);
  // subtle per-point noise wobble
  pos += 0.03 * vec3(
    sin(uTime * 1.1 + aSeed.x * 39.47),
    sin(uTime * 1.3 + aSeed.y * 27.13),
    sin(uTime * 0.9 + aSeed.z * 33.31));
  // implosion / bang: +1 collapses to a dense ball, negative blasts out
  float cIn = clamp(uCondense, 0.0, 1.0);
  float cOut = max(0.0, -uCondense);
  pos *= 1.0 - 0.9 * cIn + 1.9 * cOut;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float size = uPointSize * (0.6 + aSeed.y * 0.8) * (1.0 + cIn * 0.7);
  gl_PointSize = clamp(size * uPixelRatio * (26.0 / max(0.1, -mv.z)), 1.0, 40.0);
  vAlpha = 0.35 + 0.65 * aSeed.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uMix;
uniform float uDim;
uniform float uProg;
varying float vAlpha;

void main() {
  // soft in-shader disc
  float d = length(gl_PointCoord - 0.5);
  float disc = smoothstep(0.5, 0.12, d);
  if (disc < 0.004) discard;
  // uColorA/uColorB are chalk-to-bone lerp stops; no other hues enter
  vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 1.0, uMix));
  // subtle warm temperature drift with page progress
  col *= mix(vec3(1.0), vec3(1.05, 1.0, 0.93), uProg * 0.6);
  // uDim is brightness: 1 full, 0.35 reading dim
  float alpha = disc * vAlpha * uDim;
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

const DUST_VERT = /* glsl */ `
attribute float aSize;
uniform float uPixelRatio;
varying float vTone;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uPixelRatio * (60.0 / max(0.1, -mv.z)), 1.0, 6.0);
  vTone = aSize;
  gl_Position = projectionMatrix * mv;
}
`;

const DUST_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uDim;
varying float vTone;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float disc = smoothstep(0.5, 0.1, d);
  if (disc < 0.004) discard;
  // dust dims less than the machine so the backdrop never dies fully
  float alpha = disc * 0.32 * (0.5 + 0.5 * vTone) * (0.6 + 0.4 * uDim);
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`;

/* ------------------------------------------------------------------ *
 * Engine internals
 * ------------------------------------------------------------------ */

function startLoop() {
  if (!state || state.running || state.contextLost) return;
  state.running = true;
  state.clock.getDelta(); // flush pause gap so time never jumps
  state.raf = requestAnimationFrame(tick);
}

function stopLoop() {
  if (!state) return;
  state.running = false;
  if (state.raf) {
    cancelAnimationFrame(state.raf);
    state.raf = 0;
  }
}

/* Clear air to leave on each side when fitting a formation into the strip a
   station panel leaves free, as a fraction of the viewport width. Real
   margin rather than a percentage of the strip: particles are drawn as
   sprites with an additive glow that bleeds past the point itself, so a
   formation whose outermost POINT lands exactly on the strip edge still
   reads as clipped. */
const STRIP_MARGIN = 0.035;

/* The shader nudges every point around at idle (breathe, shimmer, wobble),
   so geometry measured off the formation arrays runs slightly narrow.
   Pad it rather than let a formation breathe over the edge it was just
   fitted inside. */
const IDLE_HEADROOM = 1.07;

/* Resolve setLateral inputs to fractions each frame. Magnitudes <= 1 are
   already fractions; larger values are pixels and get normalized against
   the cached viewport width (state.viewportW, refreshed in init/resize:
   window.innerWidth reads in the rAF loop can force layout flushes, and a
   fresh object per frame is avoidable GC pressure). */
const lateralScratch = { offset: 0, strip: 0 };

function normLateral() {
  const w = state.viewportW || 1;
  const o = state.lateral.rawOffset;
  const s = state.lateral.rawStrip;
  const offset = Math.abs(o) <= 1 ? o : o / (w / 2);
  const strip = s <= 1 ? s : s / w;
  lateralScratch.offset = clamp(offset, -1, 1);
  lateralScratch.strip = clamp(strip, 0, 1);
  return lateralScratch;
}

function tick() {
  if (!state || !state.running) return;
  state.raf = requestAnimationFrame(tick);

  const dt = Math.min(state.clock.getDelta(), 0.05);
  state.time += dt;
  state.uniforms.uTime.value = state.time;

  // eased pointer parallax (lerp 0.06) + slow progress-driven camera drift
  const p = state.pointer;
  p.x += (p.tx - p.x) * 0.06;
  p.y += (p.ty - p.y) * 0.06;
  const prog = state.progress;
  const cam = state.camera;
  cam.position.x = p.x * 0.55;
  cam.position.y = -p.y * 0.4 - prog * 0.35;
  cam.position.z = 7.0 - prog * 0.7;
  cam.lookAt(0, 0, 0);

  /* Lateral parking: slide the formation into the strip of screen its
     station panel leaves free. The camera keeps looking at the origin;
     moving the points (not the camera) is what shifts them in frame.
     Formations differ in width (GROWTH is over twice the spout of the
     FUNNEL), so a shape too wide for its strip is also scaled down to fit
     rather than sliding until it hangs off the edge. Both channels ease
     per-frame like the pointer parallax above. */
  const lat = state.lateral;
  const want = normLateral();
  const halfH = Math.tan((cam.fov * Math.PI) / 360) * cam.position.z;
  const halfW = halfH * cam.aspect;
  const mixV = state.uniforms.uMix.value;
  const reachA = state.formHalfW[state.pairIndex];
  const reachB = state.formHalfW[Math.min(state.pairIndex + 1, 4)];
  // half-width of the formation currently on screen, before fitting
  const reach = (reachA + (reachB - reachA) * mixV) * state.baseScale;

  /* strip = 0 means "no panel to dodge" (hero, funnel intro, narrow
     screens): leave the scale exactly as it always was. */
  let wantFit = 1;
  if (want.strip > 0 && reach > 0) {
    const usableHalf = Math.max(0, want.strip - 2 * STRIP_MARGIN) * halfW;
    wantFit = Math.min(1, usableHalf / reach);
  }
  lat.fit += (wantFit - lat.fit) * 0.08;
  state.points.scale.setScalar(state.baseScale * lat.fit);

  const limit = Math.max(0, halfW - reach * lat.fit);
  const wantX = clamp(want.offset * halfW, -limit, limit);
  lat.value += (wantX - lat.value) * 0.08;
  state.points.position.x = lat.value;

  // dim eases on the same filter as the slide above
  const dim = state.uniforms.uDim;
  dim.value += (state.dimTarget - dim.value) * 0.08;

  state.renderer.render(state.scene, state.camera);
}

function uploadPair(idx) {
  // idx = lower formation of the active pair (0..3)
  const g = state.geometry;
  g.attributes.aStart.array.set(state.formations[idx]);
  g.attributes.aEnd.array.set(state.formations[Math.min(idx + 1, 4)]);
  g.attributes.aStart.needsUpdate = true;
  g.attributes.aEnd.needsUpdate = true;
  state.uniforms.uFormA.value = idx;
  state.uniforms.uFormB.value = Math.min(idx + 1, 4);
  state.uniforms.uColorA.value.copy(state.colors[idx]);
  state.uniforms.uColorB.value.copy(state.colors[Math.min(idx + 1, 4)]);
  state.pairIndex = idx;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

function init(canvas, opts = {}) {
  let renderer = null;
  try {
    if (state) destroy();
    if (!canvas || typeof window === 'undefined') return false;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: true,
        powerPreference: 'high-performance'
      });
      if (!renderer.getContext()) throw new Error('no context');
    } catch (err) {
      return false;
    }

    const isMobile = window.innerWidth < 768;
    const count = opts.particleCount || (isMobile ? 3000 : 6000);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;

    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 0, 7);

    // ---- formations -------------------------------------------------
    const formations = [
      buildPeak(count),
      buildFrame(count),
      buildRanks(count),
      buildFunnel(count),
      buildGrowth(count)
    ];

    // How far each formation reaches sideways, in world units. Measured
    // as the radius in the XZ plane rather than just |x|: the FUNNEL
    // spins slowly around Y (see animatePos), so a point at depth z
    // swings out to x within seconds; |x| alone would read that shape
    // as narrower than it ever actually is on screen.
    const formHalfW = formations.map((arr) => {
      let widest = 0;
      for (let fi = 0; fi < arr.length; fi += 3) {
        const fx = arr[fi];
        const fz = arr[fi + 2];
        const r = Math.sqrt(fx * fx + fz * fz);
        if (r > widest) widest = r;
      }
      return widest * IDLE_HEADROOM;
    });

    // ---- formation colors: chalk-to-bone ramp only ------------------
    const chalk = new THREE.Color(CHALK);
    const bone = new THREE.Color(BONE);
    const colors = [0, 1, 2, 3, 4].map((i) => chalk.clone().lerp(bone, i / 4));

    // ---- main particle system --------------------------------------
    const geometry = new THREE.BufferGeometry();
    // 'position' only feeds three's draw count; real positions come
    // from aStart/aEnd in the vertex shader.
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    );
    geometry.setAttribute(
      'aStart',
      new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    );
    geometry.setAttribute(
      'aEnd',
      new THREE.BufferAttribute(new Float32Array(count * 3), 3)
    );
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    geometry.attributes.aStart.setUsage(THREE.DynamicDrawUsage);
    geometry.attributes.aEnd.setUsage(THREE.DynamicDrawUsage);

    // shared between machine and dust materials
    const sharedDim = { value: 1 }; // brightness: 1 full, 0.35 reading dim
    const sharedPR = { value: dpr };

    const uniforms = {
      uMix: { value: 0 },
      uTime: { value: 0 },
      uCondense: { value: 0 },
      uColorA: { value: colors[0].clone() },
      uColorB: { value: colors[1].clone() },
      uDim: sharedDim,
      uPointSize: { value: isMobile ? 1.2 : 1.0 },
      uFormA: { value: 0 },
      uFormB: { value: 1 },
      uProg: { value: 0 },
      uPixelRatio: sharedPR
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    // ---- dust layer (700 dim warm points, static, far behind) ------
    const dustCount = 700;
    const dustPos = new Float32Array(dustCount * 3);
    const dustSize = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 52;
      dustPos[i * 3 + 1] = (Math.random() - 0.5) * 32;
      dustPos[i * 3 + 2] = -12 - Math.random() * 26;
      dustSize[i] = 0.4 + Math.random() * 0.9;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('aSize', new THREE.BufferAttribute(dustSize, 1));
    const dustMat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(DUST) },
        uDim: sharedDim,
        uPixelRatio: sharedPR
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    scene.add(dust);

    // ---- state ------------------------------------------------------
    state = {
      renderer,
      scene,
      camera,
      canvas,
      viewportW: w,
      geometry,
      material,
      points,
      dustGeo,
      dustMat,
      dust,
      formations,
      formHalfW,
      colors,
      uniforms,
      pairIndex: -1,
      /* Sideways parking spot. rawOffset/rawStrip keep whatever units the
         caller used (px or fractions); value/fit are the eased world-space
         x and scale factor actually applied. */
      lateral: { rawOffset: 0, rawStrip: 0, value: 0, fit: 1 },
      dimTarget: 1,
      /* Viewport-driven scale from resize(); tick() multiplies it by the
         strip-fit factor, so resize and parking never fight over scale. */
      baseScale: 1,
      clock: new THREE.Clock(),
      time: 0,
      progress: 0,
      pointer: { x: 0, y: 0, tx: 0, ty: 0 },
      running: false,
      contextLost: false,
      raf: 0,
      onVisibility: null,
      onContextLost: null,
      onContextRestored: null
    };

    uploadPair(0);
    resize();

    // ---- lifecycle listeners ---------------------------------------
    state.onVisibility = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };
    document.addEventListener('visibilitychange', state.onVisibility);

    state.onContextLost = (event) => {
      event.preventDefault();
      if (state) {
        state.contextLost = true;
        stopLoop();
      }
    };
    state.onContextRestored = () => {
      if (state) {
        state.contextLost = false;
        if (!document.hidden) startLoop();
      }
    };
    canvas.addEventListener('webglcontextlost', state.onContextLost, false);
    canvas.addEventListener('webglcontextrestored', state.onContextRestored, false);

    if (!document.hidden) startLoop();
    return true;
  } catch (err) {
    // never throw: any failure means the caller falls back to no-3d
    try {
      if (state) destroy();
      else if (renderer) renderer.dispose();
    } catch (e) {
      state = null;
    }
    return false;
  }
}

function setFormation(f) {
  if (!state) return;
  f = clamp(Number.isFinite(+f) ? +f : 0, 0, 4);
  const idx = Math.min(Math.floor(f), 3);
  const frac = f - idx;
  if (idx !== state.pairIndex) uploadPair(idx); // re-upload only on pair change
  state.uniforms.uMix.value = frac; // shader applies smoothstep
}

/* Current continuous formation value (pair index + mix): lets callers
   animate from wherever the scroll choreography left the machine. */
function getFormation() {
  if (!state) return 0;
  return state.pairIndex + state.uniforms.uMix.value;
}

function setProgress(p) {
  if (!state) return;
  p = clamp(Number.isFinite(+p) ? +p : 0, 0, 1);
  state.progress = p;
  state.uniforms.uProg.value = p;
}

/* Park the formation off to one side of a station panel.
     offset - how far from center. Pixels (positive = right) or a -1..1
              fraction of the half viewport; magnitudes <= 1 read as
              fractions. 0 = dead center (hero, funnel intro).
     strip  - width of the clear strip it has to live in. Pixels or a 0..1
              fraction of the viewport width. 0 means unconstrained: keep
              the formation at its natural size. Anything wider than the
              strip is scaled down to fit. */
function setLateral(offset, strip) {
  if (!state) return;
  state.lateral.rawOffset = Number.isFinite(+offset) ? +offset : 0;
  state.lateral.rawStrip = Math.max(0, Number.isFinite(+strip) ? +strip : 0);
}

function setPointer(x, y) {
  if (!state) return;
  state.pointer.tx = clamp(Number.isFinite(+x) ? +x : 0, -1, 1);
  state.pointer.ty = clamp(Number.isFinite(+y) ? +y : 0, -1, 1);
}

/* Brightness target the render loop eases toward: 1 = full, 0.35 = reading
   dim (per contract). Eased so scroll toggles never step visibly. */
function setDim(d) {
  if (!state) return;
  state.dimTarget = clamp(Number.isFinite(+d) ? +d : 1, 0, 1);
}

/* +1 = fully imploded into a small dense ball; 0 = normal; negative values
   (down to -1) blast the particles outward. */
function setCondense(c) {
  if (!state) return;
  state.uniforms.uCondense.value = clamp(Number.isFinite(+c) ? +c : 0, -1, 1);
}

function resize() {
  if (!state) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  state.viewportW = w;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.renderer.setPixelRatio(dpr);
  state.renderer.setSize(w, h, false);
  state.uniforms.uPixelRatio.value = dpr;
  state.camera.aspect = w / h;
  state.camera.updateProjectionMatrix();
  // slightly shrink formations on narrow portrait viewports
  state.baseScale = clamp(0.72 + 0.28 * (w / h), 0.8, 1);
  state.points.scale.setScalar(state.baseScale * state.lateral.fit);
}

function destroy() {
  if (!state) return;
  stopLoop();
  document.removeEventListener('visibilitychange', state.onVisibility);
  state.canvas.removeEventListener('webglcontextlost', state.onContextLost, false);
  state.canvas.removeEventListener('webglcontextrestored', state.onContextRestored, false);
  state.scene.remove(state.points);
  state.scene.remove(state.dust);
  state.geometry.dispose();
  state.material.dispose();
  state.dustGeo.dispose();
  state.dustMat.dispose();
  state.renderer.dispose();
  state = null;
}

export const PeakScene = {
  init,
  setFormation,
  getFormation,
  setProgress,
  setLateral,
  setPointer,
  setDim,
  setCondense,
  resize,
  destroy
};
