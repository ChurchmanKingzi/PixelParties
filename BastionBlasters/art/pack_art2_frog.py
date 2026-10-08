"""pack_art2: US-04 Armbrustfrosch (Crossbow Frog) - Frosch mit Ritterhelm und Mini-Armbrust, im Huepfen."""
from __future__ import annotations

from pixl import *
from pack_art2_kit import *


def spr_crossbow_frog(anim='idle', f=0):
    """idle = Sprung in der Luft (Beine nach hinten gestreckt), crouch = geduckt beim Zielen"""
    c = Canvas(36, 34)
    hop = anim != 'crouch'
    dy = 0 if hop else 3
    # ---- Hinterbeine
    if hop:
        legs = (((11, 25), (5, 30), 0), ((13, 26), (7, 32), 1))
        for (hip, foot, near) in legs:
            thick_line(c, hip[0], hip[1], foot[0], foot[1], 3.4, 'goblin', lo=1 + near, hi=3 + near)
            ellipse(c, hip[0], hip[1], 4.2, 3.6, 'goblin', lo=1 + near, hi=4 + near, ambient=0.3)
            for k in range(3):                                         # Schwimmhaut-Zehen
                c.put_ramp(foot[0] - 2 - k, foot[1] + (k - 1), 'goblin', 3 + near)
            c.put_ramp(foot[0] - 1, foot[1], 'goblin', 5)
    else:
        for (hx, near) in ((10, 0), (14, 1)):
            ellipse(c, hx, 28, 5.0, 4.0, 'goblin', lo=1 + near, hi=3 + near, ambient=0.3)
            ellipse(c, hx + 4, 32, 5.0, 1.6, 'goblin', lo=2 + near, hi=4 + near)
    # ---- Koerper + Kopf als eine Silhouette
    body = m_ellipse_rot(c, 14.5, 20 + dy, 6.0, 8.4, 25) | m_ellipse(c, 22, 12 + dy, 8.0, 4.8)
    shade_mask(c, body, 'goblin', 1, 4, r=3, passes=2, strength=6.0, ambient=0.32)
    belly = m_ellipse_rot(c, 17.5, 22.5 + dy, 4.2, 6.6, 25) & body
    shade_mask(c, belly, 'goblin', 4, 5, r=2, passes=1, strength=2.0, ambient=0.6)
    for (x, y) in ((11, 18), (13, 22), (9, 22)):
        put_if_solid(c, x, y + dy, 'goblin', 1)
    # ---- Armbrust
    ay = 24 + dy
    thick_line(c, 16, ay - 5, 22, ay, 3.2, 'goblin', lo=2, hi=5)           # Vorderarm
    thick_line(c, 17, ay + 1, 32, ay - 1, 2.6, 'wood', lo=1, hi=4)          # Stock
    thick_line(c, 29, ay - 8, 32, ay - 1, 2.0, 'wood', lo=2, hi=5)          # Bogen oben
    thick_line(c, 32, ay - 1, 29, ay + 7, 2.0, 'wood', lo=1, hi=3)          # Bogen unten
    c.put_ramp(29, ay - 8, 'metal', 5)
    c.put_ramp(29, ay + 7, 'metal', 4)
    c.line(29, ay - 8, 24, ay - 1, 'bone', 4)                               # Sehne
    c.line(29, ay + 7, 24, ay - 1, 'bone', 3)
    c.line(24, ay - 2, 33, ay - 2, 'metal', 4)                              # Bolzen
    c.put_ramp(33, ay - 2, 'bone', 5)
    c.put_ramp(34, ay - 2, 'bone', 4)
    c.put_ramp(24, ay - 3, 'teamA', 4)
    c.put_ramp(25, ay - 3, 'teamA', 3)
    ellipse(c, 22.5, ay + 0.2, 2.0, 1.8, 'goblin', lo=3, hi=5)              # Hand
    # ---- Kopf: breites Maul, Augenwulst
    hy = 12 + dy
    for x in range(23, 30):
        c.put_ramp(x, hy + 3, 'coal', 1)
    c.put_ramp(30, hy + 2, 'coal', 1)
    ellipse(c, 26.5, hy - 2.6, 2.9, 2.9, 'goblin', lo=3, hi=5)
    c.rect(27, hy - 3, 28, hy - 2, 'coal', 1)
    c.put_ramp(27, hy - 3, 'bone', 5)
    # ---- Ritterhelm: Kuppel mit Nasenband, Federbusch im Fahrtwind
    def cap(x, y):
        return y <= hy - 1
    ellipse(c, 19.5, hy - 0.5, 6.6, 6.2, 'metal', lo=1, hi=4, clip=cap)
    c.put_ramp(17, hy - 4, 'metal', 5)
    c.put_ramp(16, hy - 3, 'metal', 5)
    c.put_ramp(18, hy - 5, 'metal', 5)
    for x in range(13, 26):
        c.put_ramp(x, hy - 1, 'metal', 1 if x % 2 else 2)
    c.rect(24, hy - 5, 24, hy - 1, 'metal', 0)                              # Nasenband
    c.put_ramp(19, hy - 6, 'metal', 5)
    for k in range(6):
        c.put_ramp(17 - k, hy - 7 - (1 if 0 < k < 4 else 0) + (1 if k > 4 else 0), 'teamA', 4 if k < 2 else 3)
        c.put_ramp(17 - k, hy - 6 - (1 if 0 < k < 4 else 0) + (1 if k > 4 else 0), 'teamA', 3 if k < 3 else 2)
    c.outline()
    return c
