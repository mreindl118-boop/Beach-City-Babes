#!/usr/bin/env python3
"""Render the peach-butt app icon PNGs (192, 512, maskable-512) with Pillow.

The SVG (icons/icon.svg) is the design source; this script redraws the same
peach with Pillow primitives so no SVG rasterizer is needed in CI/dev boxes.
Run from the repo root:  python3 tools/make_icons.py
"""
from PIL import Image, ImageDraw
import math
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
BASE = 512


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def vertical_gradient(draw, box, top, bottom, radius=0):
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        t = (y - y0) / max(1, (y1 - y0))
        draw.line([(x0, y), (x1, y)], fill=lerp(top, bottom, t))


def rounded_mask(size, radius):
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def radial_cheek(size, cx, cy, rx, ry, inner, outer):
    """Ellipse filled with a soft radial gradient, returned as RGBA layer."""
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    steps = 48
    for i in range(steps, 0, -1):
        t = i / steps
        col = lerp(inner, outer, t)
        d.ellipse([cx - rx * t, cy - ry * t, cx + rx * t, cy + ry * t], fill=col + (255,))
    return layer


def sparkle(d, cx, cy, r, color):
    pts = []
    for i in range(8):
        ang = i * math.pi / 4
        rad = r if i % 2 == 0 else r * 0.38
        pts.append((cx + rad * math.sin(ang), cy - rad * math.cos(ang)))
    d.polygon(pts, fill=color)


def draw_icon(maskable=False):
    img = Image.new('RGBA', (BASE, BASE), (0, 0, 0, 0))
    bg = Image.new('RGB', (BASE, BASE))
    vertical_gradient(ImageDraw.Draw(bg), (0, 0, BASE, BASE), (255, 209, 102), (255, 106, 136))
    img.paste(bg, (0, 0))
    d = ImageDraw.Draw(img)

    # peach sits smaller on maskable icons (safe zone)
    s = 0.78 if maskable else 1.0
    def S(v):  # scale around center
        return 256 + (v - 256) * s

    # sun
    d.ellipse([S(210), S(72), S(302), S(164)], fill=(255, 243, 196, 230))
    # leaf & stem
    d.polygon([(S(256), S(152)), (S(250), S(120)), (S(262), S(104)), (S(284), S(100)),
               (S(282), S(126)), (S(272), S(146))], fill=(87, 181, 107))
    d.polygon([(S(236), S(116)), (S(248), S(140)), (S(256), S(158)), (S(244), S(160)),
               (S(238), S(140))], fill=(122, 82, 48))

    # cheeks (the money shot)
    left = radial_cheek(BASE, S(182), S(290), 118 * s, 128 * s, (255, 196, 163), (244, 113, 95))
    right = radial_cheek(BASE, S(330), S(290), 118 * s, 128 * s, (255, 201, 171), (244, 122, 102))
    img.alpha_composite(left)
    img.alpha_composite(right)
    d = ImageDraw.Draw(img)

    # cleft
    for w, col, a in [(26, (224, 90, 78), 140), (10, (201, 74, 68), 180)]:
        d.line([(S(256), S(176)), (S(250), S(250)), (S(250), S(330)), (S(256), S(396))],
               fill=col + (a,), width=int(w * s), joint='curve')

    # blush
    d.ellipse([S(100), S(282), S(160), S(318)], fill=(255, 93, 143, 128))
    d.ellipse([S(352), S(282), S(412), S(318)], fill=(255, 93, 143, 128))
    # shine
    d.ellipse([S(118), S(212), S(184), S(250)], fill=(255, 255, 255, 140))
    # smile
    d.arc([S(196), S(300), S(316), S(376)], start=20, end=160, fill=(166, 61, 56, 210),
          width=int(12 * s))

    # sparkles
    sparkle(d, S(96), S(150), 22 * s, (255, 255, 255, 240))
    sparkle(d, S(416), S(168), 16 * s, (255, 255, 255, 230))
    sparkle(d, S(420), S(400), 19 * s, (255, 233, 168, 240))

    if not maskable:
        img.putalpha(rounded_mask(BASE, 112))
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    icon = draw_icon(maskable=False)
    icon.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, 'icon-192.png'))
    icon.save(os.path.join(OUT, 'icon-512.png'))
    draw_icon(maskable=True).save(os.path.join(OUT, 'icon-maskable-512.png'))
    print('icons written to', os.path.abspath(OUT))


if __name__ == '__main__':
    main()
