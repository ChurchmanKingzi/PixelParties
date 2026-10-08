"""pack_art6 Kulissen: kleine Requisiten fuer die Dioramen (Fallen, Bienenkorb, Grabsteine, Schrotthaufen ...)."""
from __future__ import annotations

from pack_art6_kit import *


def bear_trap(state='open', helm=False):
    """Baerenfalle von schraeg oben (30 x 18): offen mit Zahnkranz oder zugeschnappt"""
    c = Canvas(30, 18)
    cx, cy = 15, 9
    if state == 'open':
        ellipse(c, cx, cy, 13.0, 7.0, 'wood', lo=0, hi=2)
        ring(c, cx, cy, 14.4, 8.0, 0.26, 'metal', lo=2, hi=5)
        for k in range(16):
            a = 2 * math.pi * k / 16
            x = cx + math.cos(a) * 10.4
            y = cy + math.sin(a) * 5.6
            c.put_ramp(int(round(x)), int(round(y)), 'bone', 5)
            c.put_ramp(int(round(cx + math.cos(a) * 11.6)), int(round(cy + math.sin(a) * 6.4)), 'bone', 3)
        ellipse(c, cx, cy, 4.2, 2.6, 'metal', lo=1, hi=4)
        c.rect(cx - 1, cy - 1, cx, cy, 'gold', 5)
        c.put_ramp(cx + 1, cy, 'gold', 3)
        c.rect(0, 8, 1, 9, 'metal', 3)
        c.rect(28, 8, 29, 9, 'metal', 3)
    else:
        ellipse(c, cx, cy + 1, 14.0, 5.6, 'metal', lo=1, hi=5)
        for x in range(2, 29):
            c.put_ramp(x, 8 + (x % 2), 'bone', 5 if x % 2 else 3)
            c.put_ramp(x, 10 - (x % 2), 'metal', 1)
        c.rect(6, 5, 24, 5, 'metal', 5)
        if helm:
            ellipse(c, cx, 6, 5.6, 5.0, 'metal', lo=2, hi=5, clip=lambda x, y: y <= 7)
            c.put_ramp(12, 2, 'metal', 5)
            c.put_ramp(13, 2, 'metal', 5)
            c.put_ramp(15, 0, 'gold', 4)
    c.outline()
    return c


def cheese():
    c = Canvas(9, 7)
    poly(c, [(0, 6), (8, 6), (8, 1)], 'gold', lo=2, hi=5)
    c.put_ramp(5, 4, 'gold', 1)
    c.put_ramp(3, 5, 'gold', 1)
    c.put_ramp(7, 3, 'gold', 1)
    c.put_ramp(7, 2, 'gold', 5)
    c.outline()
    return c


def mouse():
    c = Canvas(12, 7)
    ellipse(c, 6, 4, 3.8, 2.4, 'stone', lo=2, hi=5)
    ellipse(c, 9, 3.4, 1.8, 1.6, 'stone', lo=3, hi=5)
    c.put_ramp(8, 1, 'skin', 3)
    c.put_ramp(10, 3, 'coal', 1)
    c.put_ramp(11, 4, 'skin', 4)
    for k, (x, y) in enumerate(((2, 5), (1, 5), (0, 4), (0, 3))):
        c.put_ramp(x, y, 'skin', 3)
    c.outline()
    return c


def skep():
    """Strohbienenkorb auf Holzgestell (28 x 32)"""
    c = Canvas(28, 32)
    for x in (4, 22):
        c.rect(x, 22, x + 1, 30, 'wood', 3)
        c.rect(x, 22, x, 30, 'wood', 4)
    c.rect(4, 21, 23, 23, 'wood', 3)
    c.rect(4, 21, 23, 21, 'wood', 5)
    c.rect(4, 23, 23, 23, 'wood', 1)
    # Kuppel mit Stroh-Windungen
    for y in range(4, 22):
        t = (y - 4) / 17.0
        half = 3.0 + 9.6 * math.sin(min(1.0, t * 1.25) * math.pi / 2)
        left, right = int(round(14 - half)), int(round(14 + half))
        for x in range(left, right + 1):
            u = (x - left) / max(1, right - left)
            L = 0.95 - 0.8 * u
            idx = quant(L, 2, 5, x, y)
            if (y - 4) % 4 == 3:
                idx = max(1, idx - 2)
            c.put_ramp(x, y, 'gold', idx)
    c.rect(13, 1, 14, 3, 'gold', 4)
    c.put_ramp(13, 0, 'gold', 5)
    # Einflugloch
    c.rect(11, 17, 16, 20, 'coal', 0)
    c.rect(12, 16, 15, 16, 'coal', 0)
    c.put_ramp(12, 17, 'coal', 1)
    c.outline()
    return c


