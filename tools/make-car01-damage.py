# Собирает слои повреждений 01_damage_1…6 под силуэт кузова 01.webp.
# Источник: ИИ-кадры + царапины и прогар по маске альфы.

from __future__ import annotations

import hashlib
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CAR = os.path.join(ROOT, 'assets', 'data', 'cars', '01', '01.webp')
OUT = os.path.join(ROOT, 'assets', 'data', 'cars', '01', 'damage')
SRC_DIR = os.path.join(
    os.path.expanduser('~'), '.cursor', 'projects', 'e-GAMES-Racing', 'assets'
)


def rng(level: int) -> random.Random:
    """Стабильный ГПСЧ на номер слоя."""
    h = hashlib.sha256(f'car01-dmg-{level}'.encode()).digest()
    return random.Random(int.from_bytes(h[:8], 'little'))


def opaque_bbox(im: Image.Image, thresh: int = 10):
    """Рамка непрозрачных пикселей."""
    a = im.split()[-1]
    box = a.point(lambda p: 255 if p > thresh else 0).getbbox()
    return box or (0, 0, im.width, im.height)


def key_black(im: Image.Image, thresh: int = 22) -> Image.Image:
    """Чёрный фон ИИ-кадра становится прозрачным."""
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8 or (r < thresh and g < thresh and b < thresh):
                px[x, y] = (0, 0, 0, 0)
    return im


