"""pack_art2: UA-17 Dicke Berta (Big Bertha) - Haubitze auf Raupen, Schnurrbart am Rohr, Zylinderhut."""
from __future__ import annotations

from pixl import *
from pack_art2_kit import *

S = -5                                                # Rumpf nach links, damit das Rohr Platz hat


def spr_big_bertha(anim='idle', f=0):
    c = Canvas(64, 52)
    ty = 43                                           # Mitte der Raupe
    # ---- Raupenband (Kapsel) mit Profilstollen
    belt = m_ellipse(c, 9 + S, ty, 7, 7) | m_ellipse(c, 53 + S, ty, 7, 7)
    belt |= m_poly(c, [(9 + S, ty - 7), (53 + S, ty - 7), (53 + S, ty + 7), (9 + S, ty + 7)])
    shade_mask(c, belt, 'coal', 1, 3, r=3, passes=2, strength=6.0, ambient=0.4)
    for x in range(0, 62):
        if x % 3 == 0:
            for y in (ty - 7, ty + 7, ty - 6, ty + 6):
                if belt[y, x]:
                    c.put_ramp(x, y, 'coal', 4 if y < ty else 0)
    for wx, r in ((9, 4.6), (18, 3.4), (26, 3.4), (34, 3.4), (42, 3.4), (53, 4.6)):
        ellipse(c, wx + S, ty + 1, r, r, 'metal', lo=1, hi=4, ambient=0.3)
        c.put_ramp(wx + S, ty + 1, 'gold', 4)
    # ---- Rumpf mit schraeger Front und Teamband
    hull = m_poly(c, [(6 + S, 38), (6 + S, 31), (12 + S, 27), (47 + S, 27), (57 + S, 33), (57 + S, 38)])
    shade_mask(c, hull, 'metal', 1, 4, r=3, passes=2, strength=5.0, ambient=0.34)
    for x in range(0, 64):
        if hull[34, x]:
            c.put_ramp(x, 34, 'teamA', 3 if x % 4 else 4)
            if hull[35, x]:
                c.put_ramp(x, 35, 'teamA', 2)
    for x in range(5, 52, 4):
        if hull[30, x]:
            c.put_ramp(x, 30, 'metal', 5)
        if hull[37, x]:
            c.put_ramp(x, 37, 'metal', 5)
    for x in (17 + S, 40 + S):
        for y in range(29, 34):
            if hull[y, x]:
                c.put_ramp(x, y, 'metal', 0)
    # ---- Rohr: lang, flach nach oben rechts (hinter der Wiege beginnend)
    x0, y0, x1, y1 = 30, 23, 59, 12
    thick_line(c, x0, y0, x1, y1, 6.4, 'metal', lo=1, hi=4)
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln
    nx, ny = -uy, ux
    for t in (0.42, 0.62):
        bx, by = x0 + dx * t, y0 + dy * t
        thick_line(c, bx - nx * 3.4, by - ny * 3.4, bx + nx * 3.4, by + ny * 3.4, 1.8, 'gold', lo=2, hi=5)
    bx, by = x1 - ux * 1.8, y1 - uy * 1.8
    thick_line(c, bx - nx * 4.2, by - ny * 4.2, bx + nx * 4.2, by + ny * 4.2, 3.0, 'metal', lo=2, hi=5)
    ellipse(c, x1 + 1.0, y1 - 0.4, 1.4, 2.8, 'coal', lo=0, hi=2)
    # ---- Gehaeuse (Wiege) mit Monokel
    cradle = m_poly(c, [(16, 29), (16, 22), (19, 19), (31, 19), (35, 23), (35, 29)])
    shade_mask(c, cradle, 'metal', 1, 4, r=3, passes=2, strength=5.0, ambient=0.3)
    for (x, y) in ((19, 21), (19, 26), (32, 27)):
        c.put_ramp(x, y, 'metal', 5)
    ellipse(c, 29.5, 25.0, 3.0, 3.0, 'gold', lo=2, hi=5, ambient=0.3)
    ellipse(c, 29.5, 25.0, 1.7, 1.7, 'ice', lo=4, hi=5, ambient=0.5)
    c.put_ramp(28, 24, 'bone', 5)
    thick_line(c, 31, 28, 32, 33, 1.0, 'gold', lo=2, hi=3)
    # ---- Zylinderhut auf der Wiege
    hx = 22
    ellipse(c, hx + 4.0, 19, 6.6, 2.0, 'coal', lo=0, hi=3, ambient=0.3)
    for y in range(8, 19):
        for x in range(hx, hx + 8):
            idx = [4, 4, 3, 3, 2, 2, 1, 1][x - hx]
            c.put_ramp(x, y, 'coal', idx)
    for x in range(hx, hx + 8):
        c.put_ramp(x, 7, 'coal', 5 if x < hx + 4 else 4)
    for y in (14, 15, 16):
        for x in range(hx, hx + 8):
            c.put_ramp(x, y, 'teamA', 4 if x < hx + 3 else (3 if x < hx + 6 else 2))
    c.rect(hx + 5, 14, hx + 6, 16, 'gold', 4)
    c.put_ramp(hx + 5, 15, 'coal', 1)
    # ---- Schnurrbart unter der Muendung (Handlebar mit hochgezwirbelten Spitzen)
    mx, my = 54, 19
    segs = (((mx, my - 1), (mx - 4, my + 1), 4.0), ((mx - 4, my + 1), (mx - 8, my + 1), 3.4), ((mx - 8, my + 1), (mx - 10, my - 2), 2.4),
            ((mx, my - 1), (mx + 3, my + 1), 4.0), ((mx + 3, my + 1), (mx + 6, my + 1), 3.2), ((mx + 6, my + 1), (mx + 8, my - 2), 2.4))
    for (a, b, w) in segs:
        thick_line(c, a[0], a[1], b[0], b[1], w, 'wood', lo=0, hi=3, ambient=0.4)
    for (x, y) in ((mx - 9, my - 3), (mx + 7, my - 3), (mx - 5, my), (mx + 2, my)):
        c.put_ramp(x, y, 'wood', 4)
    # ---- Auspuff hinten
    c.rect(4, 21, 7, 28, 'metal', 2)
    c.rect(4, 21, 4, 28, 'metal', 4)
    c.rect(3, 19, 8, 20, 'metal', 1)
    c.outline()
    return c
