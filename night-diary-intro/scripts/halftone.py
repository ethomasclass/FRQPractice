"""Turns the refugee photos into halftone dot grids (src/data/halftone.json).

The scene draws each grid as gold dots on navy (dot size from brightness), so the
crowds are made of the same dots as the particle flow they dissolve into.
Usage: python3 scripts/halftone.py
"""
import json, os
import numpy as np
from PIL import Image, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(ROOT, "public", "images", "originals")
OUT = os.path.join(ROOT, "src", "data", "halftone.json")

# Photos in the order they appear, with an optional crop (fractions: left, top, right, bottom).
PHOTOS = [
    ("refugees-train-punjab", (0.0, 0.0, 0.62, 1.0)),
    ("refugees-columns", (0.0, 0.38, 0.72, 1.0)),
    ("refugees-to-india", (0.0, 0.12, 0.75, 1.0)),
]
COLS = 120  # dots across


def main():
    grids = []
    for name, box in PHOTOS:
        path = os.path.join(ORIG, name + ".jpg")
        if not os.path.exists(path):
            print("missing", name)
            continue
        im = ImageOps.grayscale(Image.open(path))
        w, h = im.size
        im = im.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))
        im = ImageOps.autocontrast(im, cutoff=2).filter(ImageFilter.GaussianBlur(0.6))
        rows = round(COLS * im.height / im.width)
        small = np.asarray(im.resize((COLS, rows), Image.LANCZOS), dtype=np.float32) / 255
        grids.append({"name": name, "cols": COLS, "rows": rows, "v": [int(v * 99) for v in small.flatten()]})
        print(name, COLS, rows)
    json.dump(grids, open(OUT, "w"))


if __name__ == "__main__":
    main()
