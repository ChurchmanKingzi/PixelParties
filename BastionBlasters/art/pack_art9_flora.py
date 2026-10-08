"""pack_art9: Props und Figuren des Gewaechshauses (BF-07): Glasbogen, Riesenblumen, Fliegenfalle, Giess-Roboter."""
from __future__ import annotations

import random

from pack_art9_kit import *


def glass_arch(w=40, h=26):
    """Grosses Rundbogen-Glasfenster mit weissen Sprossen, Himmel und Sonnenlicht (w x h)"""
    c = Canvas(w, h)
    cx = (w - 1) / 2.0
    r = w / 2.0
    for y in range(1, h - 2):
        for x in range(1, w - 1):
            if y < r:
                dx = (x - cx) / (r - 1)
                dy = (y - r) / (r - 1)
                if dx * dx + dy * dy > 1.0:
                    continue
            i = 4 if y < h * 0.45 else 3
            if (x + y) % 2 == 0 and abs(y - h * 0.45) < 2:
                i = 7 - i
            c.put_ramp(x, y, 'sky', i)
    # Sonnenstrahlen / Glanz (diagonal)
    for k in range(0, h - 4, 1):
        for (x0, wd) in ((6, 2), (15, 1)):
            x = x0 + k // 2
            if c.alpha(x, 3 + k) and (k % 3):
                c.put_ramp(x, 3 + k, 'sky', 5)
    # Sprossen (weiss/knochen)
    for x in (int(cx) - 7, int(cx), int(cx) + 7):
        for y in range(2, h - 2):
            if c.alpha(x, y) or y > 4:
                c.put_ramp(x, y, 'bone', 5 if x <= cx else 4)
                c.put_ramp(x + 1, y, 'bone', 3)
    for yy in (int(h * 0.38), int(h * 0.7)):
        for x in range(1, w - 1):
            if c.alpha(x, yy):
                c.put_ramp(x, yy, 'bone', 5)
                c.put_ramp(x, yy + 1, 'bone', 3)
    # Bogenrippen
    for k in range(0, 180, 3):
        a = math.radians(180 + k)
        x = cx + (r - 1.5) * math.cos(a)
        y = r + (r - 1.5) * math.sin(a)
        c.put_ramp(int(round(x)), int(round(y)), 'bone', 5 if k < 90 else 3)
    # Sims
    hline(c, 0, w - 1, h - 3, 'bone', 5)
    hline(c, 0, w - 1, h - 2, 'bone', 3)
    hline(c, 0, w - 1, h - 1, 'bone', 1)
    c.outline()
    return c


def vines(w=88, h=22, seed=2):
    """haengende Ranken mit Bluetchen (Wanddeko, Fuss transparent)"""
    c = Canvas(w, h)
    rnd = random.Random(seed)
    x = 3
    while x < w - 3:
        ln = rnd.choice([5, 8, 11, 14, 7])
        for k in range(ln):
            dx = int(round(1.2 * math.sin(k * 0.7 + x)))
            c.put_ramp(x + dx, 1 + k, 'leaf', 3 if k % 3 else 2)
            if k % 4 == 2:
                c.put_ramp(x + dx + 1, 1 + k, 'leaf', 4)
                c.put_ramp(x + dx - 1, 2 + k, 'leaf', 4)
        if rnd.random() < 0.5:
            col = rnd.choice([('skin', 4), ('gold', 4), ('purple', 4)])
            ex = x + int(round(1.2 * math.sin(ln * 0.7 + x)))
            c.put_ramp(ex, 1 + ln, col[0], col[1])
            c.put_ramp(ex + 1, 1 + ln, col[0], col[1] - 1)
            c.put_ramp(ex, 2 + ln, col[0], col[1] - 1)
        x += rnd.randint(4, 9)
    for xx in range(w):
        c.put_ramp(xx, 0, 'leaf', 2)
    return c


def _stem(c, x, y0, y1, th=3, ramp='leaf'):
    for y in range(y0, y1 + 1):
        for dx in range(th):
            i = 4 if dx == 0 else (3 if dx < th - 1 else 2)
            c.put_ramp(x + dx, y, ramp, i)


