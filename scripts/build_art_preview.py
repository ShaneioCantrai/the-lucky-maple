from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "img" / "web"
OUT = ROOT / "img" / "previews"
OUT.mkdir(parents=True, exist_ok=True)

canvas = Image.open(WEB / "scene" / "background-autumn-lake.webp").convert("RGBA")
W, H = canvas.size


def layer(path: str, width: int, cx: int, bottom: int, opacity: float = 1.0):
    global canvas
    image = Image.open(WEB / path).convert("RGBA")
    ratio = width / image.width
    height = round(image.height * ratio)
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    if opacity < 1:
        alpha = image.getchannel("A").point(lambda a: round(a * opacity))
        image.putalpha(alpha)
    x = round(cx - width / 2)
    y = bottom - height
    canvas.alpha_composite(image, (x, y))
    return (x, y, width, height)
# Tree layers are intentionally oversized relative to the hero.
layer("tree/canopy-back.webp", 940, W // 2, 660, 0.98)
layer("tree/canopy-mid.webp", 900, W // 2, 655, 0.92)
layer("tree/tree-trunk.webp", 440, W // 2, 805, 1.0)
layer("tree/canopy-front.webp", 860, W // 2, 650, 0.82)

# Small perched bird, placed on the right side of the canopy.
bird = Image.open(WEB / "critters" / "bird-chickadee.webp").convert("RGBA")
bird_w = 120
bird_h = round(bird.height * bird_w / bird.width)
bird = bird.resize((bird_w, bird_h), Image.Resampling.LANCZOS)
canvas.alpha_composite(bird, (1085, 360))

# Foreground frame sits over the lower edge, hiding hard layer joins.
fg = Image.open(WEB / "scene" / "foreground-foliage.webp").convert("RGBA")
fg_w = W
fg_h = round(fg.height * fg_w / fg.width)
fg = fg.resize((fg_w, fg_h), Image.Resampling.LANCZOS)
canvas.alpha_composite(fg, (0, H - fg_h))

out = OUT / "homepage-layer-composite-v1.png"
canvas.convert("RGB").save(out, quality=95)
print(out)
