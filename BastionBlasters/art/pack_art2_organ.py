"""pack_art2: UA-15 Himmelsorgel (Sky Organ) - Pfeifenorgel auf Wolken, ein Rohr hustet."""
from __future__ import annotations

from pixl import *
from pack_art2_kit import *


def _pipe(c, cx, top, bot, ramp='gold', w=4, mouth=True, shift=0):
    """Orgelpfeife (Suedansicht): Zylinder mit Schattenspalten, dunkler Oeffnung oben und Labium"""
    cols = [5, 4, 3, 2]
    x0 = cx - w // 2
    for y in range(top, bot + 1):
        sx = shift if y < top + 7 else 0
        for i in range(w):
            idx = cols[i]
            if (y - top) % 6 == 5:
                idx = max(1, idx - 1)
            c.put_ramp(x0 + i + sx, y, ramp, idx)
    for i in range(1, w - 1):
        c.put_ramp(x0 + i + shift, top, 'coal', 1)
    c.put_ramp(x0 + shift, top, ramp, 5)
    if mouth:
        my = bot - 6
        for i in range(0, w):
            c.put_ramp(x0 + i, my, ramp, 5 if i < 2 else 4)
        for i in range(1, w - 1):
            c.put_ramp(x0 + i, my + 1, 'coal', 1)
            c.put_ramp(x0 + i, my + 2, 'coal', 2)
    for i in range(w):
        c.put_ramp(x0 + i, bot, ramp, 1)


def spr_sky_organ(anim='idle', f=0):
    c = Canvas(56, 56)
    base = 34
    # hintere Pfeifenreihe (Silber), kuerzer, zwischen den Goldpfeifen
    for cx, h in ((10, 11), (17, 17), (25, 22), (32, 22), (40, 17), (47, 10)):
        _pipe(c, cx, base - h, base - 1, 'metal', 4, mouth=False)
    # Goldpfeifen (Bogen: Mitte am hoechsten), eine hustet (verbogen)
    heights = [(7, 11), (12, 16), (17, 21), (22, 26), (28, 30), (33, 26), (38, 20), (43, 15), (48, 10)]
    for k, (cx, h) in enumerate(heights):
        _pipe(c, cx, base - h, base + 1, 'gold', 4, mouth=True, shift=2 if k == 6 else 0)
    # Gehaeuse (Holz mit Goldleiste)
    round_rect(c, 3, base, 52, base + 9, 'wood', lo=1, hi=4, radius=2)
    for x in range(4, 52):
        c.put_ramp(x, base, 'gold', 4 if x % 2 else 5)
        c.put_ramp(x, base + 1, 'gold', 2)
    for px_ in (6, 46):
        c.rect(px_, base + 3, px_ + 3, base + 7, 'wood', 2)
        c.put_ramp(px_ + 1, base + 5, 'gold', 5)
        c.put_ramp(px_ + 1, base + 4, 'gold', 4)
        c.put_ramp(px_ + 2, base + 6, 'gold', 3)
    # Tastatur in der Gehaeusefront
    c.rect(13, base + 3, 42, base + 8, 'wood', 0)
    for x in range(14, 42):
        c.put_ramp(x, base + 4, 'bone', 5 if x % 2 else 4)
        c.put_ramp(x, base + 5, 'bone', 4 if x % 2 else 3)
        c.put_ramp(x, base + 6, 'bone', 3 if x % 2 else 2)
    for x in (16, 18, 22, 24, 26, 30, 32, 36, 38, 40):
        c.put_ramp(x, base + 4, 'coal', 1)
        c.put_ramp(x, base + 5, 'coal', 1)
    # Heiligenschein ueber der mittleren Pfeife
    hx, hy = 28, 1
    for dx in range(-4, 5):
        c.put_ramp(hx + dx, hy + (0 if abs(dx) < 3 else 1), 'gold', 5 if abs(dx) < 2 else 4)
    # Wolkenbank unten (unter dem Spieltisch)
    for (bx, by, rx, ry, lo, hi) in ((9, 51, 7.5, 4.5, 2, 5), (20, 52, 10, 4.5, 2, 5), (35, 52, 11, 4.5, 2, 5), (46, 51, 7.5, 4.5, 2, 5),
                                      (28, 50, 17, 4.5, 3, 5), (14, 49, 7, 4, 3, 5), (42, 49, 8, 4, 3, 5)):
        ellipse(c, bx, by, rx, ry, 'fur', lo=lo, hi=hi, ambient=0.3)
    # Husten: dunkle Wolken ueber der verbogenen Pfeife
    tx = 38 + 2 + 1
    ty = base - 20
    for (dx, dy, r) in ((1, -3, 1.9), (3, -7, 2.6), (1, -11, 3.0)):
        ellipse(c, tx + dx, ty + dy, r, r * 0.85, 'coal', lo=2, hi=5, ambient=0.3)
    c.put_ramp(tx + 6, ty - 8, 'gold', 4)
    c.put_ramp(tx + 7, ty - 7, 'gold', 5)
    c.outline()
    return c
