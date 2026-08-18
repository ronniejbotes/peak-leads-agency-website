# Client logo set

Generates the thirteen PNGs in `public/assets/logos/` that the `#network`
section uses — the marquee strip along the bottom and the four marks orbiting
the revenue counter.

## Why these are generated rather than dropped in

Nine clients, nine unrelated brands: a full-colour cartoon, a two-line teal
lockup, a hairline serif, a white knockout wordmark. Pasted straight onto the
cream strip they look like a ransom note. The generator silhouettes each one to
a single ink and sizes it **optically** — a blend of ink height and ink area —
so a stacked lockup and a long thin serif carry the same visual weight at the
same canvas height. That is the whole trick; everything else is plumbing.

## Where each logo came from

Seven of the nine are the client's own artwork, pulled from their live site by
`fetch.sh`. Two are set in type, and it is worth being precise about which.

| Client | Source | Treatment |
|---|---|---|
| Cognexa | `assets/icons/favicon.svg` from cognexa.co.za | Real node mark + "Cognexa" set in Space Grotesk, the display face their own site sets the brand in. They have no wordmark image — the header is live text. |
| Water Automation | `water-automation-logo-final.png` | Their lockup, silhouetted. |
| The Leak Geeks | — | **Set in Geist.** Their logo is a full-colour cartoon badge; a single-ink silhouette of it is an unreadable blob. |
| GreaterGood | `long_logo.svg` | Their wordmark, recoloured from white. |
| Tiny Homes SA | `images/brand/logo.png` | Their lockup, silhouetted. Their artwork reads "TINY HOMES"; the strip's alt text carries the full "Tiny Homes SA". |
| Cajee Botes | — | **Set in Geist.** Their only logo is an illustrated roundel of a prosthetic hand — no wordmark, and it silhouettes to a filled circle. |
| Position Xero | `img/icon-192.png` (mark only) | Their brand *is* a text wordmark; set in Outfit, the face their own site loads. The orbit mark is their app icon, re-inked with the X knocked out. |
| Otaku Kulture | `w-Otaku_Kulture_logo.png` | Their lockup, silhouetted from the white variant. |
| D&D Luxury | `dnd_logo_svg_new.svg` | Their wordmark, recoloured from white. |

**The two "set in Geist" entries are house renditions, not the client's logo.**
If either sends through real artwork, drop it in `src/`, add it to `fetch.sh`
and `gen.py`, and re-run — that is the whole reason this is a script.

## Output

| File | Size | Used by |
|---|---|---|
| `<client>.png` | canvas 168px tall, width varies | `.ticker-track li img` — rendered at 56px |
| `<client>-mark.png` | 256×256 | `.orbit-face.is-logo` — rendered at 58–88px |

Ink is `#4A443A` for the strip (`--text-2` in `.theme-day`) and `#2E2A22` for
the orbit marks, which sit smaller and need the extra contrast. Both are baked
in, so the PNGs only work on the daylight half of the page — which is the only
place they appear.

Canvas height is uniform on purpose: the CSS sets `height` and lets width run
free, so all the optical balancing survives into the browser. Setting a width
in CSS instead would undo it.

## Regenerating

```sh
pip install pillow cairosvg numpy fonttools brotli
bash tools/logos/fetch.sh          # client artwork -> tools/logos/src
python tools/logos/gen.py          # -> tools/logos/out/{wordmarks,marks}
```

`gen.py` writes to `tools/logos/out/`. Copying into `public/assets/logos/`
posterises the alpha to 32 levels and saves optimised — 13 files, ~61 KB total.

`gen.py` also needs four fonts in `tools/logos/fonts/`, none of which are
committed:

| File | Source |
|---|---|
| `geist-var.ttf` | `node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2`, converted with fontTools |
| `SpaceGrotesk-Bold.ttf` | Google Fonts |
| `Outfit-SemiBold.ttf` | Google Fonts |
| `geist-mono-var.ttf` | as Geist, from `@fontsource-variable/geist-mono` (unused at present) |

## Hosting note

Hostinger's CDN serves a replaced asset's old bytes for up to 7 days. If a logo
changes, ship it under a new filename rather than overwriting.
