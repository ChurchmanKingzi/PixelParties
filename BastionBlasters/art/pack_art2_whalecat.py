"""pack_art2: UA-18 Walfisch-Katapult (Whale Catapult) - gelangweilter Wal mit Sonnenbrille in der Wurfschale."""
from __future__ import annotations

import math

from pixl import *
from pack_art2_kit import *


def whale_shape(c, x0, x1, yc_fn, tt_fn, up=0.92, dn=1.08):
    return m_profile(c, x0, x1, lambda u: yc_fn(u) - tt_fn(u) * up, lambda u: yc_fn(u) + tt_fn(u) * dn)


def spr_whale_catapult(anim='idle', f=0):
    c = Canvas(64, 54)
    # ---- Raeder (eisenbeschlagen) und Grundbalken
    for wx in (14, 50):
        ellipse(c, wx, 46, 7.2, 7.2, 'wood', lo=0, hi=3, ambient=0.3)
        ellipse(c, wx, 46, 5.4, 5.4, 'wood', lo=2, hi=4, ambient=0.3)
        for k in range(8):
            a = math.radians(k * 45 + 22)
            c.line(wx, 46, wx + round(math.cos(a) * 5), 46 + round(math.sin(a) * 5), 'wood', 1)
        ellipse(c, wx, 46, 1.9, 1.9, 'metal', lo=2, hi=5)
        for k in range(16):
            a = math.radians(k * 22.5)
            c.put_ramp(wx + round(math.cos(a) * 6.6), 46 + round(math.sin(a) * 6.6), 'metal', 3 if k % 2 else 2)
    round_rect(c, 5, 37, 59, 43, 'wood', lo=0, hi=3, radius=2)
    for x in range(6, 59, 12):
        c.rect(x, 37, x + 1, 43, 'metal', 2)
        c.put_ramp(x, 37, 'metal', 4)
    # ---- A-Rahmen, Querbalken, Zahnrad am Drehpunkt
    thick_line(c, 27, 40, 36, 15, 4.4, 'wood', lo=0, hi=3)
    thick_line(c, 47, 40, 38, 15, 4.4, 'wood', lo=1, hi=4)
    thick_line(c, 31, 29, 43, 29, 3.0, 'wood', lo=0, hi=3)
    # Fahnenstange mit Wimpel (Team)
    c.rect(37, 2, 37, 14, 'wood', 3)
    poly(c, [(38, 2), (46, 3), (38, 6)], 'teamA', lo=2, hi=4)
    # ---- Wurfarm (lang zur Schale, kurz hinauf zum Anker) + Zahnrad
    thick_line(c, 37, 15, 21, 33, 4.4, 'wood', lo=1, hi=5)
    thick_line(c, 37, 15, 50, 6, 3.8, 'wood', lo=1, hi=4)
    ellipse(c, 37, 15, 4.2, 4.2, 'metal', lo=1, hi=5, ambient=0.3)
    for k in range(8):
        a = math.radians(k * 45)
        c.put_ramp(37 + round(math.cos(a) * 4.8), 15 + round(math.sin(a) * 4.8), 'metal', 3)
    c.put_ramp(37, 15, 'gold', 5)
    # ---- Schale hinten (Innenseite), dann Wal, dann Schalenfront
    bowl_back = m_ellipse(c, 15, 26, 14, 5)
    shade_mask(c, bowl_back, 'wood', 0, 2, r=2, passes=1, strength=2.0, ambient=0.3)
    # Wal (liegt, Kopf rechts, Schwanz hochgeschwungen links)
    def yc(u):
        return 22 - 11 * (1 - u) ** 2.0

    def tt(u):
        if u < 0.6:
            return 1.3 + 7.0 * (u / 0.6) ** 0.9
        return 9.0 * math.sqrt(max(0.0, 1 - ((u - 0.6) / 0.4) ** 2))
    whale = whale_shape(c, 3, 31, yc, tt)
    fl_a = m_poly(c, [(5, 13), (0, 6), (1, 4), (6, 8), (8, 12)])
    fl_b = m_poly(c, [(6, 14), (11, 8), (13, 9), (9, 14)])
    for m_, lo, hi in ((fl_a, 1, 3), (fl_b, 2, 4)):
        shade_mask(c, m_, 'ice', lo, hi, r=1, passes=1, strength=3.0)
    shade_mask(c, whale, 'ice', 1, 4, r=3, passes=2, strength=6.0, ambient=0.3)
    belly = m_new(c)
    for x in range(8, 30):
        u = (x - 3) / 27.0
        yb = int(round(yc(u) + tt(u) * 0.28 + 1))
        for y in range(yb, c.h):
            if whale[y, x]:
                belly[y, x] = True
    shade_mask(c, belly, 'sky', 3, 5, r=2, passes=2, strength=3.0, ambient=0.5)
    # Sonnenbrille (grosse dunkle Glaeser), gelangweilter Mund, Flosse als Kinnstuetze
    lens = m_ellipse(c, 26.5, 18.6, 3.6, 2.5)
    flat_mask(c, lens, 'coal', 1)
    for (x, y, i) in ((24, 17, 4), (25, 17, 3), (24, 18, 3)):
        c.put_ramp(x, y, 'coal', i)
    c.put_ramp(24, 17, 'ice', 5)
    for x in range(14, 23):
        c.put_ramp(x, 18, 'coal', 1)
    for x in range(21, 32):
        c.put_ramp(x, 23, 'coal', 1)
    c.put_ramp(31, 22, 'coal', 1)
    ellipse(c, 27, 25.5, 4.2, 2.6, 'ice', lo=2, hi=5, ambient=0.3)
    # Fontaene (Blasloch) - schlapp
    for (x, y, i) in ((14, 10, 4), (14, 9, 5), (13, 8, 5), (15, 8, 4), (12, 8, 4), (16, 9, 4), (11, 9, 3), (17, 10, 3)):
        c.put_ramp(x, y, 'sky', i)
    # Schalenfront (Holz, Eisenband)
    bowl = m_poly(c, [(1, 27), (29, 27), (27, 33), (21, 36), (9, 36), (3, 33)])
    bowl |= m_ellipse(c, 15, 29, 14, 7) & m_poly(c, [(0, 28), (30, 28), (30, 38), (0, 38)])
    shade_mask(c, bowl, 'wood', 1, 4, r=3, passes=2, strength=5.0, ambient=0.35)
    for x in range(1, 30):
        if bowl[28, x]:
            c.put_ramp(x, 28, 'metal', 4 if x % 2 else 3)
        if bowl[29, x]:
            c.put_ramp(x, 29, 'metal', 2)
    for x in (5, 11, 17, 23):
        c.put_ramp(x, 31, 'metal', 5)
    # Wassertropfen an der Schale
    for (x, y) in ((4, 31), (25, 32), (13, 34)):
        c.put_ramp(x, y, 'sky', 4)
    # Auflagepfosten unter der Schale
    c.rect(14, 36, 17, 38, 'wood', 1)
    # ---- Gegengewicht: Anker am Seil
    c.line(50, 7, 50, 12, 'bone', 3)
    ellipse(c, 50, 13.5, 2.0, 2.0, 'metal', lo=1, hi=4)
    ellipse(c, 50, 13.5, 0.9, 0.9, 'coal', lo=0, hi=1)
    thick_line(c, 50, 15, 50, 24, 1.8, 'metal', lo=1, hi=4)
    thick_line(c, 50, 19, 54, 19, 1.4, 'metal', lo=1, hi=3)
    thick_line(c, 50, 19, 46, 19, 1.4, 'metal', lo=2, hi=4)
    for (x0, y0, x1, y1) in ((44, 21, 47, 25), (56, 21, 53, 25)):
        thick_line(c, x0, y0, x1, y1, 1.8, 'metal', lo=1, hi=4)
    thick_line(c, 47, 25, 53, 25, 1.8, 'metal', lo=1, hi=3)
    c.outline()
    return c


