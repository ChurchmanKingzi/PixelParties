"""pack_art1: Sprites UA-02 Funken-Magier, UA-03 Zwergen-Donnerbüchse, UA-04 Goblin-Kanone, UA-05 Ork-Kanone."""
from __future__ import annotations

import math
import random

from cards_art import *
from pack_art1_kit import *


# =========================================================================== UA-02 Funken-Magier (M, 42 x 44)


def spr_spark_mage(anim='idle', f=0):
    c = Canvas(42, 46)
    Y = 9 + ([0, -1][f % 2] if anim == 'idle' else 0)      # y-Versatz (Kopf-Hut-Platz oben)
    X = 3
    # Stiefel
    for (x0, x1, i) in ((8, 13, 2), (17, 23, 3)):
        c.rect(X + x0, Y + 35, X + x1, Y + 35, 'wood', i)
        c.rect(X + x0, Y + 36, X + x1, Y + 36, 'wood', 1)
    # Robe (Feuer-Rot), Saum angekokelt
    poly(c, [(X + 9, Y + 18), (X + 22, Y + 18), (X + 25, Y + 35), (X + 5, Y + 35)], 'fire', lo=1, hi=4)
    zigzag_hem(c, X + 5, X + 25, Y + 34, 'coal', 1, 2)
    for (x, y) in ((7, 32), (8, 33), (9, 32), (21, 32), (22, 33), (23, 31), (15, 33), (16, 32), (12, 33), (19, 33)):
        c.put_ramp(X + x, Y + y, 'coal', 1 if (x + y) % 2 else 2)
    # Gürtel (Seil mit Knoten)
    for x in range(8, 24):
        c.put_ramp(X + x, Y + 25, 'gold', 2 if x % 2 else 3)
    c.rect(X + 15, Y + 25, X + 17, Y + 27, 'gold', 4)
    # hinterer Arm
    thick_line(c, X + 9, Y + 20, X + 5, Y + 27, 3.2, 'fire', lo=0, hi=2)
    c.rect(X + 4, Y + 28, X + 6, Y + 29, 'skin', 2)
    # Streichholz-Stab: Holz, glühender Kopf, Flamme
    thick_line(c, X + 18, Y + 33, X + 32, Y + 12, 2.2, 'wood', lo=2, hi=4)
    # Bart (angesengt)
    poly(c, [(X + 11, Y + 16), (X + 21, Y + 16), (X + 19, Y + 25), (X + 15, Y + 28), (X + 12, Y + 24)], 'bone', lo=3, hi=5)
    for (x, y) in ((13, 25), (14, 27), (16, 27), (17, 26), (12, 23), (18, 24)):
        c.put_ramp(X + x, Y + y, 'coal', 1 if (x + y) % 2 else 2)
    dither_fill(c, [(X + 13, Y + 19), (X + 14, Y + 20), (X + 16, Y + 21), (X + 15, Y + 18), (X + 17, Y + 19)], 'bone', 2, 3)
    # vorderer Arm + Hand am Stab
    thick_line(c, X + 21, Y + 20, X + 25, Y + 24, 3.2, 'fire', lo=2, hi=4)
    c.rect(X + 24, Y + 23, X + 26, Y + 25, 'skin', 4)
    # Kopf (Auge unter der Krempe)
    ellipse(c, X + 16.5, Y + 12.5, 5.0, 4.6, 'skin', lo=2, hi=5)
    c.put_ramp(X + 21, Y + 14, 'skin', 4)
    c.put_ramp(X + 21, Y + 15, 'skin', 3)
    c.rect(X + 19, Y + 13, X + 20, Y + 14, 'coal', 1)
    for (x, y) in ((13, 15), (14, 16), (14, 13)):
        c.put_ramp(X + x, Y + y, 'skin', 1)                # Ruß auf der Wange
    # Hut: hoher Kegel, Spitze nach hinten abgeknickt und angekokelt
    poly(c, [(X + 9, Y + 10), (X + 23, Y + 10), (X + 19, Y + 4), (X + 16, Y + -2), (X + 11, Y + -3), (X + 12, Y + 3)], 'fire', lo=0, hi=3)
    thick_line(c, X + 13, Y - 3, X + 5, Y - 2, 3.4, 'fire', lo=0, hi=2)
    thick_line(c, X + 5, Y - 2, X + 3, Y + 3, 2.6, 'fire', lo=0, hi=2)
    c.put_ramp(X + 2, Y + 4, 'coal', 1)
    c.put_ramp(X + 3, Y + 5, 'coal', 2)
    ellipse(c, X + 16, Y + 9.5, 10.0, 2.6, 'fire', lo=0, hi=3)
    for x in range(X + 8, X + 24):
        c.put_ramp(x, Y + 8, 'gold', 3 if x % 2 else 2)
    c.put_ramp(X + 11, Y + 8, 'gold', 5)
    c.put_ramp(X + 12, Y + 8, 'gold', 4)
    # Streichholzkopf + Flamme
    ellipse(c, X + 33, Y + 10, 3.0, 3.4, 'fire', lo=1, hi=4)
    c.put_ramp(X + 32, Y + 9, 'fire', 5)
    poly(c, [(X + 30, Y + 8), (X + 36, Y + 8), (X + 35, Y + 3), (X + 33, Y + 0), (X + 32, Y + 4)], 'fire', lo=3, hi=5)
    poly(c, [(X + 32, Y + 8), (X + 34, Y + 8), (X + 34, Y + 4), (X + 33, Y + 3)], 'gold', flat=5)
    c.outline()
    # Rauch aus der angekokelten Hutspitze
    for (x, y, r) in ((X + 2, Y - 1, 1.6), (X + 4, Y - 5, 2.0), (X + 3, Y - 8, 2.4)):
        puff(c, x, y, r, 'stone', 3, 5)
    for (x, y, i) in ((X + 37, Y + 6, 5), (X + 36, Y + 1, 4), (X + 39, Y + 10, 4)):
        c.put_ramp(x, y, 'gold', i)
    return c


