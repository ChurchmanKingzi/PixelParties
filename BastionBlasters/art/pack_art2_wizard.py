"""pack_art2: UA-16 Sternschnuppen-Zauberer (Shooting-Star Wizard) - Greis im Schlafanzug mit Sternenhut."""
from __future__ import annotations

from pixl import *
from pack_art2_kit import *


def _star(c, cx, cy, big=False, ramp='gold'):
    c.put_ramp(cx, cy, ramp, 5)
    for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        c.put_ramp(cx + dx, cy + dy, ramp, 4)
    if big:
        for (dx, dy) in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            c.put_ramp(cx + dx, cy + dy, ramp, 3)


def spr_star_wizard(anim='idle', f=0):
    c = Canvas(38, 48)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    # Pantoffeln (flauschig, teamA) und gestreifte Hosenbeine
    for (lx, lo, hi) in ((11, 1, 3), (19, 2, 4)):
        thick_line(c, lx + 2, 34, lx + 2, 43, 4.2, 'ice', lo=1, hi=3)
        for y in range(36, 43):
            if y % 3 == 0:
                for x in range(lx, lx + 5):
                    if c.alpha(x, y):
                        c.put_ramp(x, y, 'ice', 4 if x < lx + 2 else 3)
        ellipse(c, lx + 3.5, 44.4, 5.4, 3.0, 'teamA', lo=lo, hi=hi + 1, ambient=0.3)
        c.put_ramp(lx + 7, 43, 'teamA', 5)
        c.put_ramp(lx + 2, 43, 'teamA', 5)
    # Nachthemd mit Streifen, Kordel
    shirt = m_poly(c, [(9, 20), (26, 20), (28, 36), (7, 36)])
    shade_mask(c, shirt, 'ice', 1, 3, r=2, passes=2, strength=3.0, ambient=0.5)
    for y in range(23, 36, 4):
        for x in range(7, 29):
            if shirt[y, x]:
                c.put_ramp(x, y, 'ice', 4 if x < 16 else 3)
                if shirt[y + 1, x]:
                    c.put_ramp(x, y + 1, 'ice', 3 if x < 16 else 2)
    for x in range(9, 27):
        if shirt[28, x]:
            c.put_ramp(x, 28, 'gold', 3)
    c.put_ramp(18, 28, 'gold', 5)
    c.put_ramp(18, 29, 'gold', 4)
    c.put_ramp(19, 30, 'gold', 3)
    # Bart (lang, weiss, schmal)
    beard = m_poly(c, [(13, 18), (23, 18), (21, 25), (18, 31), (15, 25)])
    shade_mask(c, beard, 'bone', 3, 5, r=2, passes=2, strength=4.0, ambient=0.55)
    for (x, y) in ((16, 22), (18, 26), (20, 21), (17, 29)):
        c.put_ramp(x, y, 'bone', 3)
    # Arme: der linke haelt das Hemd, der rechte reckt den Zauberstab
    thick_line(c, 10, 22, 7, 30, 3.4, 'ice', lo=1, hi=3)
    c.put_ramp(7, 31, 'skin', 3)
    c.put_ramp(8, 31, 'skin', 2)
    thick_line(c, 25, 22, 31, 16 + bob, 3.4, 'ice', lo=2, hi=4)
    ellipse(c, 32, 15.5 + bob, 1.9, 1.9, 'skin', lo=2, hi=5)
    thick_line(c, 32, 17 + bob, 34, 6 + bob, 1.4, 'wood', lo=2, hi=4)
    # Stern am Stab
    sx, sy = 34, 4 + bob
    ellipse(c, sx, sy, 2.6, 2.6, 'gold', lo=3, hi=5, ambient=0.5)
    for (dx, dy) in ((0, -4), (0, 4), (4, 0), (-4, 0)):
        c.put_ramp(sx + dx, sy + dy, 'gold', 4)
    c.put_ramp(sx - 1, sy - 1, 'gold', 5)
    # Kopf: Nase, schlaefriger Strich als Auge
    ellipse(c, 17.5, 15, 4.6, 4.4, 'skin', lo=2, hi=5)
    ellipse(c, 22.4, 16, 1.8, 1.7, 'skin', lo=3, hi=5)
    c.put_ramp(20, 14, 'coal', 1)
    c.put_ramp(21, 14, 'coal', 1)
    # Hut: schmale Krempe, Kegel kippt nach hinten, Spitze haengt ab mit Bommel
    ellipse(c, 17.5, 11, 8.6, 2.4, 'purple', lo=0, hi=3, ambient=0.3)
    cone = m_poly(c, [(11, 11), (24, 11), (21, 5), (15, 2), (8, 3), (2, 8), (3, 12), (6, 9), (10, 8), (13, 10)])
    shade_mask(c, cone, 'purple', 1, 4, r=2, passes=2, strength=3.0, ambient=0.35)
    for x in range(10, 25):
        c.put_ramp(x, 10, 'gold', 3 if x % 2 else 2)
    _star(c, 17, 6)
    _star(c, 10, 6)
    c.put_ramp(22, 8, 'gold', 4)
    ellipse(c, 2.5, 12.5, 1.9, 1.9, 'gold', lo=3, hi=5)
    c.outline()
    return c
