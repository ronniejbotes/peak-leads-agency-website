/*
 * Peak Leads - src/js/arcade.js
 * Easter egg: type "spiderman" anywhere on the home page.
 *
 * A 2D pixel web-swinging mini-game. Hold to fire a web line at an anchor,
 * swing the pendulum, release to launch, land on the next rooftop. Gaps widen
 * and rooftops narrow as the score climbs. Top-5 scores persist locally.
 *
 * Contract:
 * - Lazy: main.js only imports this module once the trigger actually fires,
 *   so the 99% of visitors who never find it pay nothing for it.
 * - Self-contained. No images, no audio files, no network. The hero is a
 *   string-map sprite and the soundtrack is synthesised at runtime through
 *   the Web Audio API - see CHIPTUNE below.
 * - Fixed 60Hz physics step with an accumulator, so the swing arc is
 *   identical on a 60Hz and a 144Hz panel. Only drawing is per-frame.
 * - Everything it creates, it removes again in close(): rAF, listeners,
 *   audio nodes, DOM. Focus returns to where it came from.
 */

/* Logical pixel canvas; scaled up with nearest-neighbour for crisp pixels. */
const W = 320;
const H = 180;
const STEP = 1 / 60;

const GRAVITY = 0.32;
const REACH = 140; /* how far the web can grab */
const WALK = 0.55; /* rooftop shuffle, so standing still still costs you */
const AIR_DRAG = 0.9975;
const MAX_FALL = 9;
const PUMP = 0.055; /* tangential push while the web is taut */
const MAX_SPEED = 7.5;

/* Hero palette. The sprite maps below are an original design; only the
   colours are the familiar red/blue web-slinger scheme. The city keeps the
   site's own warm tokens so the egg still reads as part of Peak Leads. */
const C = {
  red: '#D42026',
  blue: '#1D4FA5',
  web: '#0B0A12', /* the dark web-lines across the suit */
  eye: '#EEF2F8', /* --text */
  sky0: '#111725',
  sky1: '#1A2234',
  star: '#3A4358',
  farTower: '#182034',
  tower: '#212B40',
  /* The roof line is the landing target, so it is the brightest thing in the
     skyline - at this scale a subtle edge just disappears into the fill. */
  towerEdge: '#5C6675',
  window: '#3E4657',
  /* Lit windows stay warm: the crown gold is the one warm note in the brand,
     and a city of blue windows against a blue sky loses the skyline. */
  windowLit: '#C08A2E',
  anchor: '#5B9DFF',
  line: '#EEF2F8',
};

/* 7x9 sprites. r = red, b = blue, w = web line, e = eye, . = transparent. */
const POSE_STAND = [
  '..rrr..',
  '.rerer.',
  '..rwr..',
  '.rrrrr.',
  'rrwrwrr',
  '.rbbbr.',
  '..b.b..',
  '..b.b..',
  '.bb.bb.',
];
const POSE_SWING = [
  'r.rrr.r',
  '.rerer.',
  '..rwr..',
  '.rrrrr.',
  '.rwrwr.',
  '..bbb..',
  '..b.b..',
  '.b...b.',
  '.b...b.',
];

/* ------------------------------------------------------------------ *
 * Chiptune. An original loop written for this page - four bars of A
 * minor over a descending root line, square lead, triangle bass, filtered
 * noise for drums. Nothing is sampled or downloaded; every note is an
 * oscillator built on the fly, which is why the whole soundtrack costs
 * zero bytes of transfer.
 * ------------------------------------------------------------------ */
