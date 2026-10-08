"""pack_art9: Props und Figuren des Arkanums (BF-02): Kristallkugel, Runenkreis, Orrery, Lehrling."""
from __future__ import annotations

import random

from pack_art9_kit import *


def crystal_ball_stand():
    """Kristallkugel auf Steinsockel mit Goldkrallen (34 x 48), wirbelnder Nebel und Glanzpunkt"""
    c = Canvas(34, 48)
    cx, cy, R = 17, 14, 12.0
    # Halo (Dither)
    for y in range(48):
        for x in range(34):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if R + 0.5 < d < R + 4.2 and (x + y) % 2 == 0 and d < R + 3.4 or (R + 3.4 <= d < R + 4.2 and (x % 2 == 0 and y % 2 == 0)):
                c.put_ramp(x, y, 'purple', 4)
    # Sockel
    block(c, 8, 41, 25, 46, 'stone', hi=4, mid=3, lo=2, deep=1)
    block(c, 12, 30, 21, 41, 'stone', hi=4, mid=3, lo=2, deep=1)
    for y in (33, 38):
        hline(c, 11, 22, y, 'gold', 4)
        hline(c, 11, 22, y + 1, 'gold', 2)
    # Krallenschale
    poly(c, [(8, 27), (25, 27), (21, 31), (12, 31)], 'gold', lo=1, hi=5)
    # Kugel: leuchtender Kern (hell), violetter Rand; Nebelwirbel
    for y in range(int(cy - R) - 1, int(cy + R) + 2):
        for x in range(int(cx - R) - 1, int(cx + R) + 2):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy) / R
            if d > 1.0:
                continue
            a = math.atan2(y + 0.5 - cy, x + 0.5 - cx)
            sw = math.sin(a * 2 + d * 6.0)
            glow = 1.0 - d
            if d > 0.9:
                ramp, i = 'purple', 1
            elif d > 0.72:
                ramp, i = 'purple', 3 if (x + y) % 2 == 0 else 2
            elif d > 0.5:
                ramp, i = 'purple', 4
                if (x + y) % 2 == 0:
                    ramp, i = 'ice', 3
            elif d > 0.28:
                ramp, i = 'ice', 4 if (x + y) % 2 == 0 else 3
            else:
                ramp, i = 'ice', 5
            if 0.62 < sw < 0.9 and 0.25 < d < 0.85:
                ramp, i = 'bone', 5
            c.put_ramp(x, y, ramp, i)
    # Glanzlicht oben links
    for (x, y) in ((cx - 7, cy - 5), (cx - 6, cy - 6), (cx - 5, cy - 7), (cx - 4, cy - 8), (cx - 7, cy - 4), (cx - 6, cy - 5)):
        c.put_ramp(x, y, 'bone', 5)
    c.put_ramp(cx + 5, cy + 5, 'gold', 5)
    c.put_ramp(cx - 3, cy + 6, 'gold', 4)
    # Krallenspitzen vorn
    for (x, y) in ((9, 25), (10, 26), (24, 25), (23, 26), (17, 27), (16, 27), (18, 27)):
        c.put_ramp(x, y, 'gold', 5 if x < 17 else 3)
    c.outline()
    return c


def rune_circle(r=21):
    """Runenkreis als Bodendeko (Draufsicht, Durchmesser 2r+3): Goldringe, Hexagramm, Runenpunkte"""
    n = 2 * r + 3
    c = Canvas(n, n)
    cx = cy = (n - 1) / 2.0
    pts = []
    for k in range(6):
        a = math.radians(90 + k * 60)
        pts.append((cx + (r - 5) * math.cos(a), cy - (r - 5) * math.sin(a)))
    seg = [(pts[0], pts[2]), (pts[2], pts[4]), (pts[4], pts[0]), (pts[1], pts[3]), (pts[3], pts[5]), (pts[5], pts[1])]
    for y in range(n):
        for x in range(n):
            d = math.hypot(x - cx, y - cy)
            if d > r + 1.0:
                continue
            i = None
            if r - 1.2 <= d <= r + 1.0:
                i = ('gold', 4 if (x - y) % 3 else 3)
            elif r - 3.4 <= d <= r - 2.4:
                i = ('purple', 4)
            elif d < r - 3.4:
                if (x + y) % 2 == 0:
                    i = ('purple', 2)
                else:
                    i = ('purple', 1)
            if i:
                c.put_ramp(x, y, i[0], i[1])
    # Hexagramm
    for ((x0, y0), (x1, y1)) in seg:
        c.line(int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1)), 'purple', 4)
    # Runenpunkte auf dem Ring
    for k in range(12):
        a = math.radians(k * 30 + 15)
        px_, py_ = cx + (r - 2.2) * math.cos(a), cy + (r - 2.2) * math.sin(a)
        c.put_ramp(int(round(px_)), int(round(py_)), 'gold', 5)
    c.put_ramp(int(cx), int(cy), 'gold', 5)
    c.put_ramp(int(cx) + 1, int(cy), 'gold', 4)
    for (dx, dy) in ((-1, 0), (0, -1), (0, 1)):
        c.put_ramp(int(cx) + dx, int(cy) + dy, 'gold', 4)
    return c


