"""Downscale generated terrain textures into web tiles.

Run with the project venv: .venv/Scripts/python.exe tools/process-backgrounds.py
Input:  .claude/image-probe/background-<name>.png (diffusion output)
Output: public/backgrounds/<name>.jpg (512x512 tiles)
"""
from pathlib import Path

from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[1]
INPUT_DIRECTORY = PROJECT_ROOT / ".claude" / "image-probe"
OUTPUT_DIRECTORY = PROJECT_ROOT / "public" / "backgrounds"
NAMES = ["jungle", "fields", "water"]
TILE_SIZE = 512


def main() -> None:
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    for name in NAMES:
        source_path = INPUT_DIRECTORY / f"background-{name}.png"
        if not source_path.exists():
            print(f"SKIP {name}: not generated")
            continue
        image = Image.open(source_path).convert("RGB")
        resized = image.resize((TILE_SIZE, TILE_SIZE), Image.LANCZOS)
        output_path = OUTPUT_DIRECTORY / f"{name}.jpg"
        resized.save(output_path, quality=84, optimize=True)
        print(f"OK {name}: -> {output_path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