def spr_whale_ball(f=0):
    """der gelangweilte Wal als Geschoss, fliegt nach rechts (30 x 18)"""
    c = Canvas(30, 18)

    def yc(u):
        return 9.5 - 4.0 * (1 - u) ** 2.0

    def tt(u):
        if u < 0.6:
            return 1.0 + 4.6 * (u / 0.6) ** 0.9
        return 5.6 * math.sqrt(max(0.0, 1 - ((u - 0.6) / 0.4) ** 2))
    whale = whale_shape(c, 4, 27, yc, tt)
    fl = m_poly(c, [(7, 7), (2, 2), (1, 5), (5, 8)])
    fl2 = m_poly(c, [(8, 8), (4, 12), (2, 10), (6, 7)])
    shade_mask(c, fl, 'ice', 1, 3, r=1, passes=1, strength=3.0)
    shade_mask(c, fl2, 'ice', 2, 4, r=1, passes=1, strength=3.0)
    shade_mask(c, whale, 'ice', 1, 4, r=2, passes=2, strength=6.0, ambient=0.3)
    belly = m_new(c)
    for x in range(8, 27):
        u = (x - 4) / 23.0
        yb = int(round(yc(u) + tt(u) * 0.3 + 1))
        for y in range(yb, c.h):
            if whale[y, x]:
                belly[y, x] = True
    shade_mask(c, belly, 'sky', 3, 5, r=1, passes=1, strength=2.0, ambient=0.5)
    flat_mask(c, m_ellipse(c, 21.5, 7.6, 2.6, 1.8), 'coal', 1)       # Sonnenbrille
    c.put_ramp(20, 7, 'ice', 5)
    for x in range(14, 19):
        c.put_ramp(x, 7, 'coal', 1)
    for x in range(20, 27):
        c.put_ramp(x, 12 - (1 if x > 24 else 0), 'coal', 1)
    ellipse(c, 19, 14, 2.6, 1.6, 'ice', lo=2, hi=5)
    c.outline()
    return c
