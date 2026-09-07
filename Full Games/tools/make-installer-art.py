# Описание: рисует заглушки баннеров MSI, если файлов ещё нет.

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "assets" / "install"
SRC_ICON = ROOT / "assets" / "image" / "apple-touch-icon.png"
BG = (18, 12, 20, 255)
GOLD = (232, 162, 58, 255)
INK = (232, 224, 214, 255)
MUTE = (160, 148, 140, 255)


def font(size: int) -> ImageFont.ImageFont:
    """Системный шрифт для подписи размера."""
    for name in ("segoeui.ttf", "arial.ttf", "C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/arial.ttf"):
        path = Path(name)
        if path.is_file():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def paint_stub(width: int, height: int, title: str, spec: str) -> Image.Image:
    """Тёмная плашка с размером кадра — чтобы сразу было видно, что это макет."""
    img = Image.new("RGBA", (width, height), BG)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, width - 1, height - 1), outline=GOLD)
    draw.line((0, 0, width, 8), fill=GOLD)
    body = font(max(12, min(22, height // 3)))
    small = font(max(10, min(14, height // 4)))
    draw.text((12, max(4, height // 2 - 16)), title, fill=GOLD, font=body)
    draw.text((12, max(4, height // 2 + 8)), spec, fill=INK, font=small)
    if height > 80:
        draw.text((12, height - 22), "заглушка · замени файл", fill=MUTE, font=small)
    return img.convert("RGB")


def write_bmp(name: str, width: int, height: int, title: str) -> None:
    """BMP 24 бит без альфы — так хочет WiX."""
    path = OUT / name
    if path.is_file():
        return
    paint_stub(width, height, title, f"{width} × {height} px · BMP").save(path, "BMP")
    print("Заглушка:", path)


def write_ico(name: str, size: int, title: str) -> None:
    """Квадратная ICO-заглушка."""
    path = OUT / name
    if path.is_file():
        return
    img = paint_stub(size, size, title, f"{size}×{size}")
    img.save(path, "ICO", sizes=[(size, size)])
    print("Заглушка:", path)


def write_app_icon() -> None:
    """ICO ярлыка: игра, если есть яблоко, иначе квадрат."""
    path = OUT / "icon.ico"
    if path.is_file():
        return
    sizes = (16, 24, 32, 48, 64, 128, 256)
    if SRC_ICON.is_file():
        base = Image.open(SRC_ICON).convert("RGBA")
    else:
        base = paint_stub(256, 256, "KV", "256").convert("RGBA")
    frames = [base.resize((s, s), Image.Resampling.LANCZOS) for s in reversed(sizes)]
    frames[0].save(path, format="ICO", append_images=frames[1:], sizes=[f.size for f in frames])
    print("Заглушка:", path)


def main() -> None:
    """Пишет набор файлов из README, не затирая уже готовый арт."""
    OUT.mkdir(parents=True, exist_ok=True)
    write_bmp("banner.bmp", 493, 58, "banner")
    write_bmp("dialog.bmp", 493, 312, "dialog")
    write_app_icon()
    write_ico("exclamation.ico", 32, "!")
    write_ico("info.ico", 32, "i")
    write_ico("newfolder.ico", 16, "+")
    write_ico("upfolder.ico", 16, "^")


if __name__ == "__main__":
    main()
