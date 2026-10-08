"""pack_art2: US-08 Wuehl-Gnom (Burrowing Gnome) - Gnom mit Bohrer-Helm, schaufelt sich durch die Erde."""
from __future__ import annotations

import math

from pixl import *
from pack_art2_kit import *


def drill_cone(c, bx, by, tx, ty, base_r, phase=0):
    """Bohrerkegel (Spirale aus hellen/dunklen Streifen) von der Basis (bx, by) zur Spitze (tx, ty)"""
    dx, dy = tx - bx, ty - by
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln
    nx, ny = -uy, ux
    pts = [(bx + nx * base_r, by + ny * base_r), (tx, ty), (bx - nx * base_r, by - ny * base_r)]
    m = m_poly(c, pts)
    ys, xs = np.nonzero(m)
    for y, x in zip(ys, xs):
        px, py = x + 0.5 - bx, y + 0.5 - by
        t = px * ux + py * uy
        s = px * nx + py * ny                         # -base_r .. base_r (positiv = unten rechts)
        stripe = int(math.floor((t + 0.9 * s) / 2.6 + phase)) % 2
        shade = 1 - (s + base_r) / (2 * base_r)       # oben/links hell
        idx = 4 if stripe == 0 else 2
        if shade > 0.7:
            idx += 1
        elif shade < 0.25:
            idx -= 1
        c.put_ramp(int(x), int(y), 'metal' if stripe == 0 or True else 'gold', max(0, min(5, idx)))
        if stripe == 1 and shade > 0.3:
            c.put_ramp(int(x), int(y), 'gold', 3 if shade < 0.7 else 4)
    return m


def spr_burrow_gnome(anim='idle', f=0):
    c = Canvas(38, 38)
    st = [0, 1][f % 2]
    # ---- Beine (kurz, im Laufschritt) mit Stiefeln
    thick_line(c, 14, 28, 10, 34 - st, 3.4, 'dirt', lo=0, hi=2)
    for x in range(6, 13):
        c.put_ramp(x, 35, 'wood', 1)
        c.put_ramp(x, 36, 'wood', 0)
        c.put_ramp(x, 34, 'wood', 2)
    thick_line(c, 18, 28, 22, 33 + st, 3.8, 'dirt', lo=1, hi=3)
    for x in range(19, 27):
        c.put_ramp(x, 36, 'wood', 1)
        c.put_ramp(x, 35, 'wood', 2)
        c.put_ramp(x, 34, 'wood', 3 if x < 24 else 2)
    # ---- ferner Arm
    thick_line(c, 12, 20, 14, 27, 3.0, 'leaf', lo=0, hi=2)
    # ---- Koerper: Hemd (Team) + Latzhose
    body = m_ellipse_rot(c, 16.5, 22, 6.6, 7.6, 14)
    shade_mask(c, body, 'leaf', 1, 4, r=3, passes=2, strength=5.0, ambient=0.32)
    pants = body & (np.mgrid[0:c.h, 0:c.w][0] >= 24)
    shade_mask(c, pants, 'dirt', 1, 4, r=2, passes=2, strength=4.0, ambient=0.35)
    for y in range(18, 24):                               # Traeger
        put_if_solid(c, 13, y, 'dirt', 3)
        put_if_solid(c, 20, y, 'dirt', 2)
    c.put_ramp(13, 23, 'gold', 5)
    c.put_ramp(20, 23, 'gold', 4)
    for x in range(11, 23):
        put_if_solid(c, x, 24, 'wood', 2)
    # ---- Arm mit Schaufel (graebt nach vorn unten)
    thick_line(c, 19, 18, 24, 23, 3.4, 'leaf', lo=2, hi=5)
    ellipse(c, 25, 24, 2.3, 2.1, 'skin', lo=2, hi=5)
    thick_line(c, 22, 20, 33, 31, 1.6, 'wood', lo=2, hi=4)
    poly(c, [(30, 29), (36, 31), (34, 36), (28, 33)], 'metal', lo=1, hi=4)
    c.put_ramp(31, 30, 'metal', 5)
    for x in range(13, 24):                                 # Halstuch (Team)
        put_if_solid(c, x, 18, 'teamA', 4 if x < 18 else 3)
        put_if_solid(c, x, 19, 'teamA', 3 if x < 18 else 2)
    # ---- Kopf: Nasenknubbel, Auge, langer oranger Bart
    ellipse(c, 20, 14, 5.2, 4.8, 'skin', lo=2, hi=5)
    beard = m_poly(c, [(15, 15), (25, 15), (25, 19), (21, 25), (18, 25), (15, 20)])
    shade_mask(c, beard, 'fire', 2, 5, r=2, passes=2, strength=3.5, ambient=0.5)
    ellipse(c, 25.6, 14.2, 1.9, 1.8, 'skin', lo=3, hi=5)
    c.put_ramp(25, 14, 'fire', 4)
    c.rect(22, 12, 23, 13, 'coal', 1)
    # ---- Helm mit Bohrer
    def cap(x, y):
        return y <= 12
    ellipse(c, 20, 11.5, 6.4, 5.2, 'metal', lo=1, hi=4, clip=cap)
    for x in range(14, 27):
        c.put_ramp(x, 12, 'gold', 3 if x % 2 else 2)
    c.put_ramp(17, 8, 'metal', 5)
    c.put_ramp(18, 7, 'metal', 5)
    drill_cone(c, 21.5, 7.5, 35.5, 1.0, 4.4, phase=0.3 * (f % 3))
    c.outline()
    return c
