"""pack_art2: US-09 Rumpelgeist (Poltergeist) - Geist im Bettlaken mit Rassel."""
from __future__ import annotations

from pixl import *
from pack_art2_kit import *


def spr_poltergeist(anim='idle', f=0):
    c = Canvas(40, 42)
    sw = [0, 1, 0, -1][f % 4]                       # Saum wippt
    # ---- Laken: Kopfbeule + weit ausgestellter Koerper, Saum mit Zacken, Schweif nach links unten
    head = m_ellipse(c, 19, 11, 8.6, 8.4)
    hem = [(26, 22), (27, 30 + sw), (24, 36), (21, 32), (18, 38 - sw), (14, 33), (10, 39), (7, 34), (3, 40), (3, 33), (6, 26), (9, 17)]
    body = m_poly(c, [(11, 13), (27, 13)] + hem)
    sheet = head | body
    shade_mask(c, sheet, 'fur', 2, 5, r=4, passes=2, strength=5.0, ambient=0.36)
    # Falten
    for (x, y0, y1) in ((13, 24, 36), (18, 22, 35), (23, 24, 33), (9, 26, 33)):
        for y in range(y0, y1):
            if sheet[y, x] and sheet[y + 1, x]:
                c.put_ramp(x, y, 'fur', 2 if (y + x) % 3 else 1)
    # Zipfel oben (Laken-Knoten)
    for (x, y) in ((17, 2), (18, 1), (19, 2), (18, 2), (17, 3)):
        c.put_ramp(x, y, 'fur', 4 if x < 19 else 3)
    # Schweif durchsichtig (Schachbrett)
    tailmask = sheet & (np.mgrid[0:c.h, 0:c.w][0] >= 31) & (np.mgrid[0:c.h, 0:c.w][1] <= 12)
    checker_cut(c, tailmask)
    # ---- Augenloecher und Mund
    c.rect(18, 8, 19, 10, 'coal', 1)
    c.rect(23, 8, 24, 10, 'coal', 1)
    c.rect(22, 13, 23, 14, 'coal', 2)
    # ---- Arm mit Rassel (hochgerissen)
    arm = m_line(c, 24, 18, 31, 11, 4.8)
    shade_mask(c, arm, 'fur', 3, 5, r=2, passes=1, strength=3.0, ambient=0.5)
    ang = [0, 1, 0, -1][f % 4]
    thick_line(c, 31, 11, 33 + ang, 6, 1.4, 'wood', lo=2, hi=4)
    ellipse(c, 34 + ang, 4.0, 3.2, 3.2, 'teamA', lo=1, hi=5, ambient=0.3)
    for (x, y) in ((33, 3), (35, 5), (34, 2)):
        put_if_solid(c, x + ang, y, 'gold', 5)
    c.rect(32 + ang, 4, 36 + ang, 4, 'gold', 3)
    for (x, y) in ((29, 2), (30, 0), (38, 1), (39, 4)):   # Klang-Striche
        if c.inb(x, y):
            c.put_ramp(x, y, 'gold', 4)
    # fernes Aermchen haengt herab
    arm2 = m_line(c, 11, 19, 7, 25, 4.0)
    shade_mask(c, arm2 & ~sheet, 'fur', 1, 3, r=1, passes=1, strength=2.0, ambient=0.5)
    c.outline()
    return c
