"""pack_art2: US-05 Rammbock-Ork (Battering-Ram Orc) - Ork rennt mit einem riesigen Stoer als Rammbock."""
from __future__ import annotations

from pixl import *
from pack_art2_kit import *


def spr_ram_orc(anim='idle', f=0):
    c = Canvas(58, 44)
    st = [0, 1][f % 2]                               # Schrittwippe
    # ---- Beine: hinteres (fern) und vorderes (nah) im Lauf
    thick_line(c, 21, 28, 15, 33 + st, 5.0, 'leaf', lo=0, hi=2)
    thick_line(c, 15, 33 + st, 10, 38, 4.2, 'leaf', lo=0, hi=2)
    for x in range(6, 13):
        c.put_ramp(x, 39, 'wood', 1)
        c.put_ramp(x, 40, 'wood', 0)
        c.put_ramp(x, 38, 'wood', 2)
    thick_line(c, 25, 28, 31, 31 - st, 5.4, 'leaf', lo=1, hi=4)
    thick_line(c, 31, 31 - st, 29, 38, 4.6, 'leaf', lo=1, hi=4)
    for x in range(26, 35):
        c.put_ramp(x, 38, 'wood', 3 if x < 30 else 2)
        c.put_ramp(x, 39, 'wood', 2)
        c.put_ramp(x, 40, 'wood', 1)
    # ---- Lendenschurz (Fell mit Zacken)
    cloth = m_poly(c, [(17, 27), (31, 27), (32, 34), (29, 32), (26, 35), (23, 32), (20, 34), (17, 31)])
    shade_mask(c, cloth, 'dirt', 1, 4, r=2, passes=1, strength=3.0, ambient=0.4)
    # ---- Oberkoerper (nach vorn geneigt)
    torso = m_ellipse_rot(c, 24, 19.5, 8.4, 10.4, 20)
    shade_mask(c, torso, 'leaf', 1, 4, r=4, passes=2, strength=6.0, ambient=0.3)
    for x in range(16, 33):                          # Guertel
        if c.alpha(x, 27):
            c.put_ramp(x, 27, 'wood', 2)
            c.put_ramp(x, 28, 'wood', 1)
    c.put_ramp(24, 27, 'gold', 4)
    c.put_ramp(25, 27, 'gold', 5)
    for k in range(10):                              # Lederriemen quer ueber die Brust
        x, y = 19 + k, 12 + k * 15 // 10
        c.put_ramp(x, y, 'wood', 3)
        c.put_ramp(x, y + 1, 'wood', 2)
        if k % 3 == 1:
            c.put_ramp(x, y, 'metal', 5)
    # ---- ferner Arm (dunkel)
    thick_line(c, 20, 14, 21, 22, 4.2, 'leaf', lo=0, hi=2)
    # ---- der Stoer (Rammbock): Schwanzflosse links, Eisenkappe an der Schnauze rechts
    ax0, ay0, ax1, ay1 = 3, 29, 55, 19

    def axy(x):
        return ay0 + (ay1 - ay0) * (x - ax0) / (ax1 - ax0)

    def prof(u):
        if u < 0.38:
            return 1.2 + 4.4 * (u / 0.38)
        return 1.0 + 4.6 * (1 - (u - 0.38) / 0.62) ** 0.8
    fish = m_new(c)
    for x in range(ax0 + 6, ax1 + 1):
        u = (x - ax0) / (ax1 - ax0)
        t = prof(u)
        for y in range(int(round(axy(x) - t)), int(round(axy(x) + t)) + 1):
            fish[y, x] = True
    tail_top = m_poly(c, [(ax0 + 7, 27), (ax0, 20), (ax0 + 2, 19), (ax0 + 10, 25)])
    tail_bot = m_poly(c, [(ax0 + 7, 28), (ax0 + 1, 31), (ax0 + 6, 33), (ax0 + 10, 29)])
    shade_mask(c, tail_top, 'metal', 1, 4, r=1, passes=1, strength=3.0)
    shade_mask(c, tail_bot, 'metal', 1, 3, r=1, passes=1, strength=3.0)
    shade_mask(c, fish, 'metal', 1, 4, r=2, passes=2, strength=6.0, ambient=0.32)
    belly = m_new(c)
    for x in range(ax0 + 8, ax1 - 3):
        u = (x - ax0) / (ax1 - ax0)
        yb = int(round(axy(x) + prof(u) * 0.25 + 0.5))
        for y in range(yb, int(round(axy(x) + prof(u))) + 1):
            if fish[y, x]:
                belly[y, x] = True
    shade_mask(c, belly, 'fur', 2, 4, r=1, passes=1, strength=2.0, ambient=0.5)
    for x in range(ax0 + 10, ax1 - 8, 4):            # Knochenschilde am Ruecken
        u = (x - ax0) / (ax1 - ax0)
        yt = int(round(axy(x) - prof(u))) - 1
        c.put_ramp(x, yt, 'bone', 4)
        c.put_ramp(x, yt + 1, 'bone', 5)
        c.put_ramp(x + 1, yt + 1, 'bone', 3)
    for x in range(ax0 + 9, ax1 - 10):               # Seitenlinie
        if x % 3 != 0 and fish[int(round(axy(x))) + 1, x]:
            c.put_ramp(x, int(round(axy(x))) + 1, 'metal', 2)
    c.put_ramp(41, int(round(axy(41))) - 1, 'coal', 1)  # Auge
    c.put_ramp(41, int(round(axy(41))), 'bone', 5)
    for k in range(5):                               # Kiemendeckel
        c.put_ramp(37 + (1 if k in (0, 4) else 0), int(round(axy(37))) - 2 + k, 'metal', 2)
    # Eisenkappe an der Schnauze
    for x in range(49, 56):
        for y in range(int(round(axy(x))) - 2, int(round(axy(x))) + 3):
            u = (x - 49) / 6.0
            c.put_ramp(x, y, 'metal', 4 if y < axy(x) - 0.5 else 2 if y < axy(x) + 1.5 else 1)
    for y in range(int(round(axy(50))) - 3, int(round(axy(50))) + 4):
        c.put_ramp(50, y, 'gold', 3)
    c.put_ramp(54, int(round(axy(54))) - 1, 'bone', 5)
    c.put_ramp(55, int(round(axy(55))), 'metal', 5)
    # Barteln
    c.put_ramp(46, int(round(axy(46))) + 3, 'bone', 3)
    c.put_ramp(47, int(round(axy(47))) + 4, 'bone', 2)
    c.put_ramp(44, int(round(axy(44))) + 3, 'bone', 3)
    # ---- naher Arm + Faust am Fisch, hintere Faust
    thick_line(c, 26, 14, 30, 20, 5.0, 'leaf', lo=2, hi=5)
    ellipse(c, 32.0, 23.5, 3.6, 3.2, 'leaf', lo=2, hi=5, ambient=0.3)
    for x in (30, 32, 34):
        c.put_ramp(x, 21, 'leaf', 1)
    ellipse(c, 19.5, 24.5, 3.0, 2.7, 'leaf', lo=0, hi=3, ambient=0.3)
    # ---- Stachelschulter (Team) + Kopf
    ellipse(c, 25.5, 14.5, 4.4, 3.2, 'metal', lo=1, hi=4)
    for (x, y, i) in ((24, 10, 5), (25, 11, 4), (28, 11, 4), (29, 10, 5)):
        c.put_ramp(x, y, 'metal', i)
    c.put_ramp(25, 14, 'metal', 5)
    ellipse(c, 31.5, 9.5, 5.8, 5.3, 'leaf', lo=2, hi=5)
    ellipse(c, 34.5, 14.0, 4.2, 2.8, 'leaf', lo=2, hi=4)
    for x in range(32, 38):
        c.put_ramp(x, 13, 'coal', 1)
    for (x, y) in ((33, 11), (37, 11)):                # Hauer
        c.put_ramp(x, y, 'bone', 5)
        c.put_ramp(x, y - 1, 'bone', 4)
        c.put_ramp(x, y - 2, 'bone', 3)
    c.rect(34, 8, 35, 9, 'coal', 1)                   # Auge
    for k in range(5):                                # Brauenwulst
        c.put_ramp(33 + k, 7 - (k // 3) * 0, 'leaf', 0)
    c.put_ramp(26, 9, 'leaf', 1)                       # Ohr
    poly(c, [(26, 8), (21, 4), (26, 12)], 'leaf', lo=1, hi=3)
    for k, (x, y) in enumerate(((27, 4), (30, 3), (33, 4), (24, 6))):   # Irokese im Fahrtwind (Team)
        c.put_ramp(x, y, 'teamA', 4)
        c.put_ramp(x - 1, y + 1, 'teamA', 3)
        c.put_ramp(x - 2, y, 'teamA', 3)
        c.put_ramp(x, y + 1, 'teamA', 2)
    c.outline()
    return c
