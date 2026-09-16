"""Cut the 4x3 MapleWish leaf atlas into transparent web sprites.

Dev dependency: pip install opencv-python-headless
The atlas includes soft coloured presentation backgrounds and labels, so alpha
trimming alone is not enough. GrabCut isolates the centred leaf in each cell.
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ATLAS = ROOT / "img" / "source" / "leaf-atlas-master.png"
OUT = ROOT / "img" / "web" / "leaves"
PREVIEW = ROOT / "img" / "previews" / "leaf-sprites-preview.png"

atlas = np.array(Image.open(ATLAS).convert("RGBA"))
height, width = atlas.shape[:2]
cell_w, cell_h = width // 4, height // 3
OUT.mkdir(parents=True, exist_ok=True)
def isolate(cell: np.ndarray) -> Image.Image:
    rgb = cv2.cvtColor(cell[:, :, :3], cv2.COLOR_RGB2BGR)
    mask = np.full(rgb.shape[:2], cv2.GC_PR_BGD, np.uint8)
    border = 8
    mask[:border, :] = cv2.GC_BGD
    mask[-border:, :] = cv2.GC_BGD
    mask[:, :border] = cv2.GC_BGD
    mask[:, -border:] = cv2.GC_BGD
    mask[18:max(19, cell.shape[0] - 42), 28:max(29, cell.shape[1] - 28)] = cv2.GC_PR_FGD
    bg_model = np.zeros((1, 65), np.float64)
    fg_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(rgb, mask, None, bg_model, fg_model, 8, cv2.GC_INIT_WITH_MASK)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    alpha_seed = np.where(cell[:, :, 3] > 80, 255, 0).astype(np.uint8)
    acount, alabels, astats, _ = cv2.connectedComponentsWithStats(alpha_seed, 8)
    if acount > 1:
        alpha_largest = 1 + np.argmax(astats[1:, cv2.CC_STAT_AREA])
        cutoff = astats[alpha_largest, cv2.CC_STAT_TOP] + astats[alpha_largest, cv2.CC_STAT_HEIGHT] + 4
        fg[min(cutoff, fg.shape[0]):, :] = 0
    count, labels, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    if count <= 1:
        raise RuntimeError("No leaf component found")
    largest = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    keep = np.where(labels == largest, 255, 0).astype(np.uint8)
    out = cell.copy()
    out[:, :, 3] = np.minimum(cell[:, :, 3], keep)
    ys, xs = np.where(keep > 0)
    pad = 8
    left = max(0, int(xs.min()) - pad)
    right = min(out.shape[1], int(xs.max()) + 1 + pad)
    top = max(0, int(ys.min()) - pad)
    bottom = min(out.shape[0], int(ys.max()) + 1 + pad)
    return Image.fromarray(out[top:bottom, left:right])

sprites = []
for row in range(3):
    for col in range(4):
        index = row * 4 + col + 1
        x0, y0 = col * cell_w, row * cell_h
        x1 = width if col == 3 else (col + 1) * cell_w
        y1 = height if row == 2 else (row + 1) * cell_h
        sprite = isolate(atlas[y0:y1, x0:x1].copy())
        output = OUT / f"leaf-{index:02d}.webp"
        sprite.save(output, "WEBP", quality=94, method=6)
        sprites.append(sprite)
        print(f"wrote {output.relative_to(ROOT)} {sprite.width}x{sprite.height}")
tile_w, tile_h = 260, 220
preview = Image.new("RGBA", (tile_w * 4, tile_h * 3), (238, 235, 226, 255))
for i, sprite in enumerate(sprites):
    thumb = sprite.copy()
    thumb.thumbnail((220, 180), Image.Resampling.LANCZOS)
    x = (i % 4) * tile_w + (tile_w - thumb.width) // 2
    y = (i // 4) * tile_h + (tile_h - thumb.height) // 2
    preview.alpha_composite(thumb, (x, y))
PREVIEW.parent.mkdir(parents=True, exist_ok=True)
preview.convert("RGB").save(PREVIEW, "PNG")
print(f"wrote {PREVIEW.relative_to(ROOT)}")