def flower(col='fire', h=9):
    c = Canvas(7, h + 3)
    c.rect(3, 4, 3, h + 2, 'leaf', 3)
    c.put_ramp(2, h - 1, 'leaf', 4)
    c.put_ramp(4, h - 3, 'leaf', 4)
    for (dx, dy, i) in ((0, 1, 4), (-1, 1, 3), (1, 1, 3), (0, 0, 3), (0, 2, 3)):
        c.put_ramp(3 + dx, 2 + dy, col, i)
    c.put_ramp(3, 3, 'gold', 5)
    c.outline()
    return c


def honey_pot():
    c = Canvas(14, 14)
    ellipse(c, 7, 8, 5.8, 5.4, 'wood', lo=2, hi=5)
    c.rect(4, 2, 10, 3, 'wood', 4)
    c.rect(3, 3, 11, 4, 'gold', 4)
    for (x, y) in ((5, 6), (6, 6), (7, 6)):
        c.put_ramp(x, y, 'gold', 5)
    for k in range(4):
        c.put_ramp(10 + k // 3, 4 + k, 'gold', 4)
    c.outline()
    return c


def mailbox():
    c = Canvas(20, 34)
    c.rect(9, 14, 11, 32, 'wood', 3)
    c.rect(9, 14, 9, 32, 'wood', 4)
    c.rect(7, 31, 13, 32, 'wood', 1)
    round_rect(c, 2, 4, 17, 15, 'ice', lo=1, hi=4, radius=3)
    c.rect(5, 9, 14, 9, 'ice', 1)
    c.rect(6, 7, 7, 7, 'bone', 5)
    c.rect(15, 5, 15, 3, 'wood', 2)
    c.rect(15, 1, 18, 3, 'fire', 4)
    c.put_ramp(15, 1, 'fire', 5)
    c.rect(3, 12, 5, 13, 'bone', 4)
    c.put_ramp(3, 12, 'bone', 5)
    c.outline()
    return c


def tombstone(kind=0):
    c = Canvas(16, 22)
    if kind == 0:
        for y in range(2, 20):
            half = 5 if y > 5 else 3 + (y - 2)
            for x in range(8 - half, 8 + half + 1):
                u = (x - (8 - half)) / (2 * half + 1)
                c.put_ramp(x, y, 'stone', quant(0.95 - 0.8 * u, 1, 4, x, y))
        c.rect(7, 7, 8, 12, 'stone', 1)
        c.rect(5, 9, 10, 10, 'stone', 1)
        c.rect(4, 19, 11, 20, 'stone', 1)
    else:
        c.rect(6, 3, 9, 20, 'stone', 3)
        c.rect(6, 3, 6, 20, 'stone', 4)
        c.rect(3, 7, 12, 10, 'stone', 3)
        c.rect(3, 7, 12, 7, 'stone', 4)
        c.rect(9, 3, 9, 20, 'stone', 2)
        c.rect(5, 19, 10, 20, 'stone', 1)
    for (x, y) in ((4, 17), (5, 16), (10, 18), (11, 19), (6, 18)):
        c.put_ramp(x, y, 'leaf', 2)
    c.outline()
    return c


def bone_hand():
    """Skeletthand ragt aus einem Erdhaufen (14 x 22)"""
    c = Canvas(14, 22)
    ellipse(c, 7, 19, 6.4, 2.8, 'dirt', lo=1, hi=3)
    c.rect(6, 8, 7, 18, 'bone', 3)
    c.rect(6, 8, 6, 18, 'bone', 4)
    for y in (11, 14):
        c.put_ramp(7, y, 'bone', 2)
    for (x0, y0, x1, y1) in ((3, 6, 2, 1), (5, 6, 4, 0), (8, 6, 9, 0), (10, 7, 11, 2)):
        thick_line(c, x0 + 1, y0 + 1, x1, y1 + 1, 1.2, 'bone', lo=3, hi=5)
    c.rect(4, 6, 9, 8, 'bone', 4)
    c.put_ramp(5, 6, 'bone', 5)
    c.outline()
    return c


def rose_bush():
    c = Canvas(26, 22)
    for (bx, by, rx, ry) in ((13, 12, 11, 7), (7, 14, 6, 5), (19, 14, 6, 5), (13, 8, 7, 5)):
        ellipse(c, bx, by, rx, ry, 'leaf', lo=0, hi=3, ambient=0.2)
    for (x, y) in ((5, 10), (11, 6), (17, 9), (21, 14), (9, 15), (14, 13), (7, 12)):
        c.rect(x, y, x + 2, y + 2, 'teamA', 2)
        c.rect(x, y, x + 1, y + 1, 'teamA', 3)
        c.put_ramp(x, y, 'teamA', 5)
        c.put_ramp(x + 1, y + 1, 'teamA', 1)
    c.outline()
    return c


def scrap_heap():
    """Schrotthaufen: Reifen, Dosen, Rohr, Zahnrad, Federbett, Stiefel (46 x 28)"""
    c = Canvas(46, 28)
    ellipse(c, 23, 22, 21, 6, 'dirt', lo=1, hi=3)
    # Reifen
    ellipse(c, 12, 17, 9.5, 8.5, 'coal', lo=1, hi=4)
    ellipse(c, 12, 17, 4.6, 4.2, 'dirt', lo=1, hi=2)
    c.put_ramp(8, 11, 'coal', 5)
    # Dosen
    for (x, y, w, h, i) in ((22, 12, 7, 10, 3), (30, 16, 7, 8, 4), (26, 4, 7, 9, 2)):
        round_rect(c, x, y, x + w - 1, y + h - 1, 'metal', lo=1, hi=4, radius=1)
        c.rect(x, y + 2, x + w - 1, y + 2, 'metal', 5)
        c.rect(x, y + h - 3, x + w - 1, y + h - 3, 'metal', 1)
    dither(c, 31, 18, 35, 22, 'dirt', 2, 3)
    # Rohr
    thick_line(c, 33, 12, 43, 7, 3.2, 'metal', lo=1, hi=4)
    c.put_ramp(43, 7, 'coal', 1)
    # Zahnrad
    ring(c, 38, 22, 5.0, 3.0, 0.45, 'gold', lo=1, hi=4)
    for k in range(8):
        a = k * math.pi / 4
        c.put_ramp(int(round(38 + math.cos(a) * 5.8)), int(round(22 + math.sin(a) * 3.6)), 'gold', 3)
    # Federbett-Spirale
    for k in range(6):
        c.line(18 + k * 2, 24 - (k % 2) * 3, 19 + k * 2, 21 + (k % 2) * 3 - 3, 'metal', 4 if k % 2 else 2)
    # Stiefel
    c.rect(1, 22, 6, 25, 'wood', 3)
    c.rect(1, 20, 3, 22, 'wood', 2)
    c.rect(1, 25, 6, 25, 'wood', 1)
    c.outline()
    return c


def metal_plate(w=14, h=10):
    c = Canvas(w, h)
    round_rect(c, 0, 0, w - 1, h - 1, 'metal', lo=1, hi=5, radius=1)
    for (x, y) in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)):
        c.put_ramp(x, y, 'gold', 5)
    c.rect(3, h // 2, w - 4, h // 2, 'metal', 1)
    c.outline()
    return c


def ingot(kind='gold'):
    c = Canvas(14, 9)
    ramp = 'gold' if kind == 'gold' else 'stone'
    poly(c, [(3, 1), (12, 1), (13, 4), (1, 4)], ramp, flat=5 if kind == 'gold' else 4)
    poly(c, [(1, 4), (13, 4), (13, 7), (1, 7)], ramp, lo=2, hi=4)
    c.rect(1, 4, 13, 4, ramp, 3)
    c.rect(1, 7, 13, 7, ramp, 1)
    c.put_ramp(4, 2, ramp, 5)
    c.put_ramp(5, 2, ramp, 5)
    c.outline()
    return c


def flask(col='purple', tilt=0):
    c = Canvas(11, 13)
    c.rect(4, 2, 6, 5, 'ice', 4)
    c.rect(3, 1, 7, 1, 'wood', 4)
    ellipse(c, 5, 8, 4.6, 4.2, 'ice', lo=3, hi=5, ambient=0.3)
    for y in range(8, 13):
        for x in range(1, 10):
            if c.alpha(x, y) and math.hypot(x + 0.5 - 5, y + 0.5 - 8) < 4.0:
                c.put_ramp(x, y, col, 3 if (x + y) % 2 else 4)
    c.put_ramp(3, 6, 'bone', 5)
    c.outline()
    return c


def striped_ball(r=9):
    c = Canvas(2 * r + 2, 2 * r + 2)
    cx = cy = r + 0.5
    for y in range(2 * r + 2):
        for x in range(2 * r + 2):
            nx, ny = (x + 0.5 - cx) / r, (y + 0.5 - cy) / r
            L = sphere_L(nx, ny, 0.22)
            if L is None:
                continue
            band = int(((x - cx) * 0.8 + (y - cy) * 0.6 + 40) // 5) % 2
            ramp, lo = ('fire', 1) if band == 0 else ('bone', 2)
            c.put_ramp(x, y, ramp, quant(L, lo, 5, x, y))
    c.outline()
    return c


def basket():
    c = Canvas(24, 16)
    round_rect(c, 1, 7, 22, 14, 'wood', lo=1, hi=4, radius=2)
    for y in (9, 11, 13):
        for x in range(2, 22):
            c.put_ramp(x, y, 'wood', 1 if (x + y) % 3 else 3)
    c.rect(1, 6, 22, 7, 'wood', 4)
    for (bx, by, r) in ((7, 5, 4.2), (14, 4, 3.8), (18, 6, 3.2)):
        col = {7: 'teamA', 14: 'leaf', 18: 'ice'}[bx]
        ellipse(c, bx, by, r, r, col, lo=1, hi=5, ambient=0.25)
        c.line(int(bx - r + 1), int(by + 1), int(bx + r - 1), int(by - 1), col, 5)
    c.outline()
    return c


def bunting(w=144, colors=('fire', 'gold', 'leaf', 'ice', 'purple', 'teamA')):
    c = Canvas(w, 14)
    pts = []
    for x in range(w):
        y = 2 + int(round(4 * math.sin(math.pi * ((x % 36) / 36.0))))
        c.put_ramp(x, y, 'wood', 2)
        pts.append((x, y))
    for k, x0 in enumerate(range(3, w - 6, 9)):
        y0 = pts[x0][1] + 1
        col = colors[k % len(colors)]
        for dy in range(6):
            half = 3 - dy // 2
            for dx in range(-half, half + 1):
                x = x0 + 3 + dx
                if 0 <= x < w:
                    c.put_ramp(x, y0 + dy, col, 4 if dx < 0 else 3 if dx == 0 else 2)
    return c


def puddle(w=18, h=6):
    c = Canvas(w, h)
    ellipse(c, w / 2, h / 2, w / 2 - 0.5, h / 2 - 0.2, 'sky', lo=1, hi=4, ambient=0.5)
    c.put_ramp(w // 2 - 3, h // 2 - 1, 'sky', 5)
    c.put_ramp(w // 2 - 2, h // 2 - 1, 'sky', 5)
    return c


def sprout():
    c = Canvas(7, 8)
    c.rect(3, 3, 3, 7, 'leaf', 3)
    poly(c, [(3, 4), (0, 1), (3, 2)], 'leaf', flat=4)
    poly(c, [(3, 3), (6, 0), (6, 3)], 'leaf', flat=5)
    c.outline()
    return c


def pie():
    """Sahnetorte: Blechform, Sahnehaube, Kirsche (14 x 11)"""
    c = Canvas(14, 11)
    ellipse(c, 7, 8, 6.6, 2.6, 'metal', lo=1, hi=4)
    ellipse(c, 7, 5, 5.6, 3.6, 'bone', lo=3, hi=5, ambient=0.3)
    c.put_ramp(4, 4, 'bone', 5)
    c.put_ramp(5, 3, 'bone', 5)
    c.rect(6, 0, 8, 2, 'teamA', 3)
    c.put_ramp(6, 0, 'teamA', 5)
    c.put_ramp(11, 8, 'bone', 5)
    c.put_ramp(11, 9, 'bone', 4)
    c.outline()
    return c


def bee_big():
    c = Canvas(5, 4)
    c.put_ramp(1, 0, 'bone', 5)
    c.put_ramp(2, 0, 'bone', 4)
    c.put_ramp(1, 1, 'bone', 4)
    for x, i in ((0, 4), (1, 1), (2, 4), (3, 1)):
        c.put_ramp(x, 2, 'gold', i) if i > 1 else c.put_ramp(x, 2, 'coal', 1)
    c.put_ramp(4, 2, 'coal', 1)
    for x in range(1, 4):
        c.put_ramp(x, 3, 'gold', 3)
    return c


def lantern_post():
    c = Canvas(12, 36)
    c.rect(5, 12, 6, 34, 'wood', 2)
    c.rect(5, 12, 5, 34, 'wood', 3)
    c.rect(3, 33, 8, 34, 'wood', 1)
    c.rect(2, 2, 9, 3, 'coal', 2)
    c.rect(2, 12, 9, 13, 'coal', 2)
    c.rect(3, 4, 8, 11, 'gold', 4)
    c.rect(4, 5, 7, 10, 'fire', 4)
    c.rect(5, 6, 6, 9, 'gold', 5)
    c.put_ramp(5, 0, 'coal', 3)
    c.put_ramp(6, 0, 'coal', 2)
    c.put_ramp(5, 1, 'coal', 3)
    c.put_ramp(6, 1, 'coal', 2)
    c.outline()
    return c


def crater(w=22, h=8):
    c = Canvas(w, h)
    ellipse(c, w / 2, h / 2, w / 2 - 0.5, h / 2 - 0.3, 'dirt', lo=0, hi=2, ambient=0.1)
    ellipse(c, w / 2 + 1, h / 2 + 0.6, w / 2 - 4.5, h / 2 - 2.0, 'coal', lo=1, hi=2, ambient=0.2)
    for k in range(6):
        c.put_ramp(2 + k * 3, 1 + (k % 2), 'dirt', 4)
    return c


def trail(world, pts, ramp='bone', depth=9000):
    for k, (x, y) in enumerate(pts):
        wput(world, int(x), int(y), ramp, 5 if k % 2 == 0 else 4, depth - k)


def arc_pts(x0, y0, x1, y1, h, n):
    return [(x0 + (x1 - x0) * t / n, y0 + (y1 - y0) * t / n - h * 4 * (t / n) * (1 - t / n)) for t in range(1, n)]


def mouse_trap(state='armed', helm=False):
    """Riesen-Mausefalle von oben (30 x 18): Brett, Federspule, Fangbuegel; zugeschnappt mit eingeklemmtem Topfhelm"""
    c = Canvas(30, 18)
    round_rect(c, 0, 1, 29, 16, 'wood', lo=3, hi=5, radius=1, ambient=0.5)
    c.rect(1, 15, 28, 16, 'wood', 1)
    for x in range(3, 28, 5):
        c.put_ramp(x, 13, 'wood', 2)
        c.put_ramp(x + 1, 13, 'wood', 2)
    # Federspule am Scharnier
    c.rect(2, 4, 6, 12, 'metal', 2)
    for y in range(5, 12, 2):
        c.rect(2, y, 6, y, 'metal', 5)
    c.put_ramp(1, 8, 'metal', 4)
    if state == 'armed':
        # Fangbuegel zurueckgespannt: Rechteck-Bogen quer ueber dem Brett, gehalten am Riegel
        for x in range(7, 22):
            c.put_ramp(x, 3, 'metal', 5 if x % 3 else 4)
            c.put_ramp(x, 4, 'metal', 2)
            c.put_ramp(x, 12, 'metal', 4)
            c.put_ramp(x, 13, 'metal', 2)
        for y in range(3, 14):
            c.put_ramp(21, y, 'metal', 4)
            c.put_ramp(22, y, 'metal', 2)
        c.rect(23, 6, 27, 10, 'metal', 3)
        c.rect(23, 6, 27, 6, 'metal', 5)
        c.put_ramp(25, 8, 'gold', 5)
    else:
        # zugeschnappt: Buegel liegt flach auf dem Brett und klemmt einen Topfhelm ein
        for x in range(7, 24):
            c.put_ramp(x, 3, 'metal', 5 if x % 3 else 4)
            c.put_ramp(x, 4, 'metal', 2)
            c.put_ramp(x, 13, 'metal', 4)
            c.put_ramp(x, 14, 'metal', 2)
        for y in range(3, 15):
            c.put_ramp(24, y, 'metal', 4)
            c.put_ramp(25, y, 'metal', 2)
        if helm:
            ellipse(c, 15, 9, 6.6, 4.6, 'metal', lo=2, hi=5, ambient=0.25)
            c.rect(10, 9, 20, 9, 'metal', 1)
            c.put_ramp(13, 6, 'metal', 5)
            c.put_ramp(14, 6, 'metal', 5)
            c.rect(15, 5, 16, 6, 'gold', 4)
            for x in range(7, 24):
                c.put_ramp(x, 3, 'metal', 5 if x % 3 else 4)
                c.put_ramp(x, 13, 'metal', 4)
                c.put_ramp(x, 14, 'metal', 2)
    c.outline()
    return c
