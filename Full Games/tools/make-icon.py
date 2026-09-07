# Собирает icon.ico 256x256 из яблочной иконки игры.
# electron-builder не принимает 32x32.

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(__file__).resolve().parents[2] / "assets" / "image" / "apple-touch-icon.png"
OUT_DIR = ROOT / "build"
SIZES = (16, 24, 32, 48, 64, 128, 256)


def main() -> None:
    """Пишет PNG 256 и ICO со всеми стандартными размерами."""
    if not SRC.is_file():
        raise SystemExit("Нет исходника: " + str(SRC))
    base = Image.open(SRC).convert("RGBA")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    big = base.resize((256, 256), Image.Resampling.LANCZOS)
    big.save(OUT_DIR / "icon.png", "PNG")
    frames = [base.resize((s, s), Image.Resampling.LANCZOS) for s in reversed(SIZES)]
    frames[0].save(
        OUT_DIR / "icon.ico",
        format="ICO",
        append_images=frames[1:],
        sizes=[frame.size for frame in frames],
    )
    print("Записаны", OUT_DIR / "icon.ico", "и icon.png")


if __name__ == "__main__":
    main()
