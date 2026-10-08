"""pack_art2: US-07 Reitgans-Goblin (Goose-Rider Goblin) - Goblin auf wuetender Gans mit Lanze."""
from __future__ import annotations

from pixl import *
from pack_art2_kit import *


def spr_goose_rider(anim='idle', f=0):
    c = Canvas(60, 48)
    fl = [0, 1][f % 2]
    # ---- ferner Fluegel (dunkel) und Schwanzfedern
    far = m_poly(c, [(19, 22), (16, 13), (12, 7), (9, 3), (7, 6), (10, 8), (6, 10), (11, 13), (9, 17), (15, 20)])
    shade_mask(c, far, 'fur', 1, 3, r=1, passes=1, strength=3.0, ambient=0.4)
    tail = m_poly(c, [(13, 29), (4, 24), (2, 27), (5, 28), (3, 31), (13, 33)])
    shade_mask(c, tail, 'bone', 1, 4, r=1, passes=1, strength=3.0, ambient=0.4)
    # ---- Beine (orange, gestreckt) mit Schwimmfuessen
    thick_line(c, 18, 34, 12, 42, 2.6, 'fire', lo=1, hi=3)
    poly(c, [(8, 43), (15, 43), (13, 46), (6, 46)], 'fire', lo=1, hi=3)
    thick_line(c, 26, 34, 33, 41, 2.8, 'fire', lo=2, hi=4)
    poly(c, [(31, 42), (40, 43), (37, 46), (30, 46)], 'fire', lo=2, hi=4)
    c.put_ramp(39, 43, 'fire', 5)
    # ---- Koerper (liegt gestreckt) + Hals in S-Kurve + Kopf
    body = m_ellipse_rot(c, 23, 28, 13.5, 7.6, 6)
    neck = m_line(c, 31, 27, 37, 21, 5.4) | m_line(c, 37, 21, 41, 14, 4.2) | m_line(c, 41, 14, 46, 10, 3.8)
    head = m_ellipse(c, 47.0, 9.0, 4.0, 3.4)
    silh = body | neck | head
    shade_mask(c, silh, 'bone', 2, 5, r=3, passes=2, strength=6.0, ambient=0.32)
    # Brustgefieder
    for (x, y) in ((28, 31), (31, 29), (25, 33), (20, 32), (33, 25)):
        put_if_solid(c, x, y, 'fur', 3)
        put_if_solid(c, x + 1, y, 'fur', 2)
    # Sattelschabracke (Team)
    sad = m_ellipse_rot(c, 25, 22.5, 7.0, 2.6, 6)
    shade_mask(c, sad, 'teamA', 1, 4, r=1, passes=1, strength=3.0, ambient=0.5)
    for x in range(19, 32, 2):
        c.put_ramp(x, 25, 'teamA', 1)
    # ---- Schnabel (offen, empoert) + Auge mit Zornfalte
    poly(c, [(50, 6), (59, 8), (50, 9)], 'fire', lo=3, hi=5)
    poly(c, [(49, 10), (57, 12), (49, 12)], 'fire', lo=1, hi=3)
    c.rect(50, 9, 56, 9, 'coal', 1)
    c.put_ramp(53, 10, 'skin', 2)
    c.rect(47, 7, 48, 8, 'coal', 1)
    c.put_ramp(45, 5, 'coal', 2)
    c.put_ramp(46, 5, 'coal', 1)
    c.put_ramp(47, 6, 'coal', 1)
    c.put_ramp(48, 6, 'coal', 1)
    # ---- Reiter: Goblin im Sattel, gebeugt, Lanze eingelegt
    gx = 24
    ellipse(c, gx - 1, 19, 4.6, 5.6, 'goblin', lo=1, hi=4)
    rect_belt = m_ellipse(c, gx - 1, 22, 4.6, 1.2)
    flat_mask(c, rect_belt & m_ellipse(c, gx - 1, 19, 4.6, 5.6), 'wood', 2)
    for (x, y, i) in ((gx - 4, 24, 3), (gx - 3, 25, 3), (gx - 2, 26, 2)):  # Stiefel am Gansflanke
        c.put_ramp(x, y, 'wood', i)
    # Kopf mit langen Ohren im Fahrtwind
    ellipse(c, gx + 3, 12.5, 4.6, 4.2, 'goblin', lo=2, hi=5)
    poly(c, [(gx, 11), (gx - 12, 7 + fl), (gx - 1, 15)], 'goblin', lo=1, hi=4)
    c.put_ramp(gx - 5, 10 + fl, 'skin', 3)
    c.put_ramp(gx - 6, 10 + fl, 'skin', 2)
    c.rect(gx + 4, 11, gx + 5, 12, 'coal', 1)
    for x in range(gx + 3, gx + 8):
        c.put_ramp(x, 15, 'coal', 1)
    c.put_ramp(gx + 8, 13, 'goblin', 4)
    c.put_ramp(gx + 8, 14, 'goblin', 3)
    # Lederkappe mit Feder
    def cap(x, y):
        return y <= 11
    ellipse(c, gx + 3, 10.5, 5.2, 4.0, 'wood', lo=1, hi=4, clip=cap)
    for x in range(gx - 2, gx + 9):
        c.put_ramp(x, 11, 'wood', 1)
    for k in range(5):
        c.put_ramp(gx - 1 - k, 7 - (1 if 0 < k < 3 else 0) + (1 if k > 3 else 0), 'teamA', 4 if k < 2 else 3)
        c.put_ramp(gx - 1 - k, 8 - (1 if 0 < k < 3 else 0) + (1 if k > 3 else 0), 'teamA', 3 if k < 3 else 2)
    # Lanze (laeuft vor dem Hals und unter dem Schnabel durch)
    lx0, ly0, lx1, ly1 = 12, 25, 56, 14
    thick_line(c, lx0, ly0, lx1, ly1, 1.8, 'wood', lo=2, hi=5)
    poly(c, [(lx1 - 4, ly1 - 2), (59, ly1 - 3), (lx1 - 3, ly1 + 2)], 'metal', lo=2, hi=5)
    poly(c, [(45, 17), (51, 16), (46, 21)], 'teamA', lo=2, hi=5)
    ellipse(c, 29, 21.5, 2.4, 2.4, 'metal', lo=1, hi=4)
    # Arm greift die Lanze
    thick_line(c, gx + 1, 17, gx + 4, 20, 3.0, 'goblin', lo=2, hi=5)
    ellipse(c, gx + 5.5, 20.2, 1.9, 1.7, 'goblin', lo=3, hi=5)
    # ---- naher Fluegel hochgeschlagen (vorn)
    wing = m_poly(c, [(20, 27), (16, 17), (11, 10), (5, 5), (2, 8), (6, 10), (1, 13), (7, 15), (3, 19), (10, 20), (7, 24), (14, 25)])
    shade_mask(c, wing, 'bone', 2, 5, r=2, passes=2, strength=5.0, ambient=0.4)
    for (x0, y0, x1, y1) in ((18, 26, 6, 9), (18, 26, 3, 14), (17, 26, 5, 19), (17, 27, 9, 24)):
        for t in range(0, 11):
            x = x0 + (x1 - x0) * t / 10.0
            y = y0 + (y1 - y0) * t / 10.0
            if wing[int(y), int(x)] and t > 2:
                c.put_ramp(int(x), int(y), 'fur', 2)
    for (x, y) in ((2, 8), (1, 13), (3, 19), (7, 24)):
        put_if_solid(c, x, y, 'fur', 3)
    c.outline()
    return c
