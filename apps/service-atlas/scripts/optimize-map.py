from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--height", type=int, default=1200)
    parser.add_argument("--quality", type=int, default=84)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.width <= 0 or args.height <= 0:
        raise SystemExit("optimized map width and height must be positive")
    if abs(args.width / args.height - 1.6) > 0.01:
        raise SystemExit("optimized map width and height must use an 8:5 aspect ratio")
    args.output.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(args.input) as source:
        image = source.convert("RGB")
        target_ratio = args.width / args.height
        source_ratio = image.width / image.height
        if source_ratio > target_ratio:
            crop_width = round(image.height * target_ratio)
            left = (image.width - crop_width) // 2
            image = image.crop((left, 0, left + crop_width, image.height))
        elif source_ratio < target_ratio:
            crop_height = round(image.width / target_ratio)
            top = (image.height - crop_height) // 2
            image = image.crop((0, top, image.width, top + crop_height))
        image.thumbnail((args.width, args.height), Image.Resampling.LANCZOS)
        image.save(args.output, "WEBP", quality=args.quality, method=6)

    with Image.open(args.output) as result:
        if result.format != "WEBP":
            raise SystemExit("optimized map is not WebP")
        if result.width < 1400 or result.height < 850:
            raise SystemExit(f"optimized map is too small: {result.size}")
        if abs(result.width / result.height - 1.6) > 0.01:
            raise SystemExit(f"optimized map must use an 8:5 aspect ratio: {result.size}")


if __name__ == "__main__":
    main()
