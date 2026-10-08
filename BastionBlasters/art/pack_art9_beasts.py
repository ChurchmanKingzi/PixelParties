"""pack_art9: Props der Menagerie (BF-03): Kaefige, Heu, Gnom mit Schaufel."""
from __future__ import annotations

import random

from pack_art9_kit import *


def _bars(c, x0, x1, y0, y1, col='metal'):
    for x in range(x0, x1 + 1, 4):
        c.put_ramp(x, y0, col, 5)
        for y in range(y0 + 1, y1 + 1):
            c.put_ramp(x, y, col, 4)
            c.put_ramp(x + 1, y, col, 2)


def cage(kind='bear', seed=1):
    """Kaefig von vorn (28 x 36): Holzrahmen, Eisenstaebe, Tier dahinter. kind: bear | eyes | wolf"""
    c = Canvas(28, 36)
    o = -2                      # Tiere sind auf Breite 32 entworfen -> um 2 nach links
    # Innenraum (dunkel) + Stroh
    for y in range(4, 31):
        for x in range(2, 26):
            c.put_ramp(x, y, 'coal', 0 if (x + y) % 6 else 1)
    for x in range(2, 26):
        for y in range(26, 31):
            if (x * 3 + y * 5) % 5 < 3:
                c.put_ramp(x, y, 'gold', 2 if (x + y) % 2 else 3)
    for (x, y) in ((6, 25), (13, 26), (20, 25), (23, 27), (9, 29)):
        c.put_ramp(x, y, 'gold', 4)
        c.put_ramp(x + 1, y, 'gold', 3)
    if kind == 'bear':
        ellipse(c, 16 + o, 24, 8.4, 6.6, 'fur', lo=1, hi=5)
        ellipse(c, 16 + o, 25, 4.4, 4.0, 'fur', lo=3, hi=5)
        ellipse(c, 9.4 + o, 16, 2.6, 2.6, 'fur', lo=2, hi=4)
        ellipse(c, 22.6 + o, 16, 2.6, 2.6, 'fur', lo=3, hi=5)
        ellipse(c, 16 + o, 19, 6.2, 5.2, 'fur', lo=2, hi=5)
        ellipse(c, 16 + o, 21, 3.0, 2.2, 'fur', lo=4, hi=5)
        c.rect(12 + o, 17, 13 + o, 18, 'coal', 1)
        c.rect(20 + o, 17, 21 + o, 18, 'coal', 1)
        c.rect(15 + o, 20, 17 + o, 21, 'coal', 1)
        c.put_ramp(9 + o, 16, 'skin', 3)
        c.put_ramp(23 + o, 16, 'skin', 3)
        hline(c, 11 + o, 21 + o, 25, 'teamA', 3)
        hline(c, 11 + o, 21 + o, 26, 'teamA', 2)
    elif kind == 'eyes':
        for (x, y) in ((12, 16), (13, 16), (12, 17), (13, 17), (12, 18), (13, 18), (20, 16), (21, 16), (20, 17), (21, 17), (20, 18), (21, 18)):
            c.put_ramp(x + o, y, 'gold', 5 if y == 16 else 4)
        c.put_ramp(13 + o, 17, 'coal', 0)
        c.put_ramp(21 + o, 17, 'coal', 0)
        c.put_ramp(13 + o, 18, 'coal', 0)
        c.put_ramp(21 + o, 18, 'coal', 0)
        for x in (12, 14, 16, 18, 20):
            c.put_ramp(x + o, 24, 'bone', 5)
            c.put_ramp(x + o, 25, 'bone', 4)
    else:
        ellipse(c, 16 + o, 24, 8.0, 6.2, 'stone', lo=1, hi=4)
        poly(c, [(9 + o, 15), (10 + o, 8), (14 + o, 14)], 'stone', lo=1, hi=4)
        poly(c, [(23 + o, 15), (22 + o, 8), (18 + o, 14)], 'stone', lo=2, hi=5)
        ellipse(c, 16 + o, 18.5, 6.4, 5.0, 'stone', lo=2, hi=5)
        ellipse(c, 16 + o, 21, 3.6, 2.8, 'bone', lo=3, hi=5)
        c.rect(12 + o, 17, 13 + o, 17, 'goblin', 5)
        c.rect(20 + o, 17, 21 + o, 17, 'goblin', 5)
        c.rect(15 + o, 20, 17 + o, 21, 'coal', 1)
        c.put_ramp(16 + o, 23, 'fire', 4)
        c.put_ramp(16 + o, 24, 'fire', 3)
    _bars(c, 4, 24, 4, 30)
    for y in (5, 6):
        hline(c, 1, 26, y, 'wood', 4 if y == 5 else 2)
    block(c, 0, 0, 27, 4, 'wood', hi=5, mid=4, lo=3, deep=2)
    block(c, 0, 4, 2, 32, 'wood', hi=4, mid=3, lo=2, deep=1)
    block(c, 25, 4, 27, 32, 'wood', hi=3, mid=2, lo=1, deep=1)
    block(c, 0, 30, 27, 34, 'wood', hi=4, mid=3, lo=2, deep=1)
    c.rect(12, 31, 15, 33, 'gold', 4)
    c.put_ramp(12, 31, 'gold', 5)
    c.put_ramp(13, 32, 'coal', 1)
    c.outline()
    return c


