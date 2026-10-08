"""pack_art9: Props und Figuren des Drillplatzes (BW-07): Strohpuppen, Hindernisbahn, Feldwebel mit Quietsche-Ente."""
from __future__ import annotations

import random

from pack_art9_kit import *


def straw_dummy(hit=0, seed=1):
    """Strohpuppe auf Pfahl: Sackkopf mit Naehten, Zielscheibe auf der Brust, Uebungsschwert steckt drin (26 x 40)"""
    c = Canvas(26, 40)
    rnd = random.Random(seed)
    # Pfahl + Querholz
    c.rect(11, 18, 14, 38, 'wood', 3)
    c.rect(11, 18, 11, 38, 'wood', 4)
    c.rect(14, 18, 14, 38, 'wood', 1)
    c.rect(8, 37, 17, 39, 'wood', 2)
    c.rect(8, 37, 17, 37, 'wood', 3)
    c.rect(1, 17, 24, 20, 'wood', 3)
    c.rect(1, 17, 24, 17, 'wood', 4)
    c.rect(1, 20, 24, 20, 'wood', 1)
    # Stroh-Arme (Bueschel an den Enden)
    for (x0, d) in ((0, -1), (25, 1)):
        for k in range(5):
            c.put_ramp(x0 + d * (k % 2), 14 + k + 2, 'gold', 4 if k % 2 else 3)
            c.put_ramp(x0 + d * (k % 2) + (1 if x0 == 0 else -1), 15 + k + 2, 'gold', 3)
    # Koerper: Strohsack
    ellipse(c, 12.5, 26, 7.6, 9.0, 'dirt', lo=2, hi=5)
    for y in (22, 26, 30):
        for x in range(6, 20):
            if (x + y) % 3 == 0:
                c.put_ramp(x, y, 'gold', 3)
    # Seil um den Bauch
    for x in range(5, 21):
        c.put_ramp(x, 31, 'dirt', 1)
        c.put_ramp(x, 32, 'dirt', 3 if x % 2 else 2)
    # Scheibe
    ellipse(c, 12.5, 24, 5.2, 5.2, 'bone', lo=3, hi=5)
    ellipse(c, 12.5, 24, 3.6, 3.6, 'teamA', lo=2, hi=4)
    ellipse(c, 12.5, 24, 1.6, 1.6, 'bone', lo=4, hi=5)
    # Schwert steckt schraeg im Bauch
    if hit:
        c.line(5, 29, 1, 23, 'metal', 4)
        c.line(6, 29, 2, 23, 'metal', 3)
        c.rect(4, 28, 7, 29, 'wood', 2)
    else:
        c.line(17, 27, 23, 22, 'wood', 3)
        c.line(17, 28, 23, 23, 'wood', 2)
        c.rect(16, 26, 18, 29, 'metal', 3)
    # Sackkopf
    ellipse(c, 12.5, 11, 6.2, 6.6, 'dirt', lo=2, hi=5)
    # Stroh als Haare
    for k in range(7):
        x = 6 + k * 2
        c.put_ramp(x, 3 + (k % 2), 'gold', 5 if k % 2 else 4)
        c.put_ramp(x, 4 + (k % 2), 'gold', 3)
    # Naehte-Gesicht: X-Augen, Stichmund
    for (ex, ey) in ((9, 9), (14, 9)):
        c.put_ramp(ex, ey, 'coal', 1)
        c.put_ramp(ex + 1, ey + 1, 'coal', 1)
        c.put_ramp(ex + 1, ey, 'coal', 2)
        c.put_ramp(ex, ey + 1, 'coal', 2)
    for x in range(9, 17):
        if x % 2 == 0:
            c.put_ramp(x, 14, 'coal', 1)
    # Halstuch
    hline(c, 8, 17, 16, 'teamA', 3)
    hline(c, 8, 17, 17, 'teamA', 2)
    c.put_ramp(17, 18, 'teamA', 3)
    c.put_ramp(17, 19, 'teamA', 2)
    c.outline()
    return c