def orrery():
    """Orrery / Armillarsphaere auf Messingfuss (30 x 38): Ringe, Sonne, Planeten"""
    c = Canvas(30, 38)
    cx, cy = 15, 15
    # Fuss
    c.rect(14, 24, 15, 34, 'gold', 3)
    c.rect(14, 24, 14, 34, 'gold', 4)
    poly(c, [(15, 30), (7, 36), (23, 36)], 'gold', lo=1, hi=4)
    c.rect(6, 36, 24, 37, 'gold', 2)
    c.rect(6, 36, 24, 36, 'gold', 4)
    # Ringe (Ellipsen-Umrisse, verschieden geneigt)
    def ring(rx, ry, ang_deg, col, i0, i1, step=1):
        a = math.radians(ang_deg)
        for k in range(0, 360, step * 3):
            t = math.radians(k)
            x = rx * math.cos(t)
            y = ry * math.sin(t)
            xr = cx + x * math.cos(a) - y * math.sin(a)
            yr = cy + x * math.sin(a) + y * math.cos(a)
            c.put_ramp(int(round(xr)), int(round(yr)), col, i1 if (k < 180) else i0)
    ring(13, 4.5, 0, 'gold', 3, 5)
    ring(13, 4.5, 60, 'gold', 3, 5)
    ring(13, 4.5, 120, 'gold', 3, 5)
    ring(8, 8, 0, 'metal', 3, 5)
    # Sonne
    ellipse(c, cx, cy, 3.4, 3.4, 'fire', lo=3, hi=5)
    c.put_ramp(cx - 1, cy - 1, 'gold', 5)
    # Planeten
    ellipse(c, 25, 11, 2.0, 2.0, 'ice', lo=2, hi=5)
    ellipse(c, 6, 19, 1.8, 1.8, 'leaf', lo=2, hi=5)
    ellipse(c, 17, 24, 1.4, 1.4, 'skin', lo=2, hi=5)
    c.outline()
    return c


def apprentice():
    """Zauberlehrling (24 x 32): Hut viel zu gross (haengt ueber die Augen), Sternenrobe, Zauberstab, staunt (Mund 'o')"""
    c = Canvas(24, 32)
    # Fuesse + Robe
    c.rect(7, 30, 10, 31, 'wood', 2)
    c.rect(13, 30, 16, 31, 'wood', 3)
    poly(c, [(6, 14), (17, 14), (20, 30), (3, 30)], 'ice', lo=1, hi=4)
    for x in range(3, 21):
        c.put_ramp(x, 29, 'ice', 1)
        if x % 3 == 0:
            c.put_ramp(x, 30, 'ice', 1)
    for (x, y) in ((8, 19), (13, 23), (10, 27), (15, 18), (6, 25)):
        c.put_ramp(x, y, 'gold', 5)
        c.put_ramp(x + 1, y, 'gold', 3)
        c.put_ramp(x, y + 1, 'gold', 3)
    hline(c, 6, 17, 22, 'gold', 3)
    # Arme: rechter Arm zeigt zur Kugel, hebt den Stab
    thick_line(c, 16, 16, 21, 11, 3.4, 'ice', lo=2, hi=5)
    c.rect(21, 9, 22, 11, 'skin', 4)
    thick_line(c, 21, 10, 22, 2, 1.4, 'wood', lo=2, hi=4)
    ellipse(c, 22, 1.5, 1.6, 1.6, 'gold', lo=3, hi=5)
    thick_line(c, 7, 16, 5, 22, 3.0, 'ice', lo=1, hi=3)
    c.rect(4, 22, 5, 23, 'skin', 3)
    # Kopf unter dem Hut
    ellipse(c, 12, 14, 3.8, 2.8, 'skin', lo=2, hi=5)
    c.put_ramp(13, 14, 'coal', 1)             # Mund: staunendes 'o'
    c.put_ramp(14, 14, 'coal', 1)
    c.put_ramp(14, 12, 'skin', 5)              # Nase
    # Riesenhut: Krempe + gebogene Spitze mit Stern
    ellipse(c, 12, 10.5, 9.6, 2.8, 'purple', lo=0, hi=3)
    poly(c, [(5, 10), (19, 10), (16, 3), (13, 0), (17, 0), (9, 3)], 'purple', lo=1, hi=4)
    hline(c, 5, 19, 9, 'gold', 3)
    c.put_ramp(11, 6, 'gold', 5)
    c.put_ramp(12, 5, 'gold', 5)
    c.put_ramp(12, 7, 'gold', 4)
    c.put_ramp(10, 6, 'gold', 4)
    c.put_ramp(13, 6, 'gold', 4)
    c.outline()
    return c


def star_trail(world, x, y, n=5, ramp='gold'):
    """kleine Sternschweife (Weltpixel)"""
    for k in range(n):
        wput(world, x - k * 2, y + k, ramp, 5 - k // 2, 9100)
        if k % 2 == 0:
            wput(world, x - k * 2 - 1, y + k, ramp, 3, 9100)
