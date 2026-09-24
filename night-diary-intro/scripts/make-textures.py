"""Generates the paper texture and film-grain tiles in public/images/textures/ (original, CC0)."""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "images", "textures")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(15)

# Paper: soft mottling plus short fibres, as a grey multiply layer (white = no change).
n = 1024
mottle = Image.fromarray((rng.random((n // 16, n // 16)) * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)
mottle = np.asarray(mottle.filter(ImageFilter.GaussianBlur(18)), dtype=np.float32) / 255
fine = np.asarray(Image.fromarray((rng.random((n, n)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255
fibres = Image.new("L", (n, n), 0)
from PIL import ImageDraw
d = ImageDraw.Draw(fibres)
for _ in range(900):
    x, y = rng.uniform(0, n, 2)
    a = rng.uniform(0, np.pi)
    l = rng.uniform(6, 26)
    d.line([(x, y), (x + np.cos(a) * l, y + np.sin(a) * l)], fill=int(rng.uniform(40, 110)), width=1)
fibres = np.asarray(fibres.filter(ImageFilter.GaussianBlur(0.6)), dtype=np.float32) / 255
paper = 1 - (0.07 * mottle + 0.05 * fine + 0.12 * fibres)
Image.fromarray((np.clip(paper, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, "paper.png"))

# Film grain: mid-grey noise tiles for an overlay blend, a few frames to cycle through.
for i in range(8):
    g = rng.normal(0.5, 0.16, (580, 1000))
    img = Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5))
    img.save(os.path.join(OUT, f"grain-{i}.png"))
print("textures written")