const BPM = 132;
const N = null;
/* 4 bars x 16 sixteenths. MIDI note numbers; 81 = A5. */
const LEAD = [
  81, N, 88, N, 86, N, 84, N, 81, N, 84, N, 86, N, N, N,
  79, N, 86, N, 84, N, 83, N, 79, N, 83, N, 84, N, N, N,
  81, N, 88, N, 86, N, 84, N, 88, N, 89, N, 91, N, N, N,
  89, N, 88, N, 86, N, 84, N, 83, N, 81, N, N, N, N, N,
];
const BASS_ROOTS = [45, 43, 41, 40];
const BASS_STEPS = [0, 3, 6, 8, 11, 14];
const KICK_STEPS = [0, 6, 8];
const SNARE_STEPS = [4, 12];

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function makeAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  let ctx;
  try {
    ctx = new Ctx();
  } catch (err) {
    return null;
  }
  const master = ctx.createGain();
  master.gain.value = 0.2;
  master.connect(ctx.destination);

  /* One second of white noise, reused for every drum hit. */
  const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  function tone(type, freq, at, dur, vol, detune) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (detune) o.detune.setValueAtTime(detune, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(master);
    o.start(at);
    o.stop(at + dur + 0.03);
  }

  function drum(at, dur, vol, type, freq) {
    const s = ctx.createBufferSource();
    s.buffer = nb;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f);
    f.connect(g);
    g.connect(master);
    s.start(at);
    s.stop(at + dur + 0.02);
  }

  function kick(at) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, at);
    o.frequency.exponentialRampToValueAtTime(45, at + 0.11);
    g.gain.setValueAtTime(0.5, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    o.connect(g);
    g.connect(master);
    o.start(at);
    o.stop(at + 0.2);
  }

  return { ctx, master, tone, drum, kick };
}

/* ------------------------------------------------------------------ */