def hay_bale(w=24, h=16):
    c = Canvas(w, h)
    rnd = random.Random(w * h)
    block(c, 0, 0, w - 1, h - 1, 'gold', hi=5, mid=4, lo=3, deep=2)
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if (x * 7 + y * 3) % 5 == 0:
                c.put_ramp(x, y, 'gold', 3)
            elif (x * 5 + y * 11) % 9 == 0:
                c.put_ramp(x, y, 'gold', 5)
    for x in (w // 3, 2 * w // 3):
        vline(c, x, 0, h - 1, 'dirt', 2)
        vline(c, x + 1, 1, h - 2, 'dirt', 4)
    for k in range(4):
        c.put_ramp(rnd.randint(0, w - 1), h, 'gold', 4)
    c.outline()
    return c


def hay_pile(w=26, h=16):
    c = Canvas(w, h)
    ellipse(c, w / 2.0, h * 0.62, w * 0.48, h * 0.55, 'gold', lo=2, hi=5, ambient=0.25)
    for k in range(10):
        x = 4 + k * 2
        c.line(x, h - 3, x + (k % 3) - 1, 3 + (k * 5) % 5, 'gold', 5 if k % 2 else 3)
    # Heugabel steckt drin
    c.line(w - 6, 2, w - 9, h - 2, 'wood', 3)
    c.line(w - 5, 2, w - 8, h - 2, 'wood', 4)
    for dx in (-1, 0, 1):
        c.put_ramp(w - 6 + dx * 2, 0, 'metal', 5)
        c.put_ramp(w - 6 + dx * 2, 1, 'metal', 3)
    c.outline()
    return c


def manure_pile():
    """Haeufchen mit Fliegen (14 x 12)"""
    c = Canvas(14, 12)
    ellipse(c, 7, 8, 5.6, 3.4, 'dirt', lo=0, hi=3)
    ellipse(c, 7, 5.5, 3.6, 2.6, 'dirt', lo=0, hi=3)
    ellipse(c, 7, 3.4, 1.8, 1.6, 'dirt', lo=1, hi=3)
    c.put_ramp(5, 6, 'dirt', 4)
    c.put_ramp(4, 8, 'dirt', 4)
    c.outline()
    return c


def stink_lines(world, x, y, h=16, phase=0):
    """gruene Wellenlinien nach oben (Gestank), Weltpixel"""
    for k in range(3):
        xx = x + (k - 1) * 5
        for t in range(h - (k % 2) * 3):
            dx = int(round(1.4 * math.sin((t + k * 2 + phase) * 0.9)))
            wput(world, xx + dx, y - t, 'slime', 4 if t % 3 else 5, 9100)
    for (dx, dy) in ((-7, -4), (6, -9), (-3, -12)):
        wput(world, x + dx, y + dy, 'coal', 1, 9100)
        wput(world, x + dx + 1, y + dy, 'coal', 2, 9100)


def chain_decor():
    """Wandhaken mit Ketten, Leine und grossem Knochen (36 x 22)"""
    c = Canvas(36, 22)
    hline(c, 0, 35, 1, 'wood', 4)
    hline(c, 0, 35, 2, 'wood', 2)
    # Ketten
    for x0, ln in ((4, 14), (10, 10)):
        for k in range(ln):
            c.put_ramp(x0 + (k % 2), 3 + k, 'metal', 4 if k % 2 else 2)
    # Leine mit Schlaufe
    c.line(18, 3, 18, 8, 'dirt', 3)
    for (x, y) in ((16, 9), (15, 11), (16, 13), (18, 14), (20, 13), (21, 11), (20, 9)):
        c.put_ramp(x, y, 'dirt', 4 if x < 18 else 2)
    # Knochen
    c.rect(26, 4, 26, 4, 'bone', 5)
    thick_line(c, 27, 5, 33, 15, 2.6, 'bone', lo=3, hi=5)
    for (x, y) in ((25, 4), (27, 3), (32, 17), (34, 15)):
        ellipse(c, x, y, 1.6, 1.6, 'bone', lo=3, hi=5)
    c.outline()
    return c


def feed_sack():
    c = Canvas(16, 18)
    round_rect(c, 2, 4, 13, 16, 'dirt', lo=2, hi=5, radius=3)
    c.rect(4, 3, 11, 5, 'dirt', 4)
    hline(c, 4, 11, 6, 'wood', 2)
    for (x, y) in ((6, 10), (8, 12), (10, 9), (5, 13)):
        c.put_ramp(x, y, 'dirt', 3)
    c.put_ramp(8, 1, 'gold', 4)
    c.put_ramp(9, 2, 'gold', 4)
    c.put_ramp(7, 2, 'gold', 3)
    c.outline()
    return c


def straw_patch(w=34, h=20, seed=1):
    """Strohstreu als Bodendeko (kein Umriss): kurze goldene Halme in unregelmaessigem Fleck"""
    c = Canvas(w, h)
    rnd = random.Random(seed)
    for _ in range(w * h // 5):
        x, y = rnd.randint(0, w - 3), rnd.randint(0, h - 2)
        d = math.hypot((x - w / 2.0) / (w / 2.0), (y - h / 2.0) / (h / 2.0))
        if d > 0.9 + 0.1 * rnd.random():
            continue
        i = rnd.choice([2, 3, 3, 4])
        ln = rnd.choice([2, 2, 3])
        for k in range(ln):
            c.put_ramp(x + k, y + (k // 2) * (1 if seed % 2 else 0), 'gold', i)
    return c
