"""pack_art11: Hof-Bauteile und Tuerme (Eilgang, Rutschbahn, Rueckholportal, Schildkuppel, Fangnetz, Dunstkamin, Blitzableiter)."""
from __future__ import annotations

from pack_art11_util import *
from pack_art11_chars import *


# =========================================================================== Zahnrad


def cog(r=5, teeth=8, ramp='gold', phase=0.0, hub=True):
    """Zahnrad (Draufsicht/Vorderansicht, schattiert), Durchmesser ~ 2r + 4"""
    d = int(r * 2 + 5)
    c = Canvas(d, d)
    cx = cy = (d - 1) / 2.0
    for y in range(d):
        for x in range(d):
            dx, dy = x - cx, y - cy
            rr = math.hypot(dx, dy)
            ang = math.atan2(dy, dx)
            tooth = 0.5 + 0.5 * math.cos(ang * teeth + phase)
            rad = r - 0.6 + (1.5 if tooth > 0.5 else 0.0)
            if rr > rad:
                continue
            nx, ny = dx / (r + 1.5), dy / (r + 1.5)
            L = 0.55 - 0.5 * (nx * 0.55 + ny * 0.65) + (0.12 if rr > r - 1.5 else 0.0)
            c.put_ramp(x, y, ramp, quant(max(0.0, min(1.0, L)), 1, 5, x, y))
    if hub:
        hr = max(1.2, r * 0.36)
        for y in range(d):
            for x in range(d):
                if math.hypot(x - cx, y - cy) <= hr:
                    c.put_ramp(x, y, 'coal', 1)
        c.put_ramp(int(cx), int(cy), 'metal', 4)
    c.outline()
    return c


# =========================================================================== Eilgang (BU-06)


def conveyor_base(cells=3):
    """Rollband (Draufsicht): Nordschiene, Band mit Pfeilen, Endwalzen. Breite 32 * cells + 4, Hoehe 27"""
    W, H = 32 * cells + 4, 27
    c = Canvas(W, H)
    # Nordschiene (Draufsicht, Licht oben)
    for y, idx in enumerate((5, 4, 4, 3, 2, 1)):
        for x in range(4, W - 4):
            c.put_ramp(x, y, 'metal', idx)
    for x in range(8, W - 8, 12):
        rivet(c, x, 2)
    # Band
    by0, by1 = 6, 25
    for y in range(by0, by1 + 1):
        for x in range(6, W - 6):
            seg = (x - 6) // 3
            idx = 2 if seg % 2 == 0 else 1
            if y <= by0 + 1:
                idx = 0
            if y >= by1:
                idx = 1
            c.put_ramp(x, y, 'coal', idx)
    # Pfeile (Chevrons nach rechts)
    for x0 in range(10, W - 12, 14):
        for dy in range(-7, 8):
            xx = x0 + 7 - abs(dy)
            yy = (by0 + by1) // 2 + dy + 1
            c.put_ramp(xx, yy, 'gold', 4)
            c.put_ramp(xx - 1, yy, 'gold', 3)
            c.put_ramp(xx + 1, yy, 'gold', 2)
    # Endwalzen (Zylinder quer, Licht links)
    for xs in (0, W - 7):
        for y in range(1, 27):
            for k in range(7):
                x = xs + k
                L = 0.92 - 0.14 * k
                if k == 0 or k == 6:
                    L -= 0.3
                c.put_ramp(x, y, 'metal', quant(max(0.0, L), 1, 5, x, y))
        for y in range(3, 26, 4):
            c.rect(xs + 1, y, xs + 5, y, 'metal', 1)
    c.outline()
    return c


def conveyor_front(cells=3):
    """Suedseite (Vorderansicht): Blechfront mit Zahnraedern, Beine, Nieten (Breite 32 * cells + 4, Hoehe 17)"""
    W, H = 32 * cells + 4, 17
    c = Canvas(W, H)
    for x in range(1, W - 1):
        c.put_ramp(x, 0, 'metal', 5)
        c.put_ramp(x, 1, 'metal', 4)
    for y in range(2, 14):
        for x in range(1, W - 1):
            L = 0.72 - 0.035 * (y - 2)
            c.put_ramp(x, y, 'metal', quant(L, 1, 3, x, y))
    for x in range(1, W - 1):
        c.put_ramp(x, 13, 'metal', 1)
    # Zahnraeder auf der Front (gross + klein, gegenlaeufig)
    for k, x0 in enumerate(range(10, W - 24, 28)):
        c.blit(cog(3, 6, 'gold', 0.4 + k), x0, 2)
        c.blit(cog(2, 6, 'gold', 1.0), x0 + 10, 5)
    for x in range(6, W - 6, 14):
        rivet(c, x, 1)
    # Beine
    for x0 in (4, W - 9):
        c.rect(x0, 13, x0 + 4, 16, 'metal', 2)
        c.rect(x0, 13, x0, 16, 'metal', 4)
    c.outline()
    return c


def bell_post(ring=False):
    """Pfosten mit Messingglocke am Ausleger, Zugschnur (16 x 38)"""
    c = Canvas(16, 38)
    c.rect(2, 12, 4, 36, 'wood', 3)
    c.rect(2, 12, 2, 36, 'wood', 4)
    c.rect(4, 12, 4, 36, 'wood', 1)
    c.rect(0, 35, 7, 37, 'wood', 2)
    c.rect(0, 35, 7, 35, 'wood', 4)
    # Ausleger
    c.rect(2, 11, 13, 12, 'wood', 3)
    c.rect(2, 11, 13, 11, 'wood', 5)
    c.line(4, 18, 9, 12, 'wood', 2)
    # Glocke
    poly(c, [(8, 14), (14, 14), (15, 20), (7, 20)], 'gold', lo=2, hi=5)
    ellipse(c, 11, 14.5, 3.0, 3.2, 'gold', lo=2, hi=5, clip=lambda x, y: y <= 15)
    c.rect(7, 20, 15, 20, 'gold', 3)
    c.put_ramp(11, 22, 'wood', 4)
    c.put_ramp(11, 21, 'gold', 4)
    c.put_ramp(9, 15, 'gold', 5)
    c.put_ramp(9, 16, 'gold', 5)
    # Zugschnur
    for y in range(13, 30):
        c.put_ramp(6, y, 'bone', 3)
    c.put_ramp(6, 30, 'teamA', 3)
    c.put_ramp(6, 31, 'teamA', 2)
    c.outline()
    return c


def ding(world, x, y):
    """Klingel-Klang: zwei kleine Bogen und ein Stern"""
    for (dx, dy, i) in ((3, -2, 5), (4, -1, 4), (4, 0, 4), (4, 1, 4), (3, 2, 5), (7, -4, 4), (8, -3, 3), (8, -1, 3), (8, 1, 3), (7, 3, 4)):
        px_at(world, x + dx, y + dy, 'gold', i, 9500)
    star(world, x - 3, y - 5, 'gold', False)