# =========================================================================== UA-03 Zwergen-Donnerbüchse (M, 46 x 38)


def spr_dwarf_blunderbuss(anim='idle', f=0):
    c = Canvas(46, 38)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    # --- Kanone auf dem Rücken (hinter dem Zwerg gezeichnet): Messingrohr mit Trichtermündung
    bx0, by0, bx1, by1 = 4, 27 + bob, 36, 8 + bob
    barrel_tube(c, bx0, by0, bx1, by1, 7.0, 'gold', lo=1, hi=4, bands=(0.25, 0.62), flare=11, flare_len=10, cap=3.6)
    # Zündloch mit Funke
    c.put_ramp(8, 21 + bob, 'coal', 1)
    sparkle(c, 7, 18 + bob, 'fire', 5)
    # Stoffband der Mannschaft (Teamfarbe), flattert hinten
    for k in range(7):
        c.put_ramp(14 - k, 17 + bob + (k // 2) + (k % 2), 'teamA', 3)
        c.put_ramp(14 - k, 18 + bob + (k // 2) + (k % 2), 'teamA', 2)
    # --- Zwerg
    # Stiefel + Beine
    for (x0, x1, i) in ((13, 19, 2), (22, 28, 3)):
        c.rect(x0, 34, x1, 35, 'wood', i)
        c.rect(x0, 36, x1, 36, 'wood', 1)
    thick_line(c, 16, 29 + bob, 16, 34, 4.2, 'stone', lo=1, hi=3)
    thick_line(c, 25, 29 + bob, 25, 34, 4.2, 'stone', lo=2, hi=4)
    # Rumpf: Lederweste auf Kettenhemd
    round_rect(c, 11, 22 + bob, 30, 32 + bob, 'metal', lo=1, hi=4, radius=3)
    for y in (24, 27, 30):
        for x in range(12, 30):
            if (x + y) % 2 == 0:
                c.put_ramp(x, y + bob, 'metal', 2)
    # Hosenträger / Gurte (halten die Kanone)
    thick_line(c, 14, 22 + bob, 22, 31 + bob, 2.4, 'wood', lo=1, hi=3)
    thick_line(c, 26, 22 + bob, 18, 31 + bob, 2.4, 'wood', lo=2, hi=4)
    c.rect(20, 28 + bob, 21, 29 + bob, 'gold', 5)
    # Arm vorn mit Handschuh, am Gurt
    thick_line(c, 29, 24 + bob, 33, 29 + bob, 3.6, 'metal', lo=2, hi=4)
    c.rect(32, 29 + bob, 35, 31 + bob, 'wood', 3)
    c.rect(32, 29 + bob, 35, 29 + bob, 'wood', 4)
    # Kopf
    ellipse(c, 21.5, 19 + bob, 6.4, 5.2, 'skin', lo=2, hi=5)
    ellipse(c, 27.5, 21 + bob, 2.2, 1.8, 'skin', lo=3, hi=5)         # dicke Nase
    c.put_ramp(27, 21 + bob, 'fire', 4)
    c.rect(24, 16 + bob, 25, 17 + bob, 'coal', 1)
    # Bart: groß, rostrot, zwei Zöpfe mit Spangen; qualmt
    poly(c, [(14, 20 + bob), (29, 20 + bob), (30, 25 + bob), (26, 31 + bob), (21, 33 + bob), (16, 31 + bob), (13, 25 + bob)], 'fire', lo=1, hi=4)
    for (x, y) in ((17, 24), (19, 27), (22, 26), (24, 29), (26, 25), (21, 30), (16, 28), (28, 27)):
        c.put_ramp(x, y + bob, 'fire', 4 if (x + y) % 2 else 2)
    for (x, y) in ((18, 22), (23, 23), (20, 25), (25, 22)):
        c.put_ramp(x, y + bob, 'gold', 4)
    c.rect(19, 31 + bob, 22, 31 + bob, 'gold', 3)
    for x in range(22, 29):
        c.put_ramp(x, 22 + bob, 'fire', 1)                   # Schnurrbart-Schatten
    # Helm: Metallkuppe mit Krempe, Spitze und Nasenschutz
    def cap_clip(x, y):
        return y <= 15 + bob
    ellipse(c, 21.5, 15 + bob, 7.4, 6.4, 'metal', lo=1, hi=5, clip=cap_clip)
    for x in range(14, 30):
        c.put_ramp(x, 15 + bob, 'metal', 1 if x % 2 else 2)
    c.rect(21, 7 + bob, 22, 9 + bob, 'metal', 4)
    c.put_ramp(21, 6 + bob, 'metal', 5)
    c.put_ramp(26, 11 + bob, 'gold', 5)
    c.put_ramp(17, 11 + bob, 'gold', 4)
    c.outline()
    # Qualm: aus Bart und Mündung
    for (x, y, r) in ((33, 26 + bob, 1.5), (35, 22 + bob, 1.8), (34, 17 + bob, 2.1)):
        puff(c, x, y, r, 'stone', 3, 5)
    for (x, y, r) in ((40, 3, 2.0), (43, 1, 2.4)):
        puff(c, x, y, r, 'stone', 3, 5)
    return c


# =========================================================================== UA-04 Goblin-Kanone (L, 54 x 46)


def spr_goblin_cannon(anim='idle', f=0):
    c = Canvas(54, 46)
    wave = [0, 1][f % 2]
    P0 = (10.0, 31.0)
    Pm = (27.0, 24.0)
    P1 = (41.0, 17.0)
    ux, uy = P1[0] - P0[0], P1[1] - P0[1]

    def A(pts, o=P0):
        return axis_pts(o[0], o[1], ux, uy, pts)
    # Lafette: Bohlen + zwei Räder
    round_rect(c, 8, 33, 47, 39, 'wood', lo=1, hi=4, radius=2)
    c.rect(20, 28, 33, 33, 'wood', 2)
    c.rect(20, 28, 20, 33, 'wood', 3)
    # Rohr: dunkles Eisen, vorn schlanker
    thick_line(c, P0[0], P0[1], Pm[0], Pm[1], 12.0, 'coal', lo=1, hi=4)
    thick_line(c, Pm[0], Pm[1], P1[0], P1[1], 9.6, 'coal', lo=1, hi=4)
    ellipse(c, P0[0] - 1.5, P0[1] + 0.8, 6.2, 6.2, 'coal', lo=1, hi=4)
    for (a, w_, idx) in ((5, 7.2, 5), (6, 7.2, 3), (33, 5.6, 5), (34, 5.6, 3)):
        p, q = A([(a, -w_), (a, w_)])
        c.line(p[0], p[1], q[0], q[1], 'metal', idx)
    # Goblin-Gesicht auf dem Rohr: Ohren, Kopf, Augen, Grinsen
    fx, fy = 24, 23
    for k in range(3):                                           # Teamband am Bodenstück (vor dem Gesicht)
        p_, q_ = A([(8 + k, -6.4), (8 + k, 6.4)])
        c.line(p_[0], p_[1], q_[0], q_[1], 'teamA', 4 - k)
    poly(c, [(fx - 6, fy - 6), (fx - 18, fy - 11), (fx - 14, fy - 5), (fx - 5, fy + 3)], 'goblin', lo=0, hi=3)
    poly(c, [(fx + 5, fy - 7), (fx + 10, fy - 13), (fx + 12, fy - 6), (fx + 6, fy + 1)], 'goblin', lo=2, hi=5)
    poly(c, [(fx - 7, fy - 5), (fx - 13, fy - 9), (fx - 10, fy - 5), (fx - 6, fy - 1)], 'skin', lo=2, hi=4)
    ellipse(c, fx, fy, 7.4, 6.6, 'goblin', lo=2, hi=5)
    c.rect(fx - 4, fy - 3, fx - 3, fy - 2, 'coal', 1)
    c.rect(fx + 2, fy - 3, fx + 3, fy - 2, 'coal', 1)
    c.put_ramp(fx - 4, fy - 3, 'bone', 5)
    c.put_ramp(fx + 2, fy - 3, 'bone', 5)
    for x in range(fx - 4, fx + 5):
        c.put_ramp(x, fy + 2 + (1 if abs(x - fx) > 2 else 0), 'goblin', 0)
    for x in (fx - 3, fx + 2):
        c.put_ramp(x, fy + 3, 'bone', 5)
    c.put_ramp(fx, fy, 'goblin', 1)
    c.put_ramp(fx + 1, fy, 'goblin', 1)
    # Mündungsring
    poly(c, A([(-2.0, -6.2), (1.8, -6.2), (1.8, 6.2), (-2.0, 6.2)], P1), 'metal', lo=1, hi=4)
    poly(c, A([(-0.4, -4.4), (2.2, -4.4), (2.2, 4.4), (-0.4, 4.4)], P1), 'coal', flat=0)
    # Lunte
    for (x, y, i) in ((3, 28, 3), (2, 27, 3), (2, 26, 2)):
        c.put_ramp(x, y, 'dirt', i)
    # Der kleine Goblin guckt aus der Mündung und winkt
    ellipse(c, 43.5, 15.5, 4.6, 3.0, 'goblin', lo=2, hi=4)
    thick_line(c, 46, 13, 50 + wave, 7 - wave, 2.6, 'goblin', lo=2, hi=5)
    c.rect(49 + wave, 4 - wave, 51 + wave, 7 - wave, 'goblin', 5)
    c.rect(49 + wave, 4 - wave, 49 + wave, 7 - wave, 'goblin', 4)
    poly(c, [(38, 10), (32, 5), (39, 14)], 'goblin', lo=1, hi=4)
    poly(c, [(48, 8), (52, 3 + wave), (47, 12)], 'goblin', lo=2, hi=5)
    ellipse(c, 43.5, 10.5, 5.2, 4.6, 'goblin', lo=3, hi=5)
    c.rect(45, 9, 46, 10, 'coal', 1)
    c.put_ramp(45, 9, 'bone', 5)
    for x in range(43, 47):
        c.put_ramp(x, 13, 'goblin', 1)
    # Räder (vorn)
    wheel2(c, 17, 40, 6.6, 'wood', 'metal', 6, 20)
    wheel2(c, 40, 40, 6.6, 'wood', 'metal', 6, 50)
    c.outline()
    return c


# =========================================================================== UA-05 Ork-Kanone (XL, 64 x 56)


def spr_orc_cannon(anim='idle', f=0):
    c = Canvas(64, 56)
    flap = [0, 1][f % 2]
    # --- Banner (Teamfarbe), Stange links auf der Pyramide
    thick_line(c, 12, 39, 12, 8, 1.8, 'wood', lo=1, hi=3)
    c.put_ramp(12, 7, 'metal', 5)
    for k in range(11):
        wob = 1 if (k + flap) % 4 in (1, 2) else 0
        for j in range(5 if k < 8 else 3):
            c.put_ramp(11 - k, 9 + j + k // 4 + wob, 'teamA', (4, 3, 3, 2, 1)[j])
    # --- Rohr: schweres dunkles Eisen mit Stachelringen, Zahn-Mündung (hinter der Pyramide gezeichnet)
    P0, P1 = (27.0, 28.0), (51.0, 13.0)
    ux, uy = P1[0] - P0[0], P1[1] - P0[1]

    def A(pts, o=P0):
        return axis_pts(o[0], o[1], ux, uy, pts)
    thick_line(c, P0[0], P0[1], P1[0], P1[1], 12.0, 'coal', lo=1, hi=4)
    ellipse(c, P0[0] - 1.0, P0[1] + 1.0, 6.4, 6.4, 'coal', lo=1, hi=4)
    for a in (8.0, 20.0, 29.0):
        for (da, idx) in ((0, 5), (1, 3)):
            p_, q_ = A([(a + da, -6.6), (a + da, 6.6)])
            c.line(p_[0], p_[1], q_[0], q_[1], 'metal', idx)
        sp = A([(a - 1.5, -6.4), (a + 2.5, -6.4), (a + 0.5, -10.5)])
        poly(c, sp, 'metal', lo=2, hi=5)
    # Trichtermündung
    mz = A([(-8, -6), (2.5, -9), (2.5, 9), (-8, 6)], P1)
    poly(c, mz, 'coal', lo=1, hi=4)
    rim = A([(1.0, -9.4), (3.5, -9.4), (3.5, 9.4), (1.0, 9.4)], P1)
    poly(c, rim, 'metal', lo=1, hi=4)
    inn = A([(2.2, -7.2), (4.2, -7.2), (4.2, 7.2), (2.2, 7.2)], P1)
    poly(c, inn, 'coal', flat=0)
    for b in (6.4, -6.4):                                   # Hauer am Mündungsrand (bone)
        t0 = A([(1.0, b), (5.5, b * 1.05)], P1)
        p0, p1 = t0
        thick_line(c, p0[0], p0[1], p1[0] + 0.6, p1[1] - 1.6, 2.2, 'bone', lo=3, hi=5)
    # --- Pyramide aus Steinblöcken (4 Stufen), vorn
    base_y = 51
    for k in range(4):
        x0, x1 = 5 + 6 * k, 59 - 6 * k
        yb = base_y - 7 * k
        yt = yb - 6
        for y in range(yt, yb + 1):
            for x in range(x0, x1 + 1):
                if y <= yt + 1:
                    idx = 5 if y == yt else 4
                elif y >= yb:
                    idx = 1
                else:
                    idx = 3
                    if x <= x0 + 1:
                        idx = 4
                    elif x >= x1 - 2:
                        idx = 2
                    if (x + y) % 2 == 0 and idx == 3 and (x * 7 + y * 3 + k) % 5 == 0:
                        idx = 2
                    # Fugen
                    if y == yt + 4 and idx == 3:
                        idx = 2
                    if (x - x0 + 5 * (k % 2)) % 11 == 0 and idx in (3, 2) and y > yt + 1:
                        idx = 1
                c.put_ramp(x, y, 'stone', idx)
        for y in range(yt, yb + 1):
            c.put_ramp(x1, y, 'stone', 1)
    # --- Kriegsbemalung: rote Streifen, weiße Handabdrücke, Totenkopf
    for (xa, ya, xb, yb2) in ((14, 49, 22, 33), (51, 49, 43, 33)):
        thick_line(c, xa, ya, xb, yb2, 3.4, 'fire', lo=1, hi=3)
    for (xa, ya, xb, yb2) in ((22, 50, 27, 40), (43, 50, 38, 40)):
        thick_line(c, xa, ya, xb, yb2, 2.2, 'fire', lo=1, hi=3)
    for (hx, hy) in ((9, 44), (54, 44)):
        c.rect(hx, hy, hx + 2, hy + 2, 'bone', 5)
        for (dx, dy) in ((0, -1), (1, -2), (2, -1)):
            c.put_ramp(hx + dx, hy + dy, 'bone', 4)
    sx, sy = 29, 33
    ellipse(c, sx + 3, sy + 3, 4.4, 3.8, 'bone', lo=3, hi=5)
    c.rect(sx + 1, sy + 6, sx + 5, sy + 8, 'bone', 3)
    c.rect(sx + 1, sy + 2, sx + 2, sy + 3, 'coal', 0)
    c.rect(sx + 4, sy + 2, sx + 5, sy + 3, 'coal', 0)
    c.put_ramp(sx + 3, sy + 5, 'coal', 1)
    for x in (sx + 2, sx + 4):
        c.put_ramp(x, sy + 7, 'coal', 2)
    # --- zwei massive Scheibenräder mit Eisenbolzen
    for wx in (13, 51):
        ellipse(c, wx, 49, 7.2, 7.2, 'wood', lo=1, hi=4)
        ellipse(c, wx, 49, 4.4, 4.4, 'wood', lo=0, hi=3, ambient=0.3)
        for k in range(6):
            a = math.radians(k * 60 + 10)
            c.put_ramp(wx + int(round(math.cos(a) * 5.8)), 49 + int(round(math.sin(a) * 5.8)), 'metal', 4)
        ellipse(c, wx, 49, 1.8, 1.8, 'metal', lo=2, hi=5)
    c.outline()
    return c
