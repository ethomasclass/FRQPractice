"""Removes backgrounds from the leader portraits (rembg) and builds the stamp artwork.

For each portrait in public/images/originals/<name>.jpg this writes:
  public/images/cutouts/<name>.png        full transparent cutout (grayscale)
  public/images/stamps/<name>-duotone.png  head-and-shoulders crop, navy→cream duotone, transparent
Usage: python3 scripts/cutouts.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter, ImageOps
from rembg import new_session, remove

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "public", "images")
NAVY = np.array([10, 32, 56], dtype=np.float32)
CREAM = np.array([246, 239, 226], dtype=np.float32)

# Head-and-shoulders crop boxes as fractions of the original (left, top, right, bottom).
CROPS = {
    "gandhi": (0.04, 0.0, 0.96, 0.66),
    "nehru": (0.12, 0.02, 0.92, 0.46),
    "jinnah": (0.0, 0.0, 1.0, 1.0),
    "mountbatten": (0.12, 0.06, 0.98, 0.62),
}


# Model per portrait (the human-segmentation model keeps Gandhi's white shawl intact).
MODELS = {"gandhi": "u2net_human_seg"}
# Extra contrast for faded prints: (autocontrast cutoff %, gamma).
TONE = {"nehru": (4, 1.25)}


def main():
    sessions = {}
    os.makedirs(os.path.join(IMG, "cutouts"), exist_ok=True)
    os.makedirs(os.path.join(IMG, "stamps"), exist_ok=True)
    for name, box in CROPS.items():
        src = Image.open(os.path.join(IMG, "originals", name + ".jpg")).convert("RGB")
        model = MODELS.get(name, "isnet-general-use")
        sessions.setdefault(model, new_session(model))
        cut = remove(src, session=sessions[model], post_process_mask=True)  # RGBA
        gray = ImageOps.grayscale(cut.convert("RGB"))
        alpha = cut.getchannel("A")
        full = Image.merge("LA", (gray, alpha))
        full.save(os.path.join(IMG, "cutouts", name + ".png"))

        w, h = src.size
        crop_box = (int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h))
        cutoff, gamma = TONE.get(name, (1, 1.0))
        g = ImageOps.autocontrast(gray.crop(crop_box), cutoff=cutoff)
        a = alpha.crop(crop_box).filter(ImageFilter.GaussianBlur(0.8))
        # Duotone: navy in the shadows, cream in the highlights (slight midtone lift).
        t = (np.asarray(g, dtype=np.float32) / 255) ** (0.85 * gamma)
        rgb = NAVY[None, None, :] * (1 - t[..., None]) + CREAM[None, None, :] * t[..., None]
        out = Image.fromarray(np.concatenate([rgb, np.asarray(a, dtype=np.float32)[..., None]], axis=2).astype(np.uint8), "RGBA")
        out.thumbnail((900, 900), Image.LANCZOS)
        out.save(os.path.join(IMG, "stamps", name + "-duotone.png"))
        print(name, out.size)


if __name__ == "__main__":
    main()
