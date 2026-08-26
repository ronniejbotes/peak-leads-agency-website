#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Peak Leads - tools/team-photos.py

Turns a raw headshot into the two files the /about/ team web needs:

    public/assets/images/team-<slug>-avatar.webp   480x480   the orbiting circle
    public/assets/images/team-<slug>.webp          600x750   the detail panel

Run it with no arguments to rebuild everyone listed in CROPS:

    python tools/team-photos.py

Or point it at one person while you are dialling a crop in:

    python tools/team-photos.py ronnie

To add someone new:

 1. Drop their headshot(s) anywhere in the repo root.
 2. Run `python tools/team-photos.py --measure "Their Headshot.png"`. It prints
    the skin-tone bounding box, which is a good first guess at where the face
    sits. A wide shot with visible hands or chest will over-report, so treat it
    as a starting point, not an answer.
 3. Add an entry to CROPS below and run the script.
 4. Check tools/.preview-<slug>.png. The avatar is previewed already masked
    into a circle, because a crop that looks fine as a square regularly puts
    the face low and to one side once the circle clips the corners.

Crop boxes are (left, top, right, bottom) in the SOURCE image's own pixels.
The avatar box must be square and the panel box must be 4:5; the script
refuses anything else rather than quietly squashing a face.
"""

import os
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'public', 'assets', 'images')
PREVIEW_DIR = os.path.dirname(os.path.abspath(__file__))

AVATAR_PX = 480          # square, rendered as a circle in the web
PANEL_W, PANEL_H = 600, 750   # 4:5, rendered in the detail panel
QUALITY = 86

# slug -> (avatar source, avatar box, panel source, panel box[, pad_top])
#
# pad_top is (avatar_pad, panel_pad) and extends the SOURCE upward before
# cropping, by mirroring its own top rows. It buys headroom for a frame that
# starts with hair already touching the edge. Boxes for a padded source are
# measured in the PADDED image's coordinates.
#
# The mirror is only clean where the rows it copies are pure backdrop, so keep
# the crop above the point where the mirrored hair starts, and pad the two
# outputs independently - a pad that works inside a circle will often show an
# upside-down fringe across the top of the full-width panel.
# Two sources are allowed because a tight head-and-shoulders frame makes the
# better circle while a wider frame makes the better panel portrait.
CROPS = {
    'bradley': (
        'hf_20260825_233021_166bc014-46ff-450b-9eae-48af36078758.png', (78, 0, 698, 620),
        'hf_20260825_233020_f65f3ec4-f1cc-4dc4-b64f-2c6b28e562c7.png', (69, 40, 709, 840),
    ),
    # Head measures x 400-1010, y 330-1090, so it centres on (705, 710) - well
    # left of the frame's middle, because she is turned toward the camera. The
    # square is 1150 rather than the ~1000 that would match the others' head
    # ratio: her hair is wide, so an equal ratio reads noticeably tighter.
    'anri': (
        'Anri Hartmann Headshot 2.png', (130, 135, 1280, 1285),
        'Anri Hartmann Headshot 2.png', (205, 120, 1205, 1370),
    ),
    'keegan': (
        'Keegan Headshot 2.png', (235, 90, 855, 710),
        'Keegan Headshot 2.png', (195, 90, 895, 965),
    ),
    # His hair starts at y=30, with no headroom at all. The circle borrows 90px
    # of mirrored backdrop and crops from y=60, so it only ever uses the clean
    # rows above the hair. The panel takes no pad: across the full width the
    # mirrored curls read as a smear, so it keeps the tight original top.
    'jesse': (
        'Jesse Agulhas Headshot 2.png', (125, 60, 725, 660),
        'Jesse Agulhas Headshot 2.png', (125, 0, 725, 750),
        (90, 0),
    ),
}


def measure(path):
    """Print the skin-tone bounding box, as a first guess at the face."""
    import numpy as np
    im = Image.open(os.path.join(ROOT, path)).convert('RGB')
    a = np.asarray(im).astype(int)
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    skin = (R > 95) & (G > 40) & (B > 20) & (R > G) & (G > B) & ((a.max(2) - a.min(2)) > 15)
    ys, xs = np.nonzero(skin)
    if not len(xs):
        print('%s: no skin tones found' % path)
        return
    x1, x2 = np.percentile(xs, [2, 98])
    y1, y2 = np.percentile(ys, [2, 98])
    print('%s  %dx%d' % (path, im.size[0], im.size[1]))
    print('  skin bbox  x %d-%d  y %d-%d   centre (%d, %d)'
          % (x1, x2, y1, y2, (x1 + x2) / 2, (y1 + y2) / 2))


def check(box, want_ratio, label, slug):
    w, h = box[2] - box[0], box[3] - box[1]
    if w <= 0 or h <= 0:
        raise SystemExit('%s: %s box is empty' % (slug, label))
    ratio = w / float(h)
    if abs(ratio - want_ratio) > 0.01:
        raise SystemExit('%s: %s box is %d x %d (%.3f), expected ratio %.3f'
                         % (slug, label, w, h, ratio, want_ratio))


def pad_top_of(im, pad):
    if not pad:
        return im
    strip = im.crop((0, 0, im.size[0], pad)).transpose(Image.FLIP_TOP_BOTTOM)
    out = Image.new('RGB', (im.size[0], im.size[1] + pad))
    out.paste(strip, (0, 0))
    out.paste(im, (0, pad))
    return out


def load(src, pad):
    return pad_top_of(Image.open(os.path.join(ROOT, src)).convert('RGB'), pad)


def build(slug):
    entry = CROPS[slug]
    avatar_src, avatar_box, panel_src, panel_box = entry[:4]
    pad = entry[4] if len(entry) > 4 else (0, 0)
    if isinstance(pad, int):
        pad = (pad, pad)
    avatar_pad, panel_pad = pad
    check(avatar_box, 1.0, 'avatar', slug)
    check(panel_box, PANEL_W / float(PANEL_H), 'panel', slug)

    for src in (avatar_src, panel_src):
        if not os.path.exists(os.path.join(ROOT, src)):
            raise SystemExit('%s: source not found: %s' % (slug, src))

    avatar = load(avatar_src, avatar_pad).crop(avatar_box).resize((AVATAR_PX, AVATAR_PX), Image.LANCZOS)
    panel = load(panel_src, panel_pad).crop(panel_box).resize((PANEL_W, PANEL_H), Image.LANCZOS)

    a_path = os.path.join(OUT_DIR, 'team-%s-avatar.webp' % slug)
    p_path = os.path.join(OUT_DIR, 'team-%s.webp' % slug)
    avatar.save(a_path, 'WEBP', quality=QUALITY, method=6)
    panel.save(p_path, 'WEBP', quality=QUALITY, method=6)

    # Preview the avatar the way it actually renders: clipped to a circle.
    mask = Image.new('L', avatar.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, AVATAR_PX - 1, AVATAR_PX - 1), fill=255)
    circle = Image.new('RGB', avatar.size, (17, 23, 37))
    circle.paste(avatar, (0, 0), mask)
    sheet = Image.new('RGB', (AVATAR_PX + 40 + PANEL_W, PANEL_H), (17, 23, 37))
    sheet.paste(circle, (0, (PANEL_H - AVATAR_PX) // 2))
    sheet.paste(panel, (AVATAR_PX + 40, 0))
    sheet.save(os.path.join(PREVIEW_DIR, '.preview-%s.png' % slug))

    print('%-9s avatar %5.1f kB   panel %5.1f kB'
          % (slug, os.path.getsize(a_path) / 1024.0, os.path.getsize(p_path) / 1024.0))


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--measure':
        for path in args[1:]:
            measure(path)
        raise SystemExit(0)

    wanted = args or sorted(CROPS)
    for slug in wanted:
        if slug not in CROPS:
            raise SystemExit('no crop defined for "%s" (have: %s)'
                             % (slug, ', '.join(sorted(CROPS))))
        build(slug)
