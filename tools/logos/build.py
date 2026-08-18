"""Normalise nine real client logos into one PNG system for peakleads.agency.

Two artefacts per client where needed:
  wordmarks/<key>.png   transparent, single ink, fixed canvas height (ticker strip)
  marks/<key>.png       transparent, single ink, 256x256 square (orbit tiles)

Every silhouette comes from the client's OWN logo artwork, pulled from their
live site; only the alpha channel is reused, repainted in one ink so nine
different brands read as one designed strip.
"""
import os, re, io
import numpy as np
import cairosvg
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
FONTS = os.path.join(HERE, "fonts")
OUT_W = os.path.join(HERE, "out", "wordmarks")
OUT_M = os.path.join(HERE, "out", "marks")
for d in (OUT_W, OUT_M):
    os.makedirs(d, exist_ok=True)

INK_WORD = (74, 68, 58)     # --text-2 in .theme-day
INK_MARK = (46, 42, 34)     # a touch stronger for the small orbit tiles

CANVAS_H = 132              # 3x the ~44px the strip renders at
CAP_H = 66                  # default ink height inside that canvas
PAD_X = 10

MARK_PX = 256
MARK_INSET = 0.70           # mark occupies 70% of the square


# ---------------------------------------------------------------- helpers

def load_rgba(name, width=1400):
    p = os.path.join(SRC, name)
    if name.lower().endswith(".svg"):
        png = cairosvg.svg2png(url=p, output_width=width, background_color=None)
        return Image.open(io.BytesIO(png)).convert("RGBA")
    return Image.open(p).convert("RGBA")


def mask_from_alpha(im):
    """Cut-out artwork: the alpha channel already is the silhouette."""
    return np.array(im)[..., 3].astype(np.float32) / 255.0


def mask_from_dark(im, thresh=0.72):
    """Dark art sitting on an opaque light ground."""
    a = np.array(im).astype(np.float32) / 255.0
    lum = a[..., :3] @ np.array([0.2126, 0.7152, 0.0722])
    m = np.clip((thresh - lum) / thresh, 0, 1)
    return m * a[..., 3]


def mask_from_light(im, thresh=0.55):
    """Light art knocked out of a dark ground."""
    a = np.array(im).astype(np.float32) / 255.0
    lum = a[..., :3] @ np.array([0.2126, 0.7152, 0.0722])
    m = np.clip((lum - thresh) / (1 - thresh), 0, 1)
    return m * a[..., 3]


def paint(mask, ink):
    h, w = mask.shape
    out = np.zeros((h, w, 4), np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = ink
    out[..., 3] = (np.clip(mask, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def trim(im, tol=6):
    a = np.array(im)[..., 3]
    ys, xs = np.where(a > tol)
    if len(xs) == 0:
        return im
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def col_gaps(mask, tol=0.02):
    """Column indices where the artwork has no ink — used to split a
    lockup's mark from its wordmark."""
    prof = mask.max(axis=0)
    return prof <= tol


def split_lockup(mask, min_gap_frac=0.03):
    """Return (mark_slice, text_slice) for a left-mark / right-text lockup."""
    empty = col_gaps(mask)
    w = len(empty)
    runs, start = [], None
    for i, e in enumerate(empty):
        if e and start is None:
            start = i
        elif not e and start is not None:
            runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, w))
    # widest interior gap in the left 60% of the lockup
    inner = [r for r in runs if r[0] > w * 0.05 and r[1] < w * 0.75
             and (r[1] - r[0]) > w * min_gap_frac]
    if not inner:
        return None
    cut = max(inner, key=lambda r: r[1] - r[0])
    return (0, cut[0]), (cut[1], w)


def text_layer(text, font_path, size, ink, tracking=0.0, weight=None):
    font = ImageFont.truetype(font_path, size)
    if weight is not None:
        try:
            font.set_variation_by_axes([weight])
        except Exception:
            pass
    pad = size
    img = Image.new("RGBA", (int(size * len(text) * 1.2) + pad * 2, size * 3), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x = float(pad)
    y = size
    for ch in text:
        d.text((x, y), ch, font=font, fill=ink + (255,))
        x += d.textlength(ch, font=font) + tracking * size
    return trim(img)


def scale_to_h(im, h):
    if im.height == 0:
        return im
    w = max(1, round(im.width * h / im.height))
    return im.resize((w, int(h)), Image.LANCZOS)


def compose_row(parts, gap, canvas_h=CANVAS_H, baseline_mode="center"):
    """Lay parts left to right, vertically centred, on a transparent canvas."""
    w = sum(p.width for p in parts) + gap * (len(parts) - 1) + PAD_X * 2
    canvas = Image.new("RGBA", (int(w), canvas_h), (0, 0, 0, 0))
    x = PAD_X
    for p in parts:
        canvas.alpha_composite(p, (int(x), int((canvas_h - p.height) / 2)))
        x += p.width + gap
    return canvas


def square_mark(im, ink_px=MARK_PX, inset=MARK_INSET):
    im = trim(im)
    box = int(ink_px * inset)
    s = min(box / im.width, box / im.height)
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    canvas = Image.new("RGBA", (ink_px, ink_px), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((ink_px - im.width) // 2, (ink_px - im.height) // 2))
    return canvas


GEIST = os.path.join(FONTS, "geist-var.ttf")
SPACE_B = os.path.join(FONTS, "SpaceGrotesk-Bold.ttf")
OUTFIT_SB = os.path.join(FONTS, "Outfit-SemiBold.ttf")


def mask_binary_dark(im, thresh=0.45, soft=0.10):
    a = np.array(im).astype(np.float32) / 255.0
    lum = a[..., :3] @ np.array([0.2126, 0.7152, 0.0722])
    m = np.clip((thresh - lum) / soft + 0.5, 0, 1)
    return m * a[..., 3]


def mask_binary_light(im, thresh=0.62, soft=0.10):
    """Light art knocked out of a dark ground, hard-edged. The soft variant
    tracks the source's own luminance, so a mid-grey glyph comes out
    half-transparent; this one lands it at full ink."""
    a = np.array(im).astype(np.float32) / 255.0
    lum = a[..., :3] @ np.array([0.2126, 0.7152, 0.0722])
    m = np.clip((lum - thresh) / soft + 0.5, 0, 1)
    return m * a[..., 3]
