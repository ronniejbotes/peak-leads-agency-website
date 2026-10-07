"""Peak Leads share card: the 1200x630 link-preview image (og:image) on every
page that has no image of its own.

Writes card.html with the Geist fonts and the dark-ground mark embedded, so
it renders from file:// with nothing fetched. Then:

  1. python3 tools/og-card/build_card.py card.html
     (run from the repo root, after npm install: the fonts come from
     node_modules)
  2. Screenshot it at exactly 1200x630, for example with headless Chrome:
       "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
         --headless --hide-scrollbars --window-size=1200,630 \
         --screenshot=card.png "file://$PWD/card.html"
  3. sips -s format jpeg -s formatOptions 88 card.png --out og-image-N.jpg
     (about 125 KB; keep it well under 300 KB or WhatsApp may drop the big
     preview)

Ship it under a NEW name (og-image-3.jpg and so on) and point every
og:image / twitter:image at it, never overwrite the old file: Hostinger,
WhatsApp and Facebook all cache an image by its address, for up to a week.

Colours are the brand reference palette in src/styles/main.css (Ink ground,
lifted blue for text, chalk and bone particles only). No numbers or claims
on the card, so it never goes stale.
"""
import base64
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
out = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'card.html')


def b64(path):
    return base64.b64encode((ROOT / path).read_bytes()).decode()


geist = b64('node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2')
mono = b64('node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2')
mark = (ROOT / 'public/assets/logos/peak-leads-mark-dark.svg').read_text()

HTML = """<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Geist';src:url(data:font/woff2;base64,{GEIST}) format('woff2');font-weight:100 900}
@font-face{font-family:'GeistMono';src:url(data:font/woff2;base64,{MONO}) format('woff2');font-weight:100 900}
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#111725}
.card{position:relative;width:1200px;height:630px;overflow:hidden;
  background:
    radial-gradient(closest-side at 16% 8%, rgba(91,157,255,.13), transparent),
    radial-gradient(closest-side at 78% 30%, rgba(15,63,176,.22), transparent),
    radial-gradient(closest-side at 30% 104%, rgba(223,162,46,.07), transparent),
    #111725;
  font-family:'Geist',system-ui,sans-serif;color:#EEF2F8}
canvas{position:absolute;inset:0}
.brand{position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:16px}
.brand svg{width:64px;height:63px}
.brand b{font-size:34px;font-weight:700;letter-spacing:-.02em}
.copy{position:absolute;left:72px;top:190px;width:600px}
h1{margin:0;font-size:100px;line-height:1.0;font-weight:700;letter-spacing:-.035em}
p{margin:30px 0 0;font-size:29px;line-height:1.4;color:#A3AEC0;max-width:560px}
.url{position:absolute;left:72px;bottom:58px;font-family:'GeistMono',ui-monospace,monospace;
  font-size:24px;font-weight:500;letter-spacing:.02em;color:#5B9DFF}
</style></head><body><div class="card">
<canvas id="c" width="1200" height="630"></canvas>
<div class="brand">{MARK}<b>PeakLeads</b></div>
<div class="copy"><h1>Build your<br>presence.</h1>
<p>Websites, SEO, paid ads and lead generation for South African trades.</p></div>
<div class="url">peakleads.agency</div>
</div><script>
/* The PEAK formation from the homepage's particle scene, flattened to 2D:
   a ridgeline with a sharp central summit, chalk and bone dots only
   (DESIGN.md 5), seeded so every render is identical. */
let s = 7; const rnd = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const c = document.getElementById('c'), x = c.getContext('2d'), W = 1200, H = 630;
const peaks = [[860, 118, 150], [690, 330, 120], [1065, 300, 115], [560, 470, 110], [1185, 420, 90]];
const ridge = (px) => Math.min(...peaks.map(([cx, top, w]) => H - (H - top) * Math.exp(-Math.abs(px - cx) / w)));
const fadeL = (px) => { const t = Math.min(1, Math.max(0, (px - 520) / 260)); return t * t * (3 - 2 * t); };
x.globalCompositeOperation = 'lighter';
const dot = (px, py, r, a) => { const bone = rnd() < .55; x.fillStyle = bone ? `rgba(242,239,233,${a})` : `rgba(217,199,160,${a})`;
  x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill(); };
for (let i = 0; i < 5200; i++) {
  const px = 470 + rnd() * 760, top = ridge(px);
  const d = -Math.log(1 - rnd() * .985) * 52;            /* dense at the ridge, thinning below */
  const py = top + d; if (py > H + 4) continue;
  const edge = Math.exp(-d / 26);                        /* the silhouette reads brightest */
  dot(px + (rnd() - .5) * 2, py, .7 + rnd() * 1.25, (.10 + .5 * edge) * fadeL(px));
}
for (let i = 0; i < 420; i++) {                         /* warm dust over the whole card */
  const px = rnd() * W, py = rnd() * H; dot(px, py, .5 + rnd() * .9, (.05 + rnd() * .12) * (.25 + .75 * fadeL(px)));
}
document.body.dataset.ready = '1';
</script></body></html>"""

out.write_text(HTML.replace('{GEIST}', geist).replace('{MONO}', mono).replace('{MARK}', mark))
print('wrote', out)
