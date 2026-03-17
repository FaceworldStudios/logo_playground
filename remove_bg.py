#!/usr/bin/env python3
"""
Remove backgrounds from logo files using edge flood-fill.
Automatically detects background color from corners — handles white, orange, or any solid bg.
"""

from pathlib import Path
from PIL import Image
import numpy as np

LOGOS_DIR = Path(__file__).parent / "logos"
EXTS = {".png", ".jpg", ".jpeg", ".webp"}
TOLERANCE = 50  # color distance from detected bg color to count as background


def flood_fill_background(img: Image.Image, tolerance: int) -> Image.Image:
    """Remove background by flood-filling from all four edges."""
    img = img.convert("RGBA")
    data = np.array(img, dtype=np.float32)
    rgb = data[:, :, :3]
    h, w = rgb.shape[:2]

    # Sample many edge pixels to robustly estimate background color
    sample_pixels = np.concatenate([
        rgb[0, :],           # top row
        rgb[h-1, :],         # bottom row
        rgb[:, 0],           # left col
        rgb[:, w-1],         # right col
    ])
    bg_color = np.median(sample_pixels, axis=0)

    # Distance of each pixel from detected background color
    dist = np.sqrt(np.sum((rgb - bg_color) ** 2, axis=2))
    is_bg_candidate = dist < tolerance

    # BFS flood fill from all four edges
    visited = np.zeros((h, w), dtype=bool)
    queue = []

    for x in range(w):
        if is_bg_candidate[0, x] and not visited[0, x]:
            visited[0, x] = True
            queue.append((0, x))
        if is_bg_candidate[h-1, x] and not visited[h-1, x]:
            visited[h-1, x] = True
            queue.append((h-1, x))
    for y in range(h):
        if is_bg_candidate[y, 0] and not visited[y, 0]:
            visited[y, 0] = True
            queue.append((y, 0))
        if is_bg_candidate[y, w-1] and not visited[y, w-1]:
            visited[y, w-1] = True
            queue.append((y, w-1))

    idx = 0
    while idx < len(queue):
        y, x = queue[idx]
        idx += 1
        for dy, dx in ((-1,0),(1,0),(0,-1),(0,1)):
            ny, nx = y+dy, x+dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_bg_candidate[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))

    new_alpha = np.where(visited, 0, 255).astype(np.uint8)
    result = data.copy()
    result[:, :, 3] = new_alpha
    return Image.fromarray(result.astype(np.uint8), "RGBA")


if __name__ == "__main__":
    files = sorted(f for f in LOGOS_DIR.iterdir()
                   if f.suffix.lower() in EXTS and f.stem != "placeholder")

    print(f"Found {len(files)} images to process...\n")

    for i, src in enumerate(files, 1):
        out = src.with_suffix(".png")
        print(f"[{i}/{len(files)}] {src.name}", flush=True)

        img = Image.open(src)
        result = flood_fill_background(img, TOLERANCE)
        result.save(out, "PNG")

        if src != out:
            src.unlink()

    print("\nDone.")
