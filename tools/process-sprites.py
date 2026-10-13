"""Key black backgrounds to alpha, autocrop, and downscale generated sprites.

Run with the project venv: .venv/Scripts/python.exe .claude/scripts/process-sprites.py
Input:  .claude/image-probe/<name>.png (diffusion output on pure black)
Output: public/sprites/<name>.png (transparent, web-sized)
"""
from pathlib import Path

from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[1]
INPUT_DIRECTORY = PROJECT_ROOT / ".claude" / "image-probe"
OUTPUT_DIRECTORY = PROJECT_ROOT / "public" / "sprites"

TARGET_WIDTHS = {
    "player": 170,
    "fighter": 165,
    "dive-bomber": 165,
    "ace": 155,
    "bomber": 250,
    "boss": 350,
    "tank": 115,
    "flak-site": 125,
}


def key_black_to_alpha(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            red, green, blue, _alpha = pixels[x, y]
            brightest = max(red, green, blue)
            if brightest < 14:
                alpha = 0
            elif brightest < 64:
                alpha = int((brightest - 14) / 50 * 255)
            else:
                alpha = 255
            pixels[x, y] = (red, green, blue, alpha)
    return rgba


def main() -> None:
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    for name, target_width in TARGET_WIDTHS.items():
        source_path = INPUT_DIRECTORY / f"{name}.png"
        if not source_path.exists():
            print(f"SKIP {name}: not generated yet")
            continue
        image = Image.open(source_path)
        keyed = key_black_to_alpha(image)
        bounding_box = keyed.getbbox()
        if bounding_box is None:
            print(f"FAIL {name}: fully transparent after keying")
            continue
        cropped = keyed.crop(bounding_box)
        scale = target_width / cropped.width
        target_height = max(1, round(cropped.height * scale))
        resized = cropped.resize((target_width, target_height), Image.LANCZOS)
        output_path = OUTPUT_DIRECTORY / f"{name}.png"
        resized.save(output_path, optimize=True)
        print(f"OK {name}: {cropped.width}x{cropped.height} -> {target_width}x{target_height}, {output_path.stat().st_size} bytes")


if __name__ == "__main__":
    main()
