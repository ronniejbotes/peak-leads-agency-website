"""Generate the peakleads.agency client-logo set.

Nine clients, two artefacts:
  out/wordmarks/<key>.png  transparent PNG, one ink, one canvas height (ticker)
  out/marks/<key>.png      transparent PNG, one ink, 256x256 square (orbit tiles)

Sizing is optical, not literal: a wordmark is scaled by a blend of its ink
HEIGHT and its ink AREA, so a two-line lockup and a long thin serif end up
carrying the same visual weight on the strip. Pure height normalisation makes
stacked lockups vanish; pure area normalisation makes delicate serifs enormous.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build import *   # noqa

CANVAS_H = 168          # 3x the 56px the strip renders at
PAD_X = 12
FS = 260                # working font size before scaling

TARGET_H = 78           # nominal ink height
TARGET_A = 7000         # nominal ink area (alpha px)
BLEND = 0.55            # 0 = pure height, 1 = pure area
H_MIN, H_MAX = 50, 130
W_MAX = 430


# --------------------------------------------------------------- type

def text_raw(text, font_path, size=FS, weight=None, tracking=0.0):
    font = ImageFont.truetype(font_path, size)
    if weight is not None:
        try:
            font.set_variation_by_axes([weight])
        except Exception:
            pass
    img = Image.new("RGBA", (int(size * (len(text) + 3) * 1.1), size * 3), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = float(size)
    for ch in text:
        d.text((x, size), ch, font=font, fill=(0, 0, 0, 255))
        x += d.textlength(ch, font=font) + tracking * size
    return img


def cap_top_height(font_path, weight=None):
    a = np.array(text_raw("H", font_path, FS, weight))[..., 3]
    ys = np.where(a.max(axis=1) > 6)[0]
    return ys.min(), ys.max() - ys.min() + 1


def type_layer(text, font_path, ink, weight=None, tracking=0.0):
    """Returns (rgba_layer, cap_top_within_layer, cap_height) at working size."""
    cap_top, cap_h = cap_top_height(font_path, weight)
    raw = text_raw(text, font_path, FS, weight, tracking)
    a = np.array(raw)[..., 3]
    xs = np.where(a.max(axis=0) > 6)[0]
    ys = np.where(a.max(axis=1) > 6)[0]
    top = min(int(ys.min()), int(cap_top))
    crop = raw.crop((int(xs.min()), top, int(xs.max()) + 1, int(ys.max()) + 1))
    m = np.array(crop)[..., 3].astype(np.float32) / 255.0
    return paint(m, ink), cap_top - top, cap_h


# --------------------------------------------------------------- art

def art(name, mask_fn=mask_from_alpha, width=1800, ink=INK_WORD, **kw):
    return trim(paint(mask_fn(load_rgba(name, width), **kw), ink))


def round_corners(im, r_frac=0.22):
    r = int(min(im.size) * r_frac)
    m = Image.new("L", im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width - 1, im.height - 1], r, fill=255)
    arr = np.array(im.copy())
    arr[..., 3] = np.minimum(arr[..., 3], np.array(m))
    return Image.fromarray(arr, "RGBA")


# --------------------------------------------------------------- sizing

def optical_scale(layer, tweak=1.0):
    a = np.array(layer)[..., 3].astype(np.float32) / 255.0
    area = max(a.sum(), 1.0)
    s_h = TARGET_H / layer.height
    s_a = (TARGET_A / area) ** 0.5
    s = (s_h ** (1 - BLEND)) * (s_a ** BLEND) * tweak
    h = layer.height * s
    if h > H_MAX:
        s *= H_MAX / h
    elif h < H_MIN:
        s *= H_MIN / h
    if layer.width * s > W_MAX:
        s *= W_MAX / (layer.width * s)
    return s


def wordmark(layer, cap=None, tweak=1.0):
    """cap = (cap_top, cap_h) in layer pixels; centres on the cap band when
    given, on the full bbox otherwise."""
    s = optical_scale(layer, tweak)
    new = layer.resize((max(1, round(layer.width * s)), max(1, round(layer.height * s))), Image.LANCZOS)
    c = Image.new("RGBA", (new.width + PAD_X * 2, CANVAS_H), (0, 0, 0, 0))
    if cap:
        cap_top, cap_h = cap[0] * s, cap[1] * s
        y = round((CANVAS_H - cap_h) / 2 - cap_top)
    else:
        y = round((CANVAS_H - new.height) / 2)
    c.alpha_composite(new, (PAD_X, int(y)))
    return c


# --------------------------------------------------------------- build

W = {}

# Real client artwork, alpha silhouette, one ink.
W["water-automation"] = wordmark(art("waterautomation.png"), tweak=1.10)
W["greatergood"]      = wordmark(art("greatergood.svg"), tweak=0.95)
W["tiny-homes"]       = wordmark(art("tinyhomes-full.conv.png"), tweak=1.10)
W["otaku-kulture"]    = wordmark(art("otakukulture.png"), tweak=1.06)
W["dnd-luxury"]       = wordmark(art("dndlux.svg"), tweak=1.02)

# Cognexa: real node mark + the wordmark in Space Grotesk, the display face
# cognexa.co.za actually sets its brand in.
_cm = art("cognexa-fav.svg")
_ct, _ctop, _ch = type_layer("Cognexa", SPACE_B, INK_WORD, tracking=-0.005)
_mark = scale_to_h(_cm, int(_ch * 1.28))
_gap = int(_ch * 0.40)
_row = Image.new("RGBA", (_mark.width + _gap + _ct.width, max(_mark.height, _ct.height) + 40), (0, 0, 0, 0))
_yoff = max(0, (_ctop + _ch // 2) - _mark.height // 2)
_row.alpha_composite(_mark, (0, int(_yoff)))
_row.alpha_composite(_ct, (_mark.width + _gap, 0))
_row = trim(_row)
W["cognexa"] = wordmark(_row, tweak=0.95)

# Position Xero: their brand IS a text wordmark, set in Outfit on their site.
_l, _t, _h = type_layer("Position Xero", OUTFIT_SB, INK_WORD, tracking=-0.004)
W["position-xero"] = wordmark(_l, cap=(_t, _h), tweak=0.97)

# The Leak Geeks and Cajee Botes have no usable wordmark artwork (a cartoon
# badge and an illustrated roundel), so both are set in the site's own face
# at the same optical weight as the rest of the strip.
for key, label in [("leak-geeks", "The Leak Geeks"), ("cajee-botes", "Cajee Botes")]:
    _l, _t, _h = type_layer(label, GEIST, INK_WORD, weight=640, tracking=-0.006)
    W[key] = wordmark(_l, cap=(_t, _h), tweak=0.97)

for k, v in W.items():
    v.save(os.path.join(OUT_W, k + ".png"))

# --------------------------------------------------------------- marks

M = {}
M["cognexa"] = square_mark(art("cognexa-fav.svg", ink=INK_MARK), inset=0.66)

_wa = art("waterautomation.png", ink=INK_MARK)
M["water-automation"] = square_mark(trim(_wa.crop((0, 0, int(_wa.width * 0.235), _wa.height))), inset=0.64)

_th = art("tinyhomes-full.conv.png", ink=INK_MARK)
M["tiny-homes"] = square_mark(trim(_th.crop((0, 0, int(_th.width * 0.42), _th.height))), inset=0.68)

# Their icon is a light X knocked out of a dark rounded square. Keeping the
# square would put a solid black block on the ring next to three light marks,
# so take the X itself and ink that.
_px = trim(paint(mask_binary_light(load_rgba("positionxero.png", 512), 0.58, 0.30), INK_MARK))
M["position-xero"] = square_mark(_px, inset=0.56)

for k, v in M.items():
    v.save(os.path.join(OUT_M, k + ".png"))

print("wordmarks:")
for k, v in W.items():
    t = trim(v)
    print(f"  {k:18s} canvas={v.size} ink={t.size}")
print("marks:", {k: v.size for k, v in M.items()})