export function openArcade() {
  if (document.querySelector('.arcade')) return null;

  const returnFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const bodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  /* ---------------- DOM shell ---------------- */
  const root = document.createElement('div');
  root.className = 'arcade';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Web-slinger mini game');
  root.innerHTML = [
    '<div class="arcade-stage">',
    '<canvas class="arcade-canvas" width="' + W + '" height="' + H + '"></canvas>',
    '<div class="arcade-hud">',
    '<span class="arcade-score">0</span>',
    '<span class="arcade-best">BEST 0</span>',
    '</div>',
    '<div class="arcade-panel" data-panel>',
    '<h2 class="arcade-title">WEB SLINGER</h2>',
    '<p class="arcade-sub">Hold <b>SPACE</b> or <b>CLICK</b> to shoot a web at the glowing anchor.',
    ' Let go to fly. Land on the next rooftop.</p>',
    /* novalidate: the browser's own bubble would silently block submit before
       submitScore() runs, so its errors would never be seen. Validation here
       is ours, and styled to match. */
    '<form class="arcade-form" data-form novalidate hidden>',
    '<p class="arcade-formlead">New high score. Put your name on the board.</p>',
    '<label>NAME<input type="text" data-name maxlength="18" autocomplete="name" spellcheck="false"></label>',
    '<label>EMAIL<input type="email" data-email maxlength="72" autocomplete="email" spellcheck="false"></label>',
    '<p class="arcade-err" data-err role="alert" hidden></p>',
    '<div class="arcade-formrow">',
    '<button type="submit" class="arcade-btn" data-save>SAVE</button>',
    '<button type="button" class="arcade-btn arcade-btn-ghost" data-skip>SKIP</button>',
    '</div>',
    '<p class="arcade-fine">Sent to Peak Leads along with your score.</p>',
    '</form>',
    '<p class="arcade-cta" data-cta>Press <b>SPACE</b> to start</p>',
    '<ol class="arcade-board" data-board></ol>',
    '</div>',
    '<div class="arcade-controls">',
    '<button class="arcade-mute" type="button" data-mute aria-pressed="false">&#9835; MUSIC: ON</button>',
    '<button class="arcade-x" type="button" aria-label="Close mini game">ESC &#183; CLOSE</button>',
    '</div>',
    '</div>',
  ].join('');
  document.body.appendChild(root);

  const canvas = root.querySelector('.arcade-canvas');
  const ctx2d = canvas.getContext('2d');
  ctx2d.imageSmoothingEnabled = false;
  const elScore = root.querySelector('.arcade-score');
  const elBest = root.querySelector('.arcade-best');
  const elPanel = root.querySelector('[data-panel]');
  const elCta = root.querySelector('[data-cta]');
  const elBoard = root.querySelector('[data-board]');
  const elMute = root.querySelector('[data-mute]');
  const elForm = root.querySelector('[data-form]');
  const elName = root.querySelector('[data-name]');
  const elEmail = root.querySelector('[data-email]');
  const elErr = root.querySelector('[data-err]');
  const elSave = root.querySelector('[data-save]');

  /* ---------------- scoreboard ---------------- */
  const KEY = 'peak.arcade.scores';
  const MUTE_KEY = 'peak.arcade.muted';

  const TOP = 5;

  /* Entries are {s: score, n: name}. Older builds stored bare numbers, so
     anything already on disk is normalised on the way in. */
  function readScores() {
    let v = [];
    try {
      v = JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch (err) {
      return [];
    }
    if (!Array.isArray(v)) return [];
    return v
      .map((e) =>
        typeof e === 'number'
          ? { s: e, n: '' }
          : e && typeof e.s === 'number'
            ? { s: e.s, n: typeof e.n === 'string' ? e.n : '' }
            : null
      )
      .filter(Boolean)
      .sort((a, b) => b.s - a.s)
      .slice(0, TOP);
  }

  function saveScores(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (err) {
      /* private mode: scores just do not persist */
    }
  }

  /* A run earns a place if the board has room or it beats the weakest entry. */
  function qualifies(n) {
    if (n <= 0) return false;
    const all = readScores();
    return all.length < TOP || n > all[all.length - 1].s;
  }

  function writeScore(n, name) {
    const all = readScores()
      .concat({ s: n, n: name || '' })
      .sort((a, b) => b.s - a.s)
      .slice(0, TOP);
    saveScores(all);
    return all;
  }

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
    );

  function paintBoard() {
    const all = readScores();
    elBest.textContent = 'BEST ' + (all.length ? all[0].s : 0);
    elBoard.innerHTML = all.length
      ? all
          .map(
            (e, i) =>
              '<li><span>' +
              (i + 1) +
              '</span><i>' +
              esc(e.n || '---') +
              '</i><b>' +
              e.s +
              '</b></li>'
          )
          .join('')
      : '';
  }

  /* ---------------- audio ---------------- */
  let audio = null;
  let muted = false;
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch (err) {
    muted = false;
  }
  let seqTimer = 0;
  let stepIdx = 0;
  let nextTime = 0;
  const SIXTEENTH = 60 / BPM / 4;

  function scheduleStep(i, at) {
    const bar = Math.floor(i / 16) % 4;
    const s = i % 16;
    const lead = LEAD[i % LEAD.length];
    if (lead !== null) audio.tone('square', mtof(lead), at, 0.16, 0.16);
    if (BASS_STEPS.indexOf(s) !== -1) {
      const root = BASS_ROOTS[bar] + (s === 6 || s === 14 ? 12 : 0);
      audio.tone('triangle', mtof(root), at, 0.13, 0.3);
    }
    if (KICK_STEPS.indexOf(s) !== -1) audio.kick(at);
    if (SNARE_STEPS.indexOf(s) !== -1) audio.drum(at, 0.11, 0.22, 'bandpass', 1800);
    if (s % 2 === 0) audio.drum(at, 0.03, 0.05, 'highpass', 7000);
  }

  function pump() {
    if (!audio) return;
    while (nextTime < audio.ctx.currentTime + 0.14) {
      scheduleStep(stepIdx, Math.max(nextTime, audio.ctx.currentTime));
      stepIdx = (stepIdx + 1) % LEAD.length;
      nextTime += SIXTEENTH;
    }
  }

  function startMusic() {
    if (muted) return;
    if (!audio) audio = makeAudio();
    if (!audio) return;
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    if (seqTimer) return;
    nextTime = audio.ctx.currentTime + 0.08;
    seqTimer = window.setInterval(pump, 25);
    pump();
  }
  function stopMusic() {
    if (seqTimer) window.clearInterval(seqTimer);
    seqTimer = 0;
  }
  function sfx(kind) {
    if (muted || !audio) return;
    const t = audio.ctx.currentTime;
    if (kind === 'shoot') audio.tone('square', 1200, t, 0.05, 0.1);
    else if (kind === 'land') audio.tone('square', 520, t, 0.07, 0.12);
    else if (kind === 'score') {
      audio.tone('square', 784, t, 0.07, 0.14);
      audio.tone('square', 1175, t + 0.07, 0.1, 0.14);
    } else if (kind === 'dead') {
      audio.tone('sawtooth', 330, t, 0.16, 0.16);
      audio.tone('sawtooth', 220, t + 0.14, 0.22, 0.16);
      audio.tone('sawtooth', 130, t + 0.3, 0.4, 0.16);
    }
  }
  function setMuted(v) {
    muted = v;
    elMute.textContent = muted ? '♫ MUSIC: OFF' : '♫ MUSIC: ON';
    elMute.setAttribute('aria-pressed', muted ? 'true' : 'false');
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch (err) {
      /* ignore */
    }
    if (muted) {
      stopMusic();
      if (audio) audio.master.gain.value = 0;
    } else if (audio) {
      audio.master.gain.value = 0.2;
      if (state === 'play') startMusic();
    } else if (state === 'play') {
      startMusic();
    }
  }

  /* ---------------- world ---------------- */
  let buildings = [];
  let anchors = [];
  let player = null;
  let camX = 0;
  let score = 0;
  let state = 'title'; /* title | play | dead */
  let holding = false;
  let rope = null; /* {a, len} */
  let stars = [];
  let shake = 0;

  const rnd = () => Math.random();

  function difficulty() {
    return Math.min(1, score / 18);
  }

  function pushBuilding() {
    const d = difficulty();
    const prev = buildings[buildings.length - 1];
    const gap = 24 + d * 46 + rnd() * 12;
    const w = 72 - d * 40 + rnd() * 10;
    /* Each roof stays within one swing of the last one. Absolute random
       heights generate jumps no arc can clear, which reads as the game
       cheating rather than as difficulty - so the challenge lives in the
       gap width and the landing width instead. */
    const step = (rnd() * 2 - 1) * (14 + d * 12);
    const top = Math.round(Math.min(148, Math.max(94, prev.top + step)));
    const x = Math.round(prev.x + prev.w + gap);
    buildings.push({ x, w: Math.round(w), top, id: prev.id + 1 });
    /* One anchor over every gap - the challenge is never a missing handhold.
       Placed relative to the lower of the two roofs so the pendulum geometry
       is the same everywhere on the skyline. */
    const roofline = Math.min(prev.top, top);
    anchors.push({
      x: Math.round(prev.x + prev.w + gap * 0.5 + (rnd() * 10 - 5)),
      y: Math.round(Math.max(14, roofline - 64 - rnd() * 20 + d * 8)),
    });
  }

  function reset() {
    buildings = [{ x: 10, w: 78, top: 126, id: 0 }];
    anchors = [];
    score = 0;
    shake = 0;
    rope = null;
    holding = false;
    for (let i = 0; i < 8; i++) pushBuilding();
    player = {
      x: 40,
      y: 126 - 5,
      vx: 0,
      vy: 0,
      grounded: true,
      onId: 0,
      launchId: -1,
      dead: false,
    };
    camX = 0;
    stars = [];
    for (let i = 0; i < 90; i++) {
      stars.push({ x: rnd() * 3000, y: rnd() * 110, p: 0.3 + rnd() * 0.5 });
    }
    elScore.textContent = '0';
  }

  function bestAnchor() {
    let best = null;
    let bestD = REACH;
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      if (a.y > player.y - 14) continue; /* must be above */
      if (a.x < player.x - 46) continue; /* no grabbing backwards */
      const d = Math.hypot(a.x - player.x, a.y - player.y);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  }

  function attach() {
    const a = bestAnchor();
    if (!a) return;
    /* Leap into the swing when starting from a rooftop. Without this the
       swinger drops straight off the lip and the arc starts inside the very
       building they were standing on. */
    if (player.grounded) {
      player.vy = -3.2;
      if (player.vx < 2) player.vx = 2;
      /* Remember which roof we pushed off: while the web is taut that one
         building is intangible, so arcing back down across your own launch
         pad neither counts as a landing (which would drop the web on frame
         one of every swing) nor as slamming into its wall. */
      player.launchId = player.onId;
    }
    rope = { a, len: Math.max(22, Math.hypot(a.x - player.x, a.y - player.y)) };
    player.grounded = false;
    sfx('shoot');
  }

  function die() {
    if (player.dead) return;
    player.dead = true;
    state = 'dead';
    shake = 8;
    rope = null;
    stopMusic();
    sfx('dead');

    elPanel.classList.add('is-open');
    elPanel.querySelector('.arcade-title').textContent = 'WIPE OUT';
    elPanel.querySelector('.arcade-sub').innerHTML =
      'You landed <b>' + score + '</b> rooftop' + (score === 1 ? '' : 's') + '.';

    if (qualifies(score)) {
      /* Hold the score back until they save or skip, so the board does not
         show an unnamed row behind the form they are filling in. */
      openForm();
    } else {
      paintBoard();
      closeForm();
    }
  }

  /* ---------------- high-score entry ---------------- */
  let formOpen = false;

  function openForm() {
    formOpen = true;
    elForm.hidden = false;
    elErr.hidden = true;
    elSave.disabled = false;
    elSave.textContent = 'SAVE';
    elCta.hidden = true; /* SPACE must not restart mid-typing */
    paintBoard();
    window.setTimeout(() => elName.focus(), 30);
  }

  function closeForm() {
    formOpen = false;
    elForm.hidden = true;
    elCta.hidden = false;
    elCta.innerHTML = 'Press <b>SPACE</b> to swing again';
  }

  /* Same delivery path the free-audit funnel uses, so a high score lands in
     the same inbox as every other lead. Failure is non-blocking: the score
     is already on the local board either way. */
  const SCORE_ENDPOINT = 'https://formsubmit.co/ajax/bradley@peakleads.agency';

  function deliverScore(name, email, n) {
    try {
      fetch(SCORE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name,
          email,
          score: n,
          source: 'Web Slinger easter egg',
          _subject: 'Web Slinger high score: ' + name + ' (' + n + ')',
        }),
        keepalive: true,
      }).catch(() => {});
    } catch (err) {
      /* offline or blocked: the local board still has it */
    }
  }

  function submitScore(event) {
    if (event) event.preventDefault();
    const name = elName.value.trim();
    const email = elEmail.value.trim();
    if (!name) {
      elErr.textContent = 'Add a name for the board.';
      elErr.hidden = false;
      elName.focus();
      return;
    }
    /* Deliberately loose: something@something.something, nothing cleverer. */
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      elErr.textContent = 'That email does not look right.';
      elErr.hidden = false;
      elEmail.focus();
      return;
    }
    elErr.hidden = true;
    elSave.disabled = true;
    elSave.textContent = 'SAVED';
    deliverScore(name, email, score);
    writeScore(score, name);
    paintBoard();
    closeForm();
    root.querySelector('.arcade-x').focus();
  }

  function skipScore() {
    writeScore(score, ''); /* still earns its place, just anonymous */
    paintBoard();
    closeForm();
    root.querySelector('.arcade-x').focus();
  }

  function update() {
    if (state !== 'play') return;
    const p = player;
    const prevFeet = p.y + 4;

    if (p.grounded) {
      /* Shed swing momentum quickly on touchdown, otherwise a fast landing
         skates straight off the far edge before you can aim the next web. */
      p.vx += (WALK - p.vx) * 0.16;
      p.vy = 0;
    } else {
      p.vy += GRAVITY;
      if (p.vy > MAX_FALL) p.vy = MAX_FALL;
      p.vx *= AIR_DRAG;
    }

    p.x += p.vx;
    p.y += p.vy;

    /* One-sided rope: it can pull the swinger in, never push them out. */
    if (rope) {
      const dx = p.x - rope.a.x;
      const dy = p.y - rope.a.y;
      const d = Math.hypot(dx, dy) || 0.0001;
      const nx = dx / d;
      const ny = dy / d;
      if (d > rope.len) {
        p.x = rope.a.x + nx * rope.len;
        p.y = rope.a.y + ny * rope.len;
        const radial = p.vx * nx + p.vy * ny;
        if (radial > 0) {
          p.vx -= radial * nx;
          p.vy -= radial * ny;
        }
        /* Pump along the tangent, in whichever direction we are already
           travelling - the swinger working the arc. Launching from a rooftop
           starts you level with the bottom of the swing, so without this
           there is barely any height to trade for speed and every arc is a
           limp drop. Capped so it cannot wind up forever. */
        const tx = -ny;
        const ty = nx;
        const along = p.vx * tx + p.vy * ty;
        const dir = along >= 0 ? 1 : -1;
        p.vx += tx * dir * PUMP;
        p.vy += ty * dir * PUMP;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > MAX_SPEED) {
          p.vx = (p.vx / sp) * MAX_SPEED;
          p.vy = (p.vy / sp) * MAX_SPEED;
        }
      }
      /* Reel in while held. Tuned so the bottom of a typical arc sits at
         roughly roof height rather than well below it - a swing that bottoms
         out under the skyline launches you into the next wall every time. */
      if (rope.len > 28) rope.len -= 0.8;
    }

    /* Rooftop contact. Landing is tested before the wall, so clipping the
       lip of a building counts as a save rather than a splat - and it is
       tested even while roped, otherwise swinging over a roof you could
       obviously stand on would kill you. */
    const wasGrounded = p.grounded;
    p.grounded = false;
    const feet = p.y + 4;
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (rope && b.id === p.launchId) continue; /* intangible while swinging out */
      if (p.x + 2 < b.x || p.x - 2 > b.x + b.w) continue;
      /* Unroped, vy >= 0 also covers simply RESTING on a roof (vy is 0), so
         the grounded flag survives frame to frame. While roped it must be a
         real descent - otherwise firing a web from a standstill satisfies
         the test on frame one and clears the rope before it can pull. */
      const canLand = rope ? p.vy > 0.5 : p.vy >= 0;
      if (canLand && prevFeet <= b.top + 1 && feet >= b.top) {
        p.y = b.top - 4;
        p.vy = 0;
        p.grounded = true;
        rope = null; /* touching down always lets go of the web */
        if (b.id !== p.onId) {
          const jumped = b.id - p.onId;
          p.onId = b.id;
          if (jumped > 0) score += jumped;
          elScore.textContent = String(score);
          sfx('score');
        } else if (!wasGrounded) {
          sfx('land');
        }
        break;
      }
      if (feet > b.top + 3) {
        die();
        return;
      }
    }

    if (p.y > H + 30) {
      die();
      return;
    }

    /* Keep the world stocked ahead and drop what is far behind. */
    while (buildings[buildings.length - 1].x < p.x + W * 2) pushBuilding();
    while (buildings.length > 2 && buildings[1].x + buildings[1].w < p.x - W) {
      buildings.shift();
    }
    while (anchors.length && anchors[0].x < p.x - W) anchors.shift();

    const targetCam = p.x - 104;
    camX += (targetCam - camX) * 0.14;
    if (camX < 0) camX = 0;
    if (shake > 0) shake *= 0.86;
  }

  /* ---------------- draw ---------------- */
  function sprite(map, sx, sy, flip) {
    for (let r = 0; r < map.length; r++) {
      const row = map[r];
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        if (ch === '.' || ch === ' ') continue;
        ctx2d.fillStyle =
          ch === 'e' ? C.eye : ch === 'w' ? C.web : ch === 'b' ? C.blue : C.red;
        ctx2d.fillRect(sx + (flip ? row.length - 1 - c : c), sy + r, 1, 1);
      }
    }
  }

  function draw() {
    const ox = -Math.round(camX) + (shake > 0.4 ? Math.round((Math.random() - 0.5) * shake) : 0);
    const oy = shake > 0.4 ? Math.round((Math.random() - 0.5) * shake) : 0;

    const g = ctx2d.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.sky1);
    g.addColorStop(1, C.sky0);
    ctx2d.fillStyle = g;
    ctx2d.fillRect(0, 0, W, H);

    /* Parallax stars. */
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const x = ((s.x - camX * 0.25) % 3000 + 3000) % 3000;
      if (x > W) continue;
      ctx2d.fillStyle = C.star;
      ctx2d.globalAlpha = s.p;
      ctx2d.fillRect(Math.round(x), Math.round(s.y), 1, 1);
    }
    ctx2d.globalAlpha = 1;

    /* Far skyline, half speed. */
    ctx2d.fillStyle = C.farTower;
    for (let i = -1; i < 14; i++) {
      const bx = Math.round(i * 46 - ((camX * 0.45) % 46));
      const bh = 34 + ((i * 37) % 5) * 9;
      ctx2d.fillRect(bx, H - bh, 34, bh);
    }

    /* Rooftops. */
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      const bx = b.x + ox;
      if (bx > W || bx + b.w < 0) continue;
      ctx2d.fillStyle = C.tower;
      ctx2d.fillRect(bx, b.top + oy, b.w, H - b.top);
      ctx2d.fillStyle = C.towerEdge;
      ctx2d.fillRect(bx, b.top + oy, b.w, 2);
      /* Deterministic window grid so buildings do not shimmer as they scroll. */
      for (let wy = b.top + 5; wy < H - 2; wy += 7) {
        for (let wx = bx + 3; wx < bx + b.w - 3; wx += 6) {
          const lit = (((wx * 7) ^ (wy * 13) ^ (b.id * 31)) & 7) === 0;
          ctx2d.fillStyle = lit ? C.windowLit : C.window;
          ctx2d.fillRect(Math.round(wx), Math.round(wy), 2, 3);
        }
      }
    }

    /* Anchors, with a ring around the one the web would actually grab. */
    const target = state === 'play' && !rope ? bestAnchor() : null;
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      const ax = a.x + ox;
      if (ax < -8 || ax > W + 8) continue;
      ctx2d.fillStyle = C.anchor;
      ctx2d.fillRect(ax - 1, a.y + oy - 1, 3, 3);
      if (a === target || (rope && a === rope.a)) {
        ctx2d.strokeStyle = C.anchor;
        ctx2d.globalAlpha = 0.55;
        ctx2d.strokeRect(ax - 3.5, a.y + oy - 3.5, 8, 8);
        ctx2d.globalAlpha = 1;
      }
    }

    /* Web line. */
    if (rope) {
      ctx2d.strokeStyle = C.line;
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.moveTo(rope.a.x + ox + 0.5, rope.a.y + oy + 0.5);
      ctx2d.lineTo(player.x + ox + 0.5, player.y + oy - 3.5);
      ctx2d.stroke();
    }

    if (player) {
      sprite(
        rope ? POSE_SWING : POSE_STAND,
        Math.round(player.x + ox) - 3,
        Math.round(player.y + oy) - 4,
        player.vx < -0.05
      );
    }
  }

  /* ---------------- loop ---------------- */
  let raf = 0;
  let last = 0;
  let acc = 0;
  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 8) {
      update();
      acc -= STEP;
    }
    draw();
  }

  /* ---------------- input ---------------- */
  function begin() {
    reset();
    state = 'play';
    elPanel.classList.remove('is-open');
    startMusic();
  }

  function press() {
    if (formOpen) return; /* filling in a high score, not playing */
    if (state === 'play') {
      holding = true;
      attach();
    } else {
      begin();
    }
  }
  function release() {
    holding = false;
    rope = null;
  }

  /* True while the visitor is typing into the high-score fields. Every game
     control has to stand down: SPACE is both "shoot a web" and a space
     character, and this handler runs in the capture phase. */
  const typing = (e) => {
    const t = e.target;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
  };

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      /* Layered: back out of the form first, only then out of the game. */
      if (formOpen) skipScore();
      else close();
      return;
    }
    if (typing(e)) return;
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      setMuted(!muted);
      return;
    }
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) press();
    }
  }
  function onKeyUp(e) {
    if (typing(e)) return;
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp' || e.key === 'Enter') {
      e.preventDefault();
      release();
    }
  }
  function onDown(e) {
    const t = e.target;
    /* Anything chrome-ish is its own control, not a swing. */
    if (t && t.closest && t.closest('.arcade-form, .arcade-controls')) return;
    e.preventDefault();
    press();
  }
  function onUp() {
    release();
  }

  function fit() {
    const raw = Math.min((window.innerWidth - 24) / W, (window.innerHeight - 96) / H);
    const s = raw >= 2 ? Math.floor(raw) : Math.max(0.5, raw);
    canvas.style.width = W * s + 'px';
    canvas.style.height = H * s + 'px';
  }

  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  root.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('resize', fit);
  root.querySelector('.arcade-x').addEventListener('click', close);
  elMute.addEventListener('click', () => setMuted(!muted));
  elForm.addEventListener('submit', submitScore);
  root.querySelector('[data-skip]').addEventListener('click', skipScore);

  /* ---------------- teardown ---------------- */
  function close() {
    stopMusic();
    if (audio) {
      try {
        audio.ctx.close();
      } catch (err) {
        /* already closed */
      }
      audio = null;
    }
    window.cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('resize', fit);
    root.remove();
    document.body.style.overflow = bodyOverflow;
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
  }

  /* ---------------- go ---------------- */
  /* Dev-only handle so the swing can be inspected from a driven browser.
     import.meta.env.DEV is statically false in a production build, so this
     branch is dropped entirely by the bundler. */
  if (import.meta.env && import.meta.env.DEV) {
    root.__debug = () => ({
      state,
      score,
      roped: !!rope,
      ropeLen: rope ? Math.round(rope.len) : 0,
      x: Math.round(player.x),
      y: Math.round(player.y),
      vx: +player.vx.toFixed(2),
      vy: +player.vy.toFixed(2),
      grounded: player.grounded,
      onId: player.onId,
      target: bestAnchor() ? 1 : 0,
      nextGap: (() => {
        const b = buildings.find((x) => x.id === player.onId);
        const n = buildings.find((x) => x.id === player.onId + 1);
        return b && n ? Math.round(n.x - (b.x + b.w)) : null;
      })(),
    });
  }

  elMute.textContent = muted ? '♫ MUSIC: OFF' : '♫ MUSIC: ON';
  elMute.setAttribute('aria-pressed', muted ? 'true' : 'false');
  paintBoard();
  reset();
  elPanel.classList.add('is-open');
  fit();
  draw();
  raf = window.requestAnimationFrame(frame);
  root.querySelector('.arcade-x').focus();

  return close;
}
