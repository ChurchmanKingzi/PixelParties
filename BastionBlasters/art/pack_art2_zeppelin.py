"""pack_art2: Artillerie-Sprites (UA-14 .. UA-18) und ihre kleinen Geschosse."""
from __future__ import annotations

import math
import random

from pixl import *
from pack_art2_kit import *


# =========================================================================== UA-14 Brummzeppelin (64 x 46)


def spr_zeppelin(anim='idle', f=0):
    c = Canvas(64, 46)
    x0, x1 = 4, 61

    def yc(u):
        return 15.0 - 8.5 * (1 - u) ** 2.2

    def tt(u):
        if u < 0.6:
            return 1.6 + 10.0 * (u / 0.6) ** 0.9
        return 11.6 * math.sqrt(max(0.0, 1 - ((u - 0.6) / 0.4) ** 2))

    def top(u):
        return yc(u) - tt(u) * 0.96

    def bot(u):
        return yc(u) + tt(u) * 1.08

    body = m_profile(c, x0, x1, top, bot)
    fluke_top = m_poly(c, [(9, 8), (2, 0), (0, 4), (5, 8)])
    fluke_bot = m_poly(c, [(9, 9), (3, 16), (1, 12), (6, 8)])
    dorsal = m_poly(c, [(21, 8), (26, 1), (30, 5), (30, 9)])
    pect = m_poly(c, [(40, 24), (45, 32), (49, 30), (46, 23)])
    for m_, lo, hi in ((fluke_bot, 1, 3), (fluke_top, 2, 4), (dorsal, 2, 4), (pect, 1, 3)):
        shade_mask(c, m_, 'teamA', lo, hi, r=1, passes=1, strength=3.0)
    shade_mask(c, body, 'metal', 1, 4, r=4, passes=2, strength=7.0, ambient=0.30)
    # heller Bauch mit Kehlfalten (folgt der Kontur)
    belly = m_new(c)
    for x in range(x0 + 10, x1 - 1):
        u = (x - x0) / (x1 - x0)
        yb = int(round(yc(u) + tt(u) * 0.30 + 1))
        for y in range(yb, c.h):
            if body[y, x]:
                belly[y, x] = True
    shade_mask(c, belly, 'fur', 2, 4, r=2, passes=2, strength=3.0, ambient=0.5)
    for k in range(3):
        for x in range(38, 59):
            u = (x - x0) / (x1 - x0)
            y = int(round(yc(u) + tt(u) * 0.30 + 3 + k * 2))
            if belly[y, x] and (x + k) % 4 != 0:
                c.put_ramp(x, y, 'fur', 2)
    # Naehte (Ringe) mit Nieten
    for sx in (14, 22, 30, 38, 46):
        u = (sx - x0) / (x1 - x0)
        a = int(round(top(u)))
        b = int(round(bot(u)))
        for y in range(a + 1, b):
            if body[y, sx] and not belly[y, sx]:
                c.put_ramp(sx, y, 'metal', 1 if (y + sx) % 2 else 2)
        for y in range(a + 2, b - 3, 3):
            if body[y, sx - 1] and not belly[y, sx - 1]:
                c.put_ramp(sx - 1, y, 'metal', 4)
    # Bullaugen
    for (px_, py_) in ((17, 14), (24, 15), (31, 16)):
        ellipse(c, px_ + 0.5, py_ + 0.5, 3.4, 3.4, 'metal', lo=0, hi=2, ambient=0.3)
        ellipse(c, px_ + 0.5, py_ + 0.5, 2.3, 2.3, 'gold', lo=3, hi=5, ambient=0.45)
        c.put_ramp(px_, py_, 'gold', 5)
    # Auge + Mund (lange Walkurve)
    c.rect(53, 12, 54, 13, 'coal', 1)
    c.put_ramp(53, 12, 'bone', 5)
    for x in range(46, 61):
        y = 19 + int((60 - x) * 0.2)
        c.put_ramp(x, y, 'coal', 1)
    c.put_ramp(45, 21, 'coal', 1)
    # Gondel + Streben
    for sx in (30, 40):
        c.line(sx, 25, sx, 29, 'wood', 1)
    c.rect(27, 29, 43, 29, 'wood', 5)
    round_rect(c, 27, 29, 43, 35, 'wood', lo=1, hi=4, radius=2)
    for wx in (31, 36):
        c.rect(wx, 31, wx + 1, 32, 'gold', 5)
    c.rect(27, 29, 43, 29, 'wood', 5)
    # Propeller hinten (Brummen)
    c.rect(24, 31, 26, 32, 'metal', 3)
    pf = f % 2
    for k in range(-4, 5):
        if abs(k) > 1:
            c.put_ramp(23, 32 + k, 'bone', 3 if (k + pf) % 2 else 4)
    # zwei Bomben (Doppelbombe)
    c.rect(30, 36, 41, 36, 'metal', 3)
    for bx in (32, 39):
        ellipse(c, bx, 40, 2.9, 2.9, 'coal', lo=1, hi=4, ambient=0.3)
        c.put_ramp(bx - 1, 38, 'coal', 5)
        c.put_ramp(bx, 36, 'gold', 4)
        c.put_ramp(bx + 1, 35, 'gold', 5)
    c.outline()
    return c
