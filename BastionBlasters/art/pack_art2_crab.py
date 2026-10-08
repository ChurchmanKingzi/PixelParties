"""pack_art2: US-10 Zangen-Panzerkrebs (Pincer Armor-Crab) - Krebs in Ritterruestung, Zange wie ein Schluesselring."""
from __future__ import annotations

import math

from pixl import *
from pack_art2_kit import *


def _leg(c, pts, w=2.4, lo=1, hi=3):
    for (a, b) in zip(pts[:-1], pts[1:]):
        thick_line(c, a[0], a[1], b[0], b[1], w, 'fire', lo=lo, hi=hi)


def spr_pincer_crab(anim='idle', f=0):
    c = Canvas(56, 40)
    st = [0, 1][f % 2]
    # ---- Beine (3 je Seite), hinten dunkler
    _leg(c, [(14, 26), (6, 27 - st), (3, 34)], lo=0, hi=2)
    _leg(c, [(18, 28), (10, 32 + st), (8, 38)], lo=0, hi=2)
    _leg(c, [(31, 28), (38, 32 - st), (40, 38)], lo=0, hi=2)
    _leg(c, [(16, 27), (7, 24 + st), (2, 30)], lo=1, hi=3)
    _leg(c, [(34, 27), (43, 28 - st), (47, 35)], lo=1, hi=3)
    for (x, y) in ((3, 34), (8, 38), (40, 38), (2, 30), (47, 35)):
        c.put_ramp(x, y, 'fire', 4)
    # ---- kleine Zange links (hochgereckt)
    _leg(c, [(11, 22), (5, 17), (4, 11)], w=3.4, lo=1, hi=4)
    poly(c, [(2, 11), (4, 3), (7, 4), (6, 10)], 'fire', lo=1, hi=4)
    poly(c, [(7, 11), (9, 5), (11, 7), (9, 12)], 'fire', lo=2, hi=5)
    c.put_ramp(4, 4, 'bone', 4)
    # ---- Panzer: breiter Rumpf, Rand in Krebsrot, Plattenfugen und Nieten
    shell = m_ellipse(c, 24, 24, 16.5, 10.0)
    shade_mask(c, shell, 'fire', 1, 4, r=4, passes=2, strength=6.0, ambient=0.3)
    armor = m_ellipse(c, 24, 22, 14.5, 8.0)
    shade_mask(c, armor, 'metal', 1, 4, r=4, passes=2, strength=6.0, ambient=0.32)
    for x in range(10, 40):
        put_if_solid(c, x, 29, 'metal', 1)
    for sx in (14, 20, 26, 32):
        for y in range(15, 29):
            if armor[y, sx] and armor[y - 1, sx]:
                c.put_ramp(sx, y, 'metal', 0 if (y + sx) % 2 else 1)
                if y % 4 == 1:
                    put_if_solid(c, sx + 1, y, 'metal', 5)
    for x in range(11, 38, 3):
        put_if_solid(c, x, 28, 'metal', 5)
    for y in range(21, 24):                                  # Teamband quer
        for x in range(9, 40):
            if armor[y, x]:
                c.put_ramp(x, y, 'teamA', 3 if y == 22 else (4 if y == 21 else 2))
    # ---- Eisenhut vorn: Visierschlitz, Federbusch (Team), Augenstiele ragen heraus
    for (ex, sx_) in ((33, 0), (37, 1)):
        thick_line(c, ex, 12, ex + sx_, 6, 1.4, 'fire', lo=2, hi=4)
        ellipse(c, ex + sx_ + 0.5, 5, 1.8, 1.8, 'fire', lo=3, hi=5)
        c.rect(ex + sx_ + 1, 4, ex + sx_ + 1, 5, 'coal', 1)
    helm = m_poly(c, [(30, 22), (30, 11), (33, 9), (40, 9), (42, 12), (42, 22)])
    shade_mask(c, helm, 'metal', 1, 4, r=2, passes=2, strength=5.0, ambient=0.3)
    for x in range(31, 42):
        c.put_ramp(x, 15, 'coal', 1)
    for x in range(36, 42):
        c.put_ramp(x, 16, 'coal', 2)
    for (x, y) in ((32, 12), (40, 12), (32, 19), (40, 19)):
        c.put_ramp(x, y, 'metal', 5)
    c.rect(36, 17, 36, 21, 'metal', 0)                       # Nasenband
    c.put_ramp(35, 10, 'metal', 5)
    for k in range(7):                                       # Busch im Wind
        c.put_ramp(31 - k, 9 - (1 if 1 < k < 5 else 0) + (1 if k > 5 else 0), 'teamA', 4 if k < 3 else 3)
        c.put_ramp(31 - k, 10 - (1 if 1 < k < 5 else 0) + (1 if k > 5 else 0), 'teamA', 3 if k < 4 else 2)
    # ---- grosse Ringzange rechts (Schluesselring) mit Armgelenk
    _leg(c, [(36, 25), (44, 24), (46, 18)], w=4.0, lo=1, hi=4)
    ring = m_ellipse(c, 47, 11, 6.4, 6.4) & ~m_ellipse(c, 47, 11, 3.2, 3.2)
    ring &= ~m_poly(c, [(46, 4), (52, 7), (49, 11), (46, 8)])           # Spalt oben rechts
    shade_mask(c, ring, 'fire', 1, 5, r=1, passes=1, strength=3.0, ambient=0.35)
    tip_a = m_poly(c, [(46, 5), (51, 5), (52, 9), (49, 7)])
    shade_mask(c, tip_a, 'fire', 2, 5, r=1, passes=1, strength=2.0)
    c.put_ramp(50, 5, 'bone', 5)
    # kleine Schluessel am Ring
    for (kx, ky, n) in ((53, 16, 0), (50, 19, 1)):
        c.line(kx, ky, kx, ky + 4, 'gold', 4)
        c.put_ramp(kx + 1, ky + 3, 'gold', 3)
        c.put_ramp(kx + 1, ky + 4, 'gold', 3)
        c.put_ramp(kx - 1, ky - 1, 'gold', 5)
        c.put_ramp(kx, ky - 1, 'gold', 5)
        c.put_ramp(kx + 1, ky - 1, 'gold', 4)
    c.outline()
    return c
