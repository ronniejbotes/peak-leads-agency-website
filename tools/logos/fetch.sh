#!/usr/bin/env bash
# Pull the nine clients' own logo artwork from their live sites into ./src.
# Re-run this before gen.py if a client rebrands. Every URL below was checked
# by hand against the live page it appears on.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p src
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

get() {  # get <outfile> <url>
  curl -sSL -A "$UA" -m 30 -o "src/$1" "$2"
  printf '%-26s %8s bytes\n' "$1" "$(wc -c < "src/$1")"
}

# --- artwork used as-is (silhouetted, then recoloured to one ink) -----------
get waterautomation.png    "https://www.waterautomation.com/wp-content/uploads/2025/02/water-automation-logo-final.png"
get greatergood.svg        "https://greatergood.co/wp-content/uploads/2025/08/long_logo.svg"
get otakukulture.png       "https://otakukulture.co.za/cdn/shop/files/w-Otaku_Kulture_logo.png?v=1731435496&width=660"
get dndlux.svg             "https://dndlux.com/cdn/shop/files/dnd_logo_svg_new.svg?v=1770897170&width=600"
get tinyhomes-full.png     "https://www.tinyhomesa.com/images/brand/logo.png"

# --- marks only; their wordmark is set in the brand's own typeface ----------
get cognexa-fav.svg        "https://www.cognexa.co.za/assets/icons/favicon.svg"
get positionxero.png       "https://www.positionxero.com/img/icon-192.png"

# The Leak Geeks and Cajee Botes are deliberately NOT fetched - see README.

# Pillow cannot open .webp reliably across versions in this pipeline, and the
# Tiny Homes source is a PNG already, so the only normalising step is a
# consistent .conv.png name for anything that needed converting.
python - <<'PY'
from PIL import Image
Image.open("src/tinyhomes-full.png").convert("RGBA").save("src/tinyhomes-full.conv.png")
print("tinyhomes-full.conv.png written")
PY
