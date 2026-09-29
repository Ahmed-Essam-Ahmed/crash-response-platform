"""Fail if the basemap stops serving actual cartography.

A tile server that needs an API key still answers 200 with a small
placeholder image, so HTTP status and byte count alone both pass while
the map is useless. This reads the pixels instead: a placeholder is one
flat colour with a little text, a real tile is hundreds of colours.
"""

import io
import subprocess
import sys
import urllib.request


def load_image(raw):
    try:
        from PIL import Image
    except ImportError:
        raise SystemExit("Pillow is needed for this check: pip install pillow")
    return Image.open(io.BytesIO(raw)).convert("RGB")

SAMPLES = [
    (14, 9613, 6756),
    (15, 19226, 13513),
    (16, 38453, 27027),
]
URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

MIN_COLOURS = 60
MAX_DOMINANT = 0.85
MIN_BYTES = 8000


def check() -> int:
    failures = 0
    for z, x, y in SAMPLES:
        request = urllib.request.Request(URL.format(z=z, x=x, y=y), headers={"User-Agent": "crash-response-platform/1.0"})
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read()
        image = load_image(raw)
        colours = image.getcolors(maxcolors=200000)
        dominant = max(colours)[0] / (256 * 256)
        ok = len(raw) >= MIN_BYTES and len(colours) >= MIN_COLOURS and dominant <= MAX_DOMINANT
        print(
            f"z{z}: {len(raw):6d} bytes  {len(colours):4d} colours  dominant {dominant:.0%}  "
            f"{'ok' if ok else 'PLACEHOLDER, NOT A MAP'}"
        )
        if not ok:
            failures += 1
    return failures


if __name__ == "__main__":
    failed = check()
    print("basemap looks healthy" if not failed else f"{failed} zoom level(s) are not serving a map")
    sys.exit(1 if failed else 0)
