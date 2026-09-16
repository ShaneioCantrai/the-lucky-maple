from __future__ import annotations

import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "img" / "source"
WEB = ROOT / "img" / "web"
ALPHA_THRESHOLD = 8
PADDING = 12
WEBP_QUALITY = 92

EXPORTS = {
    "background-autumn-lake-master.png": ("scene/background-autumn-lake.webp", False, [0.5, 0.5]),
    "tree-trunk-master.png": ("tree/tree-trunk.webp", True, [0.5, 1.0]),
    "canopy-back-master.png": ("tree/canopy-back.webp", True, [0.5, 0.85]),
    "canopy-mid-master.png": ("tree/canopy-mid.webp", True, [0.5, 0.85]),
    "canopy-front-master.png": ("tree/canopy-front.webp", True, [0.5, 0.85]),
    "bird-master.png": ("critters/bird-chickadee.webp", True, [0.5, 1.0]),
    "foreground-foliage-master.png": ("scene/foreground-foliage.webp", True, [0.5, 1.0]),
}

def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    return mask.getbbox()


def trim_alpha(image: Image.Image) -> tuple[Image.Image, tuple[int, int, int, int]]:
    width, height = image.size
    bbox = alpha_bbox(image)
    if not bbox:
        return image, (0, 0, width, height)
    left = max(0, bbox[0] - PADDING)
    top = max(0, bbox[1] - PADDING)
    right = min(width, bbox[2] + PADDING)
    bottom = min(height, bbox[3] + PADDING)
    crop = (left, top, right, bottom)
    return image.crop(crop), crop


def save_webp(image: Image.Image, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, "WEBP", quality=WEBP_QUALITY, method=6)

def process_standard_assets() -> dict[str, dict]:
    manifest: dict[str, dict] = {}
    for source_name, (output_rel, should_trim, pivot) in EXPORTS.items():
        source_path = SOURCE / source_name
        if not source_path.exists():
            print(f"skip missing: {source_name}")
            continue

        image = Image.open(source_path).convert("RGBA")
        source_size = list(image.size)
        crop = (0, 0, image.width, image.height)
        if should_trim:
            image, crop = trim_alpha(image)

        output_path = WEB / output_rel
        save_webp(image, output_path)
        manifest[output_rel] = {
            "source": str(source_path.relative_to(ROOT)).replace("\\", "/"),
            "sourceSize": source_size,
            "cropBox": list(crop),
            "outputSize": list(image.size),
            "pivot": pivot,
        }
        print(f"wrote {output_rel}: {image.width}x{image.height}")
    return manifest

def process_leaf_atlas(manifest: dict[str, dict]) -> None:
    atlas_path = SOURCE / "leaf-atlas-master.png"
    if not atlas_path.exists():
        print("leaf atlas not present; skipping 12-leaf slice")
        return

    atlas = Image.open(atlas_path).convert("RGBA")
    cols, rows = 4, 3
    cell_w = atlas.width // cols
    cell_h = atlas.height // rows
    for row in range(rows):
        for col in range(cols):
            index = row * cols + col + 1
            box = (col * cell_w, row * cell_h,
                   (col + 1) * cell_w, (row + 1) * cell_h)
            cell = atlas.crop(box)
            cell, local_crop = trim_alpha(cell)
            output_rel = f"leaves/leaf-{index:02d}.webp"
            output_path = WEB / output_rel
            save_webp(cell, output_path)
            manifest[output_rel] = {
                "source": "img/source/leaf-atlas-master.png",
                "atlasCell": [col, row],
                "cellBox": list(box),
                "localCropBox": list(local_crop),
                "outputSize": list(cell.size),
                "pivot": [0.5, 0.5],
            }
            print(f"wrote {output_rel}: {cell.width}x{cell.height}")

def main() -> None:
    WEB.mkdir(parents=True, exist_ok=True)
    manifest = process_standard_assets()
    process_leaf_atlas(manifest)
    manifest_path = WEB / "asset-manifest.json"
    manifest_path.write_text(
        json.dumps({"version": 1, "assets": manifest}, indent=2),
        encoding="utf-8",
    )
    print(f"wrote {manifest_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