def hurdle():
    """niedriges Huerdengestell (34 x 18): zwei X-Boecke und eine dicke Latte mit Streifen"""
    c = Canvas(34, 18)
    for x0 in (3, 25):
        c.line(x0, 16, x0 + 5, 4, 'wood', 3)
        c.line(x0 + 1, 16, x0 + 6, 4, 'wood', 4)
        c.line(x0 + 5, 16, x0, 4, 'wood', 2)
        c.line(x0 + 6, 16, x0 + 1, 4, 'wood', 3)
    for y in (3, 4, 5, 6):
        for x in range(0, 34):
            stripe = (x // 4) % 2 == 0
            if y == 3:
                i = 5 if stripe else 5
                col = 'bone' if stripe else 'teamA'
            elif y == 6:
                i = 2
                col = 'bone' if stripe else 'teamA'
            else:
                i = 4 if y == 4 else 3
                col = 'bone' if stripe else 'teamA'
            c.put_ramp(x, y, col, i)
    c.outline()
    return c


def balance_beam():
    """dicker Baumstamm auf zwei Boecken (46 x 18), Hirnholz links"""
    c = Canvas(46, 18)
    for x0 in (6, 34):
        c.line(x0, 16, x0 + 3, 9, 'wood', 2)
        c.line(x0 + 5, 16, x0 + 2, 9, 'wood', 3)
        c.line(x0 + 1, 16, x0 + 4, 9, 'wood', 1)
    thick_line(c, 4, 7, 42, 7, 8.0, 'wood', lo=1, hi=4)
    for x in range(8, 40, 6):
        c.put_ramp(x, 5, 'wood', 1)
        c.put_ramp(x + 2, 8, 'wood', 1)
        c.put_ramp(x + 3, 9, 'wood', 2)
    for x in range(6, 42):
        c.put_ramp(x, 3, 'wood', 5 if x % 3 else 4)
    ellipse(c, 4.5, 7.5, 2.6, 4.0, 'wood', lo=3, hi=5)
    c.put_ramp(4, 7, 'wood', 2)
    c.put_ramp(5, 8, 'wood', 2)
    c.outline()
    return c


def climb_wall():
    """Kletterwand aus Brettern mit Haltetau (28 x 34)"""
    c = Canvas(28, 34)
    block(c, 1, 5, 26, 31, 'wood', hi=4, mid=3, lo=2, deep=1)
    for x in range(4, 26, 5):
        vline(c, x, 6, 30, 'wood', 1)
    for y in (12, 20):
        hline(c, 2, 25, y, 'wood', 1)
    # Haltegriffe
    for (x, y, col) in ((6, 26, 'teamA'), (12, 21, 'gold'), (18, 15, 'ice'), (21, 9, 'leaf'), (9, 12, 'leaf'), (16, 27, 'purple')):
        c.rect(x, y, x + 2, y + 1, col, 4)
        c.put_ramp(x, y, col, 5)
    # Pfosten + Tau
    c.rect(0, 2, 1, 33, 'wood', 2)
    c.rect(26, 2, 27, 33, 'wood', 2)
    for k in range(20):
        c.put_ramp(14 + (1 if (k // 3) % 2 else 0), 12 + k, 'dirt', 4 if k % 2 else 3)
    c.rect(11, 4, 17, 5, 'wood', 4)
    c.outline()
    return c


def tyre_hoop():
    """Reifen im Gestell (Durchsprung) (22 x 24)"""
    c = Canvas(22, 24)
    c.rect(2, 22, 19, 23, 'wood', 2)
    c.rect(2, 22, 19, 22, 'wood', 3)
    c.rect(10, 18, 11, 22, 'wood', 3)
    for y in range(0, 20):
        for x in range(0, 22):
            d = math.hypot((x - 10.5) / 10.0, (y - 9.5) / 9.2)
            if 0.74 <= d <= 1.0:
                ang = math.atan2(y - 9.5, x - 10.5)
                i = 4 if (ang < -0.5 and ang > -2.6) else (2 if ang > 0.3 and ang < 2.4 else 3)
                if int((ang + 3.2) * 5) % 2 == 0:
                    i = max(1, i - 1)
                c.put_ramp(x, y, 'coal', min(4, i))
    c.outline()
    return c


def rubber_duck(f=0):
    """Quietsche-Ente (10 x 10)"""
    c = Canvas(10, 10)
    ellipse(c, 4.5, 6.5, 4.0, 3.0, 'gold', lo=3, hi=5)
    ellipse(c, 6.5, 3, 2.6, 2.4, 'gold', lo=3, hi=5)
    c.rect(8, 4, 9, 4, 'fire', 4)
    c.put_ramp(7, 2, 'coal', 1)
    c.put_ramp(2, 6, 'gold', 2)
    c.put_ramp(3, 6, 'gold', 2)
    c.outline()
    return c


def sergeant(f=0):
    """Feldwebel (32 x 36): Spitzmuetze mit langem Schirm, Schnurrbart als Block, Pfeife, hebt die Quietsche-Ente
    wie ein Kommandostab. Rotes Wams, Goldschulterstuecke, Stoeckchen unterm Arm."""
    c = Canvas(32, 36)
    bob = [0, -1][f % 2]
    # Beine/Stiefel
    thick_line(c, 12, 28 + bob, 11, 33, 4.2, 'wood', lo=0, hi=2)
    thick_line(c, 19, 28 + bob, 20, 33, 4.2, 'wood', lo=1, hi=3)
    for x in range(8, 15):
        c.put_ramp(x, 34, 'wood', 2)
        c.put_ramp(x, 35, 'wood', 0)
    for x in range(17, 25):
        c.put_ramp(x, 34, 'wood', 3)
        c.put_ramp(x, 35, 'wood', 0)
    # Koerper: breit, Brust raus
    round_rect(c, 8, 15 + bob, 23, 29 + bob, 'teamA', lo=1, hi=4, radius=3)
    for x in range(8, 24):
        c.put_ramp(x, 25 + bob, 'metal', 2 if x % 2 else 1)
    c.rect(15, 24 + bob, 16, 26 + bob, 'gold', 5)
    for y in (18, 21):
        c.put_ramp(11, y + bob, 'gold', 5)
        c.put_ramp(20, y + bob, 'gold', 4)
    # Schulterstuecke
    ellipse(c, 8.5, 16.5 + bob, 3.6, 2.6, 'gold', lo=2, hi=5)
    ellipse(c, 23, 16.5 + bob, 3.6, 2.6, 'gold', lo=1, hi=4)
    # linker Arm: Stoeckchen unterm Arm
    thick_line(c, 8, 18 + bob, 5, 25 + bob, 3.0, 'teamA', lo=1, hi=3)
    c.rect(4, 25 + bob, 6, 27 + bob, 'skin', 3)
    thick_line(c, 2, 28 + bob, 13, 22 + bob, 1.6, 'wood', lo=2, hi=4)
    # rechter Arm hoch mit Ente
    thick_line(c, 23, 18 + bob, 27, 11 + bob, 3.2, 'teamA', lo=2, hi=4)
    c.rect(26, 8 + bob, 28, 11 + bob, 'skin', 4)
    duck = rubber_duck()
    c.blit(duck, 22, -1 + bob)
    # Kopf
    ellipse(c, 15.5, 10.5 + bob, 5.8, 5.0, 'skin', lo=2, hi=5)
    c.rect(11, 13 + bob, 20, 14 + bob, 'coal', 2)           # Schnurrbart-Block
    c.put_ramp(19, 13 + bob, 'coal', 3)
    c.put_ramp(20, 14 + bob, 'coal', 3)
    c.rect(15, 9 + bob, 16, 10 + bob, 'coal', 1)             # ein dickes Auge
    c.put_ramp(17, 9 + bob, 'coal', 1)
    # Pfeife (hängt am Mund)
    c.put_ramp(15, 15 + bob, 'metal', 5)
    c.put_ramp(16, 16 + bob, 'metal', 4)
    # Muetze: Spitzkappe mit langem Schirm nach rechts
    ellipse(c, 15.5, 6.5 + bob, 6.6, 4.8, 'teamA', lo=1, hi=4, clip=lambda x, y: y <= 7 + bob)
    c.rect(9, 7 + bob, 22, 8 + bob, 'metal', 2)
    c.rect(9, 7 + bob, 22, 7 + bob, 'metal', 4)
    poly(c, [(18, 8 + bob), (28, 9 + bob), (27, 11 + bob), (18, 10 + bob)], 'coal', lo=0, hi=3)
    c.put_ramp(14, 5 + bob, 'gold', 5)
    c.put_ramp(15, 5 + bob, 'gold', 4)
    c.put_ramp(14, 6 + bob, 'gold', 3)
    c.put_ramp(15, 6 + bob, 'gold', 4)
    c.outline()
    return c


def recruit(pose='jump', f=0):
    """Rekrut mit Eimer als Helm (22 x 26): springt ueber die Huerde (pose jump) oder rennt"""
    c = Canvas(22, 26)
    if pose == 'jump':
        # Beine angezogen (eins gestreckt)
        thick_line(c, 9, 17, 4, 21, 3.0, 'wood', lo=1, hi=3)
        thick_line(c, 12, 17, 19, 19, 3.0, 'wood', lo=2, hi=4)
        for x in range(1, 6):
            c.put_ramp(x, 22, 'wood', 1)
        for x in range(18, 22):
            c.put_ramp(x, 20, 'wood', 2)
        arms = ((7, 11, 3, 5), (13, 11, 17, 5))
    else:
        thick_line(c, 9, 17, 7, 24, 3.0, 'wood', lo=1, hi=3)
        thick_line(c, 12, 17, 14, 24, 3.0, 'wood', lo=2, hi=4)
        arms = ((7, 12, 4, 17), (13, 12, 17, 10))
    round_rect(c, 6, 10, 14, 18, 'dirt', lo=1, hi=4, radius=2)
    hline(c, 6, 14, 14, 'wood', 2)
    for (x0, y0, x1, y1) in arms:
        thick_line(c, x0, y0, x1, y1, 2.2, 'skin', lo=2, hi=5)
    # Holzschwert in der Faust
    c.line(17, 5, 20, 0, 'wood', 4)
    c.line(18, 5, 21, 0, 'wood', 3)
    c.rect(16, 5, 19, 5, 'metal', 3)
    # Kopf + Eimerhelm
    ellipse(c, 10, 8.5, 4.4, 3.8, 'skin', lo=2, hi=5)
    c.rect(11, 9, 12, 10, 'coal', 1)
    poly(c, [(5, 6), (15, 6), (14, 0), (6, 0)], 'metal', lo=1, hi=5)
    hline(c, 4, 16, 6, 'metal', 1)
    hline(c, 5, 15, 3, 'metal', 2)
    c.put_ramp(7, 1, 'metal', 5)
    c.put_ramp(8, 2, 'metal', 5)
    c.outline()
    return c


def corner_post():
    """Eckpfosten mit Wimpel (10 x 30)"""
    c = Canvas(14, 26)
    c.rect(3, 6, 4, 24, 'wood', 3)
    c.rect(3, 6, 3, 24, 'wood', 4)
    c.rect(4, 6, 4, 24, 'wood', 1)
    c.rect(2, 23, 5, 25, 'wood', 2)
    for k in range(9):
        w = 9 - k
        c.rect(5, 1 + k, 5 + w - 1, 1 + k, 'teamA', 4 if k < 3 else 3 if k < 6 else 2)
    c.put_ramp(3, 5, 'gold', 5)
    c.put_ramp(4, 5, 'gold', 4)
    c.outline()
    return c


def xp_star(big=False):
    """kleiner goldener Stern (7 x 7) fuer die zusaetzlichen XP"""
    c = Canvas(9 if big else 7, 9 if big else 7)
    m = 4 if big else 3
    c.put_ramp(m, m, 'gold', 5)
    for k in range(1, 3 if big else 2):
        for (dx, dy) in ((k, 0), (-k, 0), (0, k), (0, -k)):
            c.put_ramp(m + dx, m + dy, 'gold', 5 - k)
    for (dx, dy) in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        c.put_ramp(m + dx, m + dy, 'gold', 4)
    c.outline()
    return c