def _leaf(c, x, y, direction, size=6):
    """Blatt (Raute) links/rechts vom Stiel"""
    d = direction
    pts = [(x, y), (x + d * size, y - size // 2 - 1), (x + d * (size + 3), y - 1), (x + d * size, y + 1)]
    poly(c, pts, 'leaf', lo=1, hi=5)


def giant_flower(kind='sun', h=50, pot=True):
    """Riesenblume im Topf. kind: sun (Sonnenblume) | pink (rosa Bluete) | blue (Glockenblume)"""
    w = 36
    c = Canvas(w, h)
    cx = w // 2
    if pot:
        round_rect(c, cx - 8, h - 11, cx + 8, h - 1, 'wood', lo=1, hi=4, radius=2)
        hline(c, cx - 9, cx + 9, h - 12, 'wood', 5)
        hline(c, cx - 9, cx + 9, h - 11, 'wood', 3)
    else:
        ellipse(c, cx, h - 4, 8.0, 3.4, 'dirt', lo=1, hi=4)
        for (dx, dy) in ((-4, -1), (3, 0), (-1, 1), (5, -1)):
            c.put_ramp(cx + dx, h - 5 + dy, 'dirt', 5)
    # Stiel + Blaetter
    _stem(c, cx - 1, 14, h - (12 if pot else 6))
    _leaf(c, cx - 2, h - 20, -1, 8)
    _leaf(c, cx + 2, h - 28, 1, 8)
    if kind == 'sun':
        hy = 11
        # Blütenblätter
        for k in range(14):
            a = math.radians(k * 360 / 14)
            for rr in range(5, 11):
                px_, py_ = cx + 1 + rr * math.cos(a), hy + rr * math.sin(a)
                c.put_ramp(int(round(px_)), int(round(py_)), 'gold', 5 if (math.cos(a) + math.sin(a)) < -0.2 and rr < 9 else (4 if rr < 9 else 3))
                if rr in (7, 8):
                    c.put_ramp(int(round(px_ + math.sin(a))), int(round(py_ - math.cos(a))), 'gold', 4)
        ellipse(c, cx + 1, hy, 4.8, 4.8, 'dirt', lo=0, hi=3)
        for (dx, dy) in ((-2, -2), (0, -1), (2, 0), (-1, 1), (1, 2), (-2, 1)):
            c.put_ramp(cx + 1 + dx, hy + dy, 'dirt', 4)
    elif kind == 'pink':
        hy = 12
        for k in range(8):
            a = math.radians(k * 45 + 10)
            cxp, cyp = cx + 1 + 6.0 * math.cos(a), hy + 6.0 * math.sin(a)
            ellipse(c, cxp, cyp, 4.0, 4.0, 'skin', lo=2, hi=5)
        ellipse(c, cx + 1, hy, 4.4, 4.4, 'gold', lo=3, hi=5)
        c.put_ramp(cx, hy - 1, 'gold', 5)
    else:
        hy = 14
        # Glocke
        poly(c, [(cx - 7, hy - 6), (cx + 8, hy - 6), (cx + 10, hy + 6), (cx - 9, hy + 6)], 'ice', lo=2, hi=5)
        ellipse(c, cx + 0.5, hy - 6, 7.6, 3.2, 'ice', lo=3, hi=5)
        for x in range(cx - 9, cx + 11):
            if x % 3 == 0:
                c.put_ramp(x, hy + 6, 'ice', 1)
        c.put_ramp(cx, hy + 7, 'gold', 4)
        c.put_ramp(cx, hy + 8, 'gold', 5)
    c.outline()
    return c


def venus_trap():
    """Fliegenfalle im Topf (24 x 26): zwei Fangblaetter mit Zaehnen, ein Fliegenbein schaut raus"""
    c = Canvas(24, 26)
    round_rect(c, 6, 18, 17, 25, 'wood', lo=1, hi=4, radius=2)
    hline(c, 5, 18, 17, 'wood', 5)
    _stem(c, 10, 11, 17, 3)
    # Unterkiefer
    ellipse(c, 12, 11, 8.6, 5.0, 'leaf', lo=1, hi=4, clip=lambda x, y: y >= 11)
    # Oberkiefer (klappt auf)
    poly(c, [(3, 11), (21, 11), (19, 2), (5, 2)], 'leaf', lo=2, hi=5)
    ellipse(c, 12, 5, 8.0, 4.0, 'leaf', lo=2, hi=5, clip=lambda x, y: y <= 7)
    # Rotes Innere
    for y in range(6, 11):
        for x in range(5, 20):
            c.put_ramp(x, y, 'teamA', 3 if (x + y) % 2 else 2)
    # Zaehne
    for x in range(4, 21, 2):
        c.put_ramp(x, 11, 'bone', 5)
        c.put_ramp(x, 10, 'bone', 4)
    for x in range(5, 20, 2):
        c.put_ramp(x, 6, 'bone', 5)
        c.put_ramp(x, 7, 'bone', 3)
    # winziges Auge (nur ein Pixel-Punkt, ein Mund-Strich ist schon die Zahnreihe)
    c.put_ramp(9, 4, 'coal', 1)
    c.put_ramp(14, 4, 'coal', 1)
    # Fliege (winzig)
    c.put_ramp(22, 8, 'coal', 2)
    c.put_ramp(23, 7, 'bone', 4)
    c.outline()
    return c


def watering_robot(f=0):
    """Giess-Roboter (30 x 30): Giesskanne als Rumpf auf Raupenketten, Brause-Auslass rechts, Antenne mit Blume"""
    c = Canvas(30, 30)
    # Raupen
    round_rect(c, 3, 23, 19, 29, 'coal', lo=0, hi=3, radius=3)
    for x in range(5, 18, 3):
        c.put_ramp(x, 26, 'metal', 4)
    for (x, y) in ((6, 24), (11, 24), (16, 24)):
        c.put_ramp(x, y, 'coal', 4)
    # Rumpf: Kanne
    round_rect(c, 3, 9, 19, 24, 'slime', lo=1, hi=5, radius=4)
    hline(c, 3, 19, 14, 'slime', 1)
    hline(c, 3, 19, 20, 'slime', 1)
    # Henkel oben
    for (x, y) in ((6, 8), (7, 5), (9, 3), (12, 2), (15, 3), (17, 5), (18, 8)):
        c.put_ramp(x, y, 'slime', 4 if x < 12 else 2)
        c.put_ramp(x, y + 1, 'slime', 3 if x < 12 else 1)
    # Gesicht (zwei Augen, Mund-Strich)
    c.rect(7, 12, 8, 13, 'coal', 1)
    c.rect(13, 12, 14, 13, 'coal', 1)
    c.put_ramp(7, 12, 'bone', 5)
    c.put_ramp(13, 12, 'bone', 5)
    hline(c, 9, 12, 17, 'coal', 1)
    # Nieten
    for (x, y) in ((5, 11), (17, 11), (5, 22), (17, 22)):
        c.put_ramp(x, y, 'metal', 5)
    # Tuelle zur Brause
    thick_line(c, 19, 21, 25, 11, 3.2, 'slime', lo=1, hi=4)
    poly(c, [(23, 9), (29, 7), (29, 13), (24, 13)], 'metal', lo=2, hi=5)
    for (x, y) in ((27, 8), (27, 10), (27, 12), (25, 10)):
        c.put_ramp(x, y, 'coal', 1)
    # Antenne mit Blume
    c.line(10, 3, 9, 0, 'metal', 4)
    c.put_ramp(8, 0, 'skin', 5)
    c.put_ramp(10, 0, 'skin', 4)
    c.outline()
    return c


def water_arc(world, x0, y0, x1, y1, n=9, key=9100):
    """Wassertropfen im Bogen von (x0, y0) nach (x1, y1): 2 x 2 Tropfen mit dunklem Rand"""
    for k in range(n):
        t = k / float(n - 1)
        x = int(x0 + (x1 - x0) * t)
        y = int(y0 + (y1 - y0) * t - 7 * 4 * t * (1 - t) * 0.6)
        for (dx, dy) in ((-1, 0), (2, 0), (0, -1), (1, -1), (0, 2), (1, 2), (-1, 1), (2, 1)):
            wput(world, x + dx, y + dy, 'ice', 1, key)
        for (dx, dy, i) in ((0, 0, 5), (1, 0, 4), (0, 1, 4), (1, 1, 3)):
            wput(world, x + dx, y + dy, 'ice', i, key + 1)


def bell_jar(h=30):
    """Glasglocke ueber einer leuchtenden Rarität (24 x h)"""
    c = Canvas(24, h)
    # Holzteller
    block(c, 1, h - 5, 22, h - 1, 'wood', hi=4, mid=3, lo=2, deep=1)
    # Blume innen
    _stem(c, 11, h - 14, h - 6, 2)
    for k in range(6):
        a = math.radians(k * 60)
        ellipse(c, 12 + 3.6 * math.cos(a), h - 16 + 3.2 * math.sin(a), 2.4, 2.4, 'cloth', lo=2, hi=5)
    ellipse(c, 12, h - 16, 2.0, 2.0, 'gold', lo=3, hi=5)
    # Glas
    for y in range(1, h - 6):
        for x in range(1, 23):
            dx = (x - 11.5) / 10.5
            dy = (y - 11.0) / 10.0
            if y > 11 or dx * dx + dy * dy <= 1.0:
                inside = True
            else:
                inside = False
            if not inside:
                continue
            edge = x <= 2 or x >= 21 or y <= 2 or dx * dx + dy * dy > 0.82 and y < 12
            if edge and (x + y) % 2 == 0:
                c.put_ramp(x, y, 'sky', 5)
            elif edge:
                c.put_ramp(x, y, 'sky', 4)
            elif (x + y) % 4 == 0 and x < 14:
                c.put_ramp(x, y, 'sky', 5)
    # Glanzstreifen
    for k in range(7):
        c.put_ramp(5, 6 + k, 'bone', 5)
    c.put_ramp(6, 4, 'bone', 5)
    c.put_ramp(7, 3, 'bone', 5)
    # Knauf
    ellipse(c, 11.5, 1.5, 1.6, 1.6, 'gold', lo=3, hi=5)
    c.outline()
    return c


def flower_bed(w=36, h=16, seed=1):
    """Beet als Bodendeko mit Steinrand und Setzlingen"""
    c = Canvas(w, h)
    for y in range(h):
        for x in range(w):
            edge = min(x, y, w - 1 - x, h - 1 - y)
            if edge == 0:
                c.put_ramp(x, y, 'stone', 4 if (x + y) % 3 else 3)
            elif edge == 1:
                c.put_ramp(x, y, 'stone', 2)
            else:
                c.put_ramp(x, y, 'dirt', 1 if (x * 3 + y * 5) % 7 else 2)
    rnd = random.Random(seed)
    for _ in range(7):
        x, y = rnd.randint(4, w - 5), rnd.randint(4, h - 4)
        c.put_ramp(x, y, 'leaf', 4)
        c.put_ramp(x - 1, y - 1, 'leaf', 3)
        c.put_ramp(x + 1, y - 1, 'leaf', 3)
    return c
