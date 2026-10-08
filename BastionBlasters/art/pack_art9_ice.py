"""pack_art9: Props der Eisgrotte (BF-06): Kristalleis, Rezeption mit Pinguin."""
from __future__ import annotations

import random

from pack_art9_kit import *


def ice_crystals(h=34, seed=1, n=4, ramp='ice', snow=True):
    """Kristallhaufen von vorn (w x h): sechseckige Prismen mit heller Linkskante"""
    w = int(h * 0.7) + 4
    c = Canvas(w, h)
    rnd = random.Random(seed)
    specs = []
    base = h - 2
    xs = [w * 0.5] + [w * 0.5 + rnd.choice([-1, 1]) * rnd.randint(4, w // 2 - 3) for _ in range(n - 1)]
    for k, cx in enumerate(xs):
        top = 2 + (0 if k == 0 else rnd.randint(int(h * 0.25), int(h * 0.45)))
        half = (4 if k == 0 else 3) + (1 if h > 30 else 0)
        lean = 0 if k == 0 else rnd.choice([-2, -1, 1, 2])
        specs.append((cx, top, half, lean))
    specs.sort(key=lambda s: -abs(s[0] - w * 0.5))
    for (cx, top, half, lean) in specs:
        tipx = cx + lean
        tip_h = max(3, int(half * 1.4))
        for y in range(top, base + 1):
            if y < top + tip_h:
                t = (y - top) / float(tip_h)
                hw = half * t
                mid = tipx + (cx - tipx) * t
            else:
                hw = half
                mid = cx
            x0, x1 = int(round(mid - hw)), int(round(mid + hw))
            for x in range(x0, x1 + 1):
                u = (x - x0) / max(1.0, (x1 - x0))
                if u < 0.28:
                    i = 5
                elif u < 0.6:
                    i = 4 if (x + y) % 7 else 5
                elif u < 0.85:
                    i = 3
                else:
                    i = 2
                if y > base - 3:
                    i = max(1, i - 1)
                c.put_ramp(x, y, ramp, i)
        # Spitzenlicht + Kante
        c.put_ramp(int(round(tipx)), top, ramp, 5)
        for y in range(top + tip_h, base - 2, 5):
            c.put_ramp(int(round(cx - half + 1)), y, 'bone', 5)
    # Funkeln
    for _ in range(4):
        x, y = rnd.randint(2, w - 3), rnd.randint(3, base - 6)
        if c.alpha(x, y):
            c.put_ramp(x, y, 'bone', 5)
    # Schnee am Fuss
    for x in range(1, w - 1):
        if snow and rnd.random() < 0.8:
            c.put_ramp(x, base + 1 if base + 1 < h else base, 'bone', 5 if x % 2 else 4)
    c.outline()
    return c


def reception_desk():
    """Rezeptionstresen aus Eisbloecken mit Glocke, Gaestebuch und Fisch (52 x 26)"""
    c = Canvas(52, 26)
    # Front: Eisbloecke im Verband
    for row in range(3):
        y0 = 11 + row * 5
        off = 6 if row % 2 else 0
        for bx in range(-6 + off, 52, 12):
            x0, x1 = max(1, bx), min(50, bx + 11)
            if x1 <= x0:
                continue
            for y in range(y0, min(25, y0 + 5)):
                for x in range(x0, x1 + 1):
                    if y == y0:
                        i = 5
                    elif x == x0:
                        i = 4
                    elif y >= y0 + 4 or x == x1:
                        i = 2
                    else:
                        i = 3 if (x + y) % 4 else 4
                    c.put_ramp(x, y, 'ice', i)
    # Schneehaube oben
    for x in range(0, 52):
        c.put_ramp(x, 9, 'bone', 5)
        c.put_ramp(x, 10, 'bone', 4 if x % 3 else 3)
    for x in range(2, 50, 4):
        c.put_ramp(x, 11, 'bone', 4)
    # Wappen: Schneeflocke
    cx, cy = 26, 18
    for (dx, dy) in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (2, 2), (-2, 2), (2, -2), (-2, -2), (3, 0), (-3, 0), (0, 3), (0, -3)):
        c.put_ramp(cx + dx, cy + dy, 'ice', 1 if abs(dx) + abs(dy) > 1 else 0)
    # Dinge auf dem Tresen
    # Glocke
    ellipse(c, 8, 7, 3.2, 2.6, 'gold', lo=2, hi=5, clip=lambda x, y: y <= 7)
    hline(c, 5, 11, 8, 'gold', 2)
    c.put_ramp(8, 4, 'gold', 5)
    # Gaestebuch (offen)
    poly(c, [(36, 8), (49, 8), (48, 4), (37, 4)], 'bone', lo=3, hi=5)
    vline(c, 42, 4, 8, 'bone', 2)
    for x in (38, 39, 44, 45, 46):
        c.put_ramp(x, 6, 'bone', 2)
    c.put_ramp(40, 5, 'ice', 3)
    c.put_ramp(47, 5, 'ice', 3)
    # Fisch
    for (x, y, i) in ((19, 7, 4), (20, 7, 5), (21, 7, 4), (22, 7, 3), (23, 6, 3), (23, 8, 3), (18, 6, 3), (18, 8, 3)):
        c.put_ramp(x, y, 'ice', i)
    c.put_ramp(20, 7, 'coal', 1)
    c.outline()
    return c


def penguin_clerk(f=0):
    """Pinguin am Empfang (22 x 32): Fliege, Portiersmuetze, Flossen auf dem Tresen"""
    c = Canvas(22, 32)
    # Fuesse
    c.rect(5, 30, 9, 31, 'gold', 3)
    c.rect(12, 30, 16, 31, 'gold', 3)
    # Flossen
    poly(c, [(2, 14), (5, 14), (5, 25), (1, 22)], 'coal', lo=0, hi=3)
    poly(c, [(19, 14), (16, 14), (16, 25), (20, 22)], 'coal', lo=0, hi=3)
    # Koerper
    ellipse(c, 11, 21, 8.4, 10.4, 'coal', lo=0, hi=3, ambient=0.2)
    ellipse(c, 11.5, 22.5, 5.4, 8.2, 'bone', lo=3, hi=5)
    # Kopf
    ellipse(c, 11, 10, 7.4, 6.6, 'coal', lo=0, hi=3, ambient=0.2)
    c.rect(7, 10, 8, 11, 'bone', 5)
    c.rect(13, 10, 14, 11, 'bone', 5)
    c.put_ramp(8, 11, 'coal', 0)
    c.put_ramp(13, 11, 'coal', 0)
    poly(c, [(9, 12), (14, 12), (11.5, 16)], 'gold', lo=3, hi=5)
    # Fliege
    poly(c, [(7, 17), (11, 18.5), (7, 20)], 'teamA', lo=2, hi=4)
    poly(c, [(16, 17), (12, 18.5), (16, 20)], 'teamA', lo=1, hi=3)
    c.put_ramp(11, 18, 'gold', 4)
    c.put_ramp(11, 19, 'gold', 3)
    # Portiersmuetze
    c.rect(6, 3, 16, 5, 'teamA', 3)
    c.rect(6, 3, 16, 3, 'teamA', 4)
    c.rect(7, 1, 15, 2, 'teamA', 2)
    c.rect(5, 5, 17, 5, 'coal', 2)
    c.rect(10, 3, 12, 4, 'gold', 4)
    c.put_ramp(11, 3, 'gold', 5)
    c.outline()
    return c


def snowflake_crest():
    """Wappen mit Schneeflocke (16 x 18)"""
    c = Canvas(16, 18)
    poly(c, [(1, 1), (14, 1), (14, 10), (7.5, 17), (1, 10)], 'ice', lo=1, hi=4)
    cx, cy = 7, 8
    for (dx, dy) in ((0, 0), (0, 1), (0, -1), (1, 0), (-1, 0), (0, 2), (0, -2), (2, 0), (-2, 0), (0, 3), (0, -3), (3, 0), (-3, 0),
                     (2, 2), (-2, 2), (2, -2), (-2, -2), (1, 1), (-1, 1), (1, -1), (-1, -1)):
        c.put_ramp(cx + dx, cy + dy, 'bone', 5)
    c.rect(3, 2, 11, 2, 'ice', 5)
    c.outline()
    return c


def icicles(w=88, h=22, seed=3):
    """Eiszapfen und Frost an der Wandoberkante (Wanddeko, nach unten transparent aufgefuellt)"""
    c = Canvas(w, h)
    rnd = random.Random(seed)
    x = 1
    while x < w - 2:
        length = rnd.choice([4, 6, 8, 11, 7, 5])
        wid = rnd.choice([2, 3, 3])
        for k in range(length):
            half = max(0, (wid * (length - k)) // (length * 1) // 1 - (1 if k > length // 2 else 0))
            for dx in range(0, max(1, wid - k // 3)):
                i = 5 if dx == 0 else (4 if k < length * 0.6 else 3)
                c.put_ramp(x + dx, 1 + k, 'ice', i)
        x += wid + rnd.randint(1, 4)
    for xx in range(0, w):
        c.put_ramp(xx, 0, 'bone', 5)
        if xx % 2 == 0:
            c.put_ramp(xx, 1, 'bone', 4)
    # Frostflecken an der Wand
    for _ in range(14):
        fx, fy = rnd.randint(2, w - 4), rnd.randint(9, 17)
        c.put_ramp(fx, fy, 'ice', 5)
        c.put_ramp(fx + 1, fy, 'ice', 4)
        c.put_ramp(fx, fy + 1, 'ice', 4)
    return c


def key_board():
    """Schluesselbrett mit Eisschluesseln (22 x 18)"""
    c = Canvas(22, 18)
    block(c, 0, 0, 21, 17, 'wood', hi=4, mid=3, lo=2, deep=1)
    for k in range(4):
        x = 3 + k * 5
        c.put_ramp(x, 3, 'metal', 4)
        c.rect(x, 4, x, 7, 'ice', 4)
        ellipse(c, x, 10, 1.8, 2.8, 'ice', lo=3, hi=5)
        c.put_ramp(x, 10, 'ice', 1)
        c.put_ramp(x, 13, 'ice', 3)
    c.outline()
    return c


def snow_drift(w=26, h=10, seed=1):
    """Schneehaufen (Boden-Deko mit Umriss), w x h"""
    c = Canvas(w, h)
    ellipse(c, w / 2.0, h * 0.62, w * 0.46, h * 0.5, 'bone', lo=3, hi=5, ambient=0.3)
    ellipse(c, w * 0.32, h * 0.7, w * 0.28, h * 0.36, 'bone', lo=3, hi=5, ambient=0.3)
    rnd = random.Random(seed)
    for _ in range(4):
        c.put_ramp(rnd.randint(3, w - 4), rnd.randint(2, h - 3), 'ice', 5)
    c.outline()
    return c


def welcome_mat():
    c = Canvas(24, 10)
    for y in range(10):
        for x in range(24):
            edge = min(x, y, 23 - x, 9 - y)
            c.put_ramp(x, y, 'teamA', 1 if edge == 0 else (4 if edge == 1 else (3 if (x // 2 + y) % 2 else 2)))
    # Pfotenabdruecke (Pinguin: drei Zehen)
    for (x, y) in ((6, 6), (16, 3)):
        c.put_ramp(x, y, 'bone', 5)
        c.put_ramp(x - 1, y - 1, 'bone', 4)
        c.put_ramp(x + 1, y - 1, 'bone', 4)
        c.put_ramp(x, y - 1, 'bone', 5)
    return c