def fit_to_bbox(src: Image.Image, dst: Image.Image) -> Image.Image:
    """Масштаб и посадка сгенерированного кузова в рамку оригинала."""
    sb = opaque_bbox(src, 12)
    db = opaque_bbox(dst, 8)
    sw, sh = sb[2] - sb[0], sb[3] - sb[1]
    dw, dh = db[2] - db[0], db[3] - db[1]
    if sw < 4 or sh < 4:
        return Image.new('RGBA', dst.size, (0, 0, 0, 0))
    crop = src.crop(sb)
    fitted = crop.resize((max(1, dw), max(1, dh)), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', dst.size, (0, 0, 0, 0))
    canvas.paste(fitted, (db[0], db[1]), fitted)
    return canvas


def mask_to_car(layer: Image.Image, car: Image.Image) -> Image.Image:
    """Обрезает слой силуэтом кузова."""
    out = Image.new('RGBA', car.size, (0, 0, 0, 0))
    out.paste(layer, (0, 0), layer)
    ca = car.split()[-1]
    r, g, b, a = out.split()
    a = Image.frombytes('L', out.size, bytes(
        min(pa, pc) for pa, pc in zip(a.tobytes(), ca.tobytes())
    ))
    out.putalpha(a)
    return out


def scratches(draw: ImageDraw.ImageDraw, box, n: int, rnd: random.Random, col):
    """Царапины по кузову."""
    x0, y0, x1, y1 = box
    for _ in range(n):
        x = rnd.randint(x0, x1)
        y = rnd.randint(y0, y1)
        ang = rnd.uniform(-0.5, 0.5)
        ln = rnd.randint(8, 28)
        x2 = int(x + math.cos(ang) * ln)
        y2 = int(y + math.sin(ang) * ln)
        draw.line((x, y, x2, y2), fill=col, width=rnd.choice((1, 1, 2)))


def holes(draw: ImageDraw.ImageDraw, box, n: int, rnd: random.Random):
    """Дыры и ржавые кромки."""
    x0, y0, x1, y1 = box
    for _ in range(n):
        x = rnd.randint(x0 + 8, x1 - 8)
        y = rnd.randint(y0 + 8, y1 - 8)
        r = rnd.randint(2, 6)
        draw.ellipse((x - r - 1, y - r - 1, x + r + 1, y + r + 1), fill=(90, 42, 18, 200))
        draw.ellipse((x - r, y - r, x + r, y + r), fill=(18, 12, 10, 230))


def cracks(draw: ImageDraw.ImageDraw, box, n: int, rnd: random.Random):
    """Трещины стекла в зоне кабины."""
    x0, y0, x1, y1 = box
    cx = int(x0 + (x1 - x0) * 0.52)
    cy = int((y0 + y1) / 2)
    for _ in range(n):
        ang = rnd.uniform(0, math.tau)
        ln = rnd.randint(10, 26)
        draw.line(
            (cx, cy, int(cx + math.cos(ang) * ln), int(cy + math.sin(ang) * ln)),
            fill=(230, 236, 240, 180),
            width=1,
        )


def scorch(im: Image.Image, box, amount: float, rnd: random.Random) -> Image.Image:
    """Прогар капота справа (нос кузова)."""
    x0, y0, x1, y1 = box
    overlay = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    hx0 = int(x0 + (x1 - x0) * 0.55)
    for _ in range(int(4 + amount * 10)):
        x = rnd.randint(hx0, x1 - 4)
        y = rnd.randint(y0 + 6, y1 - 6)
        rx, ry = rnd.randint(10, 28), rnd.randint(6, 16)
        a = int(40 + amount * 90)
        d.ellipse((x - rx, y - ry, x + rx, y + ry), fill=(12, 8, 6, a))
        if amount > 0.55:
            d.ellipse((x - rx // 2, y - ry // 2, x + rx // 2, y + ry // 2), fill=(180, 70, 18, int(30 + amount * 50)))
    overlay = overlay.filter(ImageFilter.GaussianBlur(3))
    return Image.alpha_composite(im, overlay)


def blend_gen(car: Image.Image, gen: Image.Image, k: float) -> Image.Image:
    """Смешивает ИИ-кадр с оригиналом внутри силуэта."""
    out = car.copy()
    cp, gp = out.load(), gen.load()
    w, h = car.size
    for y in range(h):
        for x in range(w):
            cr, cg, cb, ca = cp[x, y]
            if ca < 12:
                continue
            gr, gg, gb, ga = gp[x, y]
            if ga < 20:
                continue
            t = k * (ga / 255.0)
            cp[x, y] = (
                int(cr * (1 - t) + gr * t),
                int(cg * (1 - t) + gg * t),
                int(cb * (1 - t) + gb * t),
                ca,
            )
    return out


def overlay_from(full: Image.Image, car: Image.Image) -> Image.Image:
    """Оставляет только разницу с целым кузовом, чтобы слой лёг поверх."""
    out = Image.new('RGBA', car.size, (0, 0, 0, 0))
    fp, cp, op = full.load(), car.load(), out.load()
    w, h = car.size
    for y in range(h):
        for x in range(w):
            fr, fg, fb, fa = fp[x, y]
            cr, cg, cb, ca = cp[x, y]
            if ca < 12 or fa < 12:
                continue
            d = abs(fr - cr) + abs(fg - cg) + abs(fb - cb)
            if d < 24:
                continue
            a = min(ca, min(255, 90 + d))
            op[x, y] = (fr, fg, fb, a)
    return out


def build_level(car: Image.Image, level: int, src_path: str | None) -> Image.Image:
    """Один слой повреждений 1…6."""
    rnd = rng(level)
    box = opaque_bbox(car)
    work = car.copy()
    k = 0.1 + level * 0.13
    if src_path and os.path.isfile(src_path):
        gen = Image.open(src_path).convert('RGBA')
        gen = key_black(gen)
        gen = fit_to_bbox(gen, car)
        gen = mask_to_car(gen, car)
        work = blend_gen(work, gen, k)
    if level >= 2:
        work = scorch(work, box, 0.1 + (level - 2) * 0.16, rnd)
    d = ImageDraw.Draw(work)
    scratches(d, box, 4 + level * 6, rnd, (28, 22, 18, 160))
    scratches(d, box, 2 + level * 3, rnd, (190, 196, 200, 90))
    if level >= 2:
        cracks(d, box, 3 + level * 3, rnd)
    if level >= 3:
        holes(d, box, 1 + level, rnd)
    work = mask_to_car(work, car)
    if level >= 5:
        work = ImageEnhance.Color(work).enhance(0.72)
        work = ImageEnhance.Brightness(work).enhance(0.82)
    return overlay_from(work, car)


def main() -> int:
    if not os.path.isfile(CAR):
        print('нет кузова', CAR, file=sys.stderr)
        return 1
    os.makedirs(OUT, exist_ok=True)
    car = Image.open(CAR).convert('RGBA')
    for lvl in range(1, 7):
        src = os.path.join(SRC_DIR, f'01_damage_{lvl}.png')
        layer = build_level(car, lvl, src)
        dest = os.path.join(OUT, f'01_damage_{lvl}.webp')
        layer.save(dest, 'WEBP', quality=92, method=6)
        print('записан', dest, layer.size)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
