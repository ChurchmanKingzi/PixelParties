"""pack_art1: Sprites UA-06 Eiszapfen-Mörser, UA-07 Sporenschleuder, UA-08 Kalmar-Kanone, UA-09 Fledermaus-Hexe."""
from __future__ import annotations

import math
import random

from cards_art import *
from pack_art1_kit import *


# =========================================================================== UA-06 Eiszapfen-Mörser (XL, 50 x 56)


def spr_icicle_mortar(anim='idle', f=0):
    c = Canvas(50, 56)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    rnd = random.Random(61)
    mx, my = 36, 28                                  # Trichtermitte
    # --- Eiszapfen-Fächer (aus dem Trichter, hinter dem Trichterrand)
    for (ang, ln_, w_) in ((-50, 12, 5.4), (-27, 19, 6.0), (-8, 24, 6.8), (12, 21, 6.4), (33, 16, 5.8), (54, 11, 5.0)):
        a_ = math.radians(ang)
        tx, ty = mx + math.sin(a_) * ln_, my - 1 - math.cos(a_) * ln_
        nx_, ny_ = math.cos(a_), math.sin(a_)
        poly(c, [(mx + math.sin(a_) * 2 - nx_ * w_ / 2, my - 1 - ny_ * 0 + 0.0), (mx + math.sin(a_) * 2 + nx_ * w_ / 2, my - 1), (tx, ty)], 'ice', lo=2, hi=5)
        c.put_ramp(int(round(mx + (tx - mx) * 0.55)), int(round(my - 1 + (ty - my + 1) * 0.55)), 'ice', 5)
    # --- Mörser aus Holz mit Eisenreifen: Fußplatte, Rohr, Trichter
    c.rect(26, 52, 46, 54, 'wood', 2)
    c.rect(26, 52, 46, 52, 'wood', 4)
    c.rect(26, 54, 46, 54, 'wood', 1)
    thick_line(c, mx, 52, mx, 40, 9.0, 'wood', lo=1, hi=4)
    for y in (43, 49):
        band(c, mx - 4, mx + 4, y, 'metal', 1, 5)
        band(c, mx - 4, mx + 4, y + 1, 'metal', 0, 2)
    poly(c, [(26, 27), (46, 27), (41, 42), (31, 42)], 'wood', lo=1, hi=4)
    for y in (33, 38):
        w_ = 10 - (42 - y) * 0.0 + (y - 27) * -0.0
        x0 = 26 + (y - 27) * 5 / 15
        band(c, int(x0), int(46 - (y - 27) * 5 / 15), y, 'metal', 1, 4)
    ellipse(c, mx, 27, 10.4, 3.0, 'wood', lo=2, hi=5)
    ellipse(c, mx, 27.4, 8.2, 1.9, 'coal', lo=0, hi=1)
    # Frost: Reif auf dem Holz und Zapfen am Rand
    for (x, y) in ((28, 29), (29, 31), (27, 28), (31, 35), (30, 33)):
        c.put_ramp(x, y, 'ice', 5)
    for (x, y, h) in ((26, 28, 5), (44, 28, 4), (30, 30, 3), (41, 31, 3)):
        poly(c, [(x - 1, y), (x + 1, y), (x, y + h)], 'ice', lo=3, hi=5)
    # --- Yeti
    # Beine + Füße
    thick_line(c, 9, 44, 8, 50, 7.0, 'fur', lo=1, hi=3)
    thick_line(c, 19, 44, 20, 50, 7.0, 'fur', lo=2, hi=4)
    for (cx, i0, i1) in ((7, 2, 4), (21, 3, 5)):
        ellipse(c, cx, 52, 5.6, 3.2, 'fur', lo=i0, hi=i1)
        for k in (-3, -1, 1):
            c.put_ramp(cx + k + 2, 54, 'bone', 4)
    # Körper (zottelig)
    ellipse(c, 14, 33 + bob, 12.2, 13.6, 'fur', lo=1, hi=5, ambient=0.14)
    ellipse(c, 17, 38 + bob, 6.5, 7.5, 'fur', lo=3, hi=5, ambient=0.3)
    for _ in range(30):
        x, y = rnd.randint(5, 24), rnd.randint(22, 44)
        if c.alpha(x, y + bob):
            i = rnd.choice([2, 3, 4])
            c.put_ramp(x, y + bob, 'fur', i)
            c.put_ramp(x - 1, y + 1 + bob, 'fur', i)
    # Zotteln als Zacken in der Silhouette
    for (x, y, dx_) in ((3, 28, -3), (2, 36, -3), (4, 43, -3), (22, 44, 3), (13, 46, 0), (24, 24, 3)):
        poly(c, [(x, y - 2 + bob), (x, y + 2 + bob), (x + dx_, y + 3 + bob)], 'fur', lo=1, hi=4)
    # hinterer Arm
    thick_line(c, 6, 27 + bob, 3, 40 + bob, 6.0, 'fur', lo=0, hi=3)
    ellipse(c, 3, 42 + bob, 3.6, 3.2, 'fur', lo=1, hi=3)
    # Schal (Teamfarbe)
    for k in range(13):
        y0 = 20 + bob + (1 if 5 < k < 10 else 0)
        for j, i in enumerate((4, 3, 2)):
            c.put_ramp(8 + k, y0 + j, 'teamA', i)
    for k in range(7):
        for j in (0, 1):
            c.put_ramp(8 - k // 3 + j, 21 + k + bob, 'teamA', 4 - j - (k % 2))
    # vorderer Arm greift den Trichter
    thick_line(c, 22, 26 + bob, 30, 38 + bob, 6.2, 'fur', lo=2, hi=5)
    ellipse(c, 31, 39 + bob, 4.0, 3.4, 'fur', lo=3, hi=5)
    for k in (-2, 0, 2):
        c.put_ramp(34, 39 + k + bob, 'bone', 4)
    # Kopf
    ellipse(c, 15, 14 + bob, 8.6, 7.6, 'fur', lo=2, hi=5, ambient=0.2)
    for (x, y, dx_) in ((8, 9, -3), (11, 6, -2), (16, 6, 1), (21, 8, 3)):
        poly(c, [(x - 2, y + 1 + bob), (x + 2, y + 1 + bob), (x + dx_, y - 3 + bob)], 'fur', lo=2, hi=5)
    ellipse(c, 18.5, 17 + bob, 6.0, 4.8, 'ice', lo=2, hi=4, ambient=0.3)
    c.rect(19, 15 + bob, 20, 16 + bob, 'coal', 1)
    c.rect(23, 15 + bob, 24, 16 + bob, 'coal', 1)
    for x in range(18, 25):
        c.put_ramp(x, 14 + bob, 'fur', 1)                        # Brauen
    for x in range(18, 25):
        c.put_ramp(x, 20 + bob, 'coal', 1)
    for x in (19, 23):
        c.put_ramp(x, 21 + bob, 'bone', 5)
    c.outline()
    # Frostfunken
    for (x, y) in ((46, 4), (24, 8), (47, 15), (30, 3), (49, 24)):
        c.put_ramp(x, y, 'ice', 5)
        c.put_ramp(x + 1, y, 'ice', 4)
        c.put_ramp(x, y + 1, 'ice', 4)
    return c


# =========================================================================== UA-07 Sporenschleuder (L, 58 x 52)


def spr_spore_slinger(anim='idle', f=0):
    b = Canvas(58, 52)
    c = b
    rnd = random.Random(71)
    puffph = f % 2
    # --- Stiel (bauchig) mit Wurzelfüßen
    for y in range(26, 50):
        half = 7 + (3 if y > 40 else 0) + (1 if y > 46 else 0) - (1 if y < 30 else 0)
        for x in range(22 - half, 22 + half + 1):
            u = (x - (22 - half)) / (2 * half + 1)
            idx = 5 if u < 0.2 else (4 if u < 0.45 else (3 if u < 0.75 else 2))
            if (x + y) % 2 == 0 and idx in (4, 3) and texture_noise(x, y, 7) > 0.78:
                idx -= 1
            c.put_ramp(x, y, 'bone', idx)
    for (x, y) in ((9, 50), (10, 50), (11, 49), (33, 50), (34, 50), (35, 49), (18, 50), (26, 50)):
        c.put_ramp(x, y, 'bone', 2)
        c.put_ramp(x, y + 1, 'bone', 1)
    for x in range(10, 36):
        c.put_ramp(x, 51, 'bone', 1)
    # Tür und Fenster: hier wohnen Tierchen
    poly(c, [(17, 48), (17, 41), (19, 39), (22, 39), (24, 41), (24, 48)], 'wood', lo=1, hi=3)
    c.rect(18, 41, 18, 47, 'wood', 4)
    c.put_ramp(23, 45, 'gold', 5)
    ellipse(c, 30, 38, 3.0, 3.0, 'coal', lo=0, hi=2)
    ellipse(c, 30, 38, 1.8, 1.8, 'gold', lo=3, hi=5)
    c.put_ramp(29, 37, 'gold', 5)
    # Schnecke am Stiel
    ellipse(c, 33, 45, 2.6, 2.6, 'gold', lo=2, hi=5)
    c.put_ramp(33, 45, 'gold', 1)
    for x in range(30, 37):
        c.put_ramp(x, 47, 'skin', 3 if x < 36 else 4)
    c.put_ramp(37, 46, 'skin', 4)
    c.put_ramp(38, 45, 'skin', 3)
    # --- Hut: Kuppel + Lamellen
    ellipse(c, 22, 27, 20.5, 16.0, 'cloth', lo=1, hi=5, ambient=0.14, clip=lambda x, y: y <= 28)
    ellipse(c, 22, 29, 20.0, 3.4, 'bone', lo=0, hi=2, ambient=0.2, clip=lambda x, y: y >= 28)
    for x in range(4, 41, 3):
        c.put_ramp(x, 30, 'bone', 0)
        c.put_ramp(x + 1, 31, 'bone', 1)
    # Flecken
    for (sx, sy, r) in ((11, 22, 3.2), (24, 14, 3.6), (33, 22, 2.8), (17, 27, 2.2), (28, 26, 2.0), (7, 27, 1.6)):
        ellipse(c, sx, sy, r, r * 0.78, 'bone', lo=3, hi=5)
    # Käfer auf dem Hut
    for (x, y, i) in ((13, 14, 3), (14, 14, 3), (13, 13, 4), (14, 13, 4)):
        c.put_ramp(x, y, 'fire', i)
    c.put_ramp(15, 14, 'coal', 1)
    # Fähnchen (Teamfarbe)
    thick_line(c, 6, 21, 6, 6, 1.4, 'wood', lo=1, hi=3)
    for k in range(7):
        for j, i in enumerate((4, 3, 2)):
            c.put_ramp(5 - k, 7 + j + k // 4, 'teamA', i)
    # --- Rohr (Pilzstiel-Schlauch) mit Wulstringen, Trichtermündung
    P0, P1 = (26.0, 20.0), (44.0, 7.0)
    ux, uy = P1[0] - P0[0], P1[1] - P0[1]

    def A(pts, o=P0):
        return axis_pts(o[0], o[1], ux, uy, pts)
    thick_line(c, P0[0], P0[1], P1[0], P1[1], 10.0, 'bone', lo=2, hi=5)
    ellipse(c, P0[0] - 1, P0[1] + 1, 6.4, 5.2, 'cloth', lo=1, hi=4)                       # Manschette am Hut
    for a in (6.0, 15.0):
        for (da, idx) in ((0, 3), (1, 1)):
            p_, q_ = A([(a + da, -6.0), (a + da, 6.0)])
            c.line(p_[0], p_[1], q_[0], q_[1], 'cloth', idx)
    mz = A([(-8, -5), (2.0, -9), (2.0, 9), (-8, 5)], P1)
    poly(c, mz, 'bone', lo=2, hi=5)
    rim = A([(0.6, -9.4), (3.0, -9.4), (3.0, 9.4), (0.6, 9.4)], P1)
    poly(c, rim, 'cloth', lo=1, hi=4)
    inn = A([(1.8, -7.0), (3.6, -7.0), (3.6, 7.0), (1.8, 7.0)], P1)
    poly(c, inn, 'purple', lo=0, hi=1)
    # Sporenwolke aus der Mündung (auf größerer Fläche, damit sie nicht abgeschnitten wird)
    c = Canvas(62, 62)
    c.blit(b, 0, 10)
    ox, oy = P1[0] + 5, P1[1] + 10 - 3
    for (dx, dy, r) in ((0, 0, 3.0), (5, -4, 3.8), (6, -9, 4.4), (12, -6, 3.2), (11, 1, 2.4), (2, -8, 2.2)):
        ellipse(c, ox + dx, oy + dy - puffph, r, r * 0.9, 'leaf', lo=2, hi=5, ambient=0.25)
    for (dx, dy) in ((2, -2), (6, -5), (5, -12), (8, -9), (12, -7), (3, -9)):
        c.put_ramp(int(ox + dx), int(oy + dy - puffph), 'goblin', 5)
    for (dx, dy) in ((14, -2), (16, -9), (9, -16), (1, -14)):
        c.put_ramp(int(ox + dx), int(oy + dy - puffph), 'leaf', 4)
    c.outline()
    return c


# =========================================================================== UA-08 Kalmar-Kanone (L, 60 x 48)


def spr_squid_cannon(anim='idle', f=0):
    c = Canvas(60, 48)
    sway = [0, 1][f % 2]
    B0, B1 = (11.0, 35.0), (30.0, 26.0)
    ux, uy = B1[0] - B0[0], B1[1] - B0[1]

    def A(pts, o=B0):
        return axis_pts(o[0], o[1], ux, uy, pts)
    # Wagen: Bohle + Räder
    round_rect(c, 6, 39, 42, 44, 'wood', lo=1, hi=4, radius=2)
    c.rect(18, 34, 28, 39, 'wood', 2)
    c.rect(18, 34, 18, 39, 'wood', 3)
    # Kalmar-Mantel und Flossen (hinter dem Fass-Rand: Spitze nach oben)
    poly(c, [(27, 19), (40, 17), (35, 7), (31, 0), (28, 8)], 'purple', lo=1, hi=4)
    poly(c, [(30, 9), (21, 9), (28, 17)], 'purple', lo=2, hi=5)
    poly(c, [(35, 8), (42, 6), (38, 17)], 'purple', lo=1, hi=4)
    for (x, y) in ((31, 8), (33, 12), (30, 13), (35, 14), (32, 4)):
        c.put_ramp(x, y, 'purple', 5)
    # Fass: Daubenholz mit Eisenreifen
    thick_line(c, B0[0], B0[1], B1[0], B1[1], 16.0, 'wood', lo=1, hi=4)
    ellipse(c, B0[0] - 0.8, B0[1] + 0.4, 8.0, 8.0, 'wood', lo=0, hi=3)
    for a in (4.0, 11.0, 18.0):
        for (da, ramp, idx) in ((0, 'metal', 4), (1, 'metal', 2)):
            p_, q_ = A([(a + da, -8.4), (a + da, 8.4)])
            c.line(p_[0], p_[1], q_[0], q_[1], ramp, idx)
    for b in (-4.0, 0.0, 4.0):
        for a in (7.0, 14.0, 21.0):
            px_, py_ = A([(a, b)])[0]
            c.put_ramp(int(px_), int(py_), 'wood', 1)
    # Fassöffnung: Rand + dunkles Inneres
    rim = A([(-1.4, -8.6), (1.2, -8.2), (2.2, -4.0), (2.4, 0), (2.2, 4.0), (1.2, 8.2), (-1.4, 8.6)], B1)
    poly(c, rim, 'wood', lo=2, hi=5)
    inn = A([(-0.6, -6.8), (0.8, -6.4), (1.6, -3.0), (1.8, 0), (1.6, 3.0), (0.8, 6.4), (-0.6, 6.8)], B1)
    poly(c, inn, 'coal', flat=0)
    # Kopf + Augen
    ellipse(c, 34, 21, 8.2, 7.0, 'purple', lo=1, hi=5)
    for (ex, ey) in ((37, 19), (42, 20)):
        c.rect(ex, ey, ex + 1, ey + 1, 'coal', 0)
        c.put_ramp(ex, ey, 'bone', 5)
        c.put_ramp(ex - 1, ey - 1, 'purple', 0)
    c.put_ramp(39, 25, 'purple', 0)                      # Trichter (Siphon)
    c.put_ramp(40, 25, 'purple', 0)
    # Tentakel: hängen über den Fassrand und ringeln sich, mit Saugnäpfen
    tent = [((38, 26), (45, 29 + sway), (49, 25 + sway)),
            ((35, 27), (41, 33), (44, 38 - sway)),
            ((31, 27), (33, 34), (28, 38 - sway)),
            ((28, 25), (24, 30), (18, 29 + sway))]
    for (p0, p1, p2) in tent:
        thick_line(c, p0[0], p0[1], p1[0], p1[1], 3.4, 'purple', lo=1, hi=4)
        thick_line(c, p1[0], p1[1], p2[0], p2[1], 2.4, 'purple', lo=2, hi=4)
        for k in range(3):
            t = 0.25 + k * 0.28
            c.put_ramp(int(p1[0] + (p2[0] - p1[0]) * t), int(p1[1] + (p2[1] - p1[1]) * t) + 1, 'bone', 4)
    # Räder vorn
    for wx in (14, 35):
        wheel2(c, wx, 42, 5.8, 'wood', 'metal', 6, 25 + wx)
    # Tintenstrahl nach rechts
    for (x, y, r) in ((46, 20, 2.8), (51, 17, 2.4), (54, 21, 2.8), (50, 24, 1.8), (56, 15, 1.8), (57, 25, 1.6), (47, 14, 1.6)):
        ellipse(c, x, y, r, r, 'coal', lo=0, hi=3, ambient=0.3)
    for (x, y) in ((45, 19), (50, 16), (53, 20), (55, 14)):
        c.put_ramp(x, y, 'purple', 3)
    c.outline()
    return c


# =========================================================================== UA-09 Fledermaus-Hexe (XL, 64 x 52)


def spr_bat_witch(anim='idle', f=0):
    c = Canvas(64, 52)
    Y = 9
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    Yb = Y + bob
    # --- Besen: Reisigbüschel hinten (fächert), Stiel mit Bindung
    for (ex, ey) in ((1, 24), (0, 28), (1, 32), (2, 36), (4, 40)):
        thick_line(c, 14, 31 + Y, ex + 1, ey + Y, 2.8, 'gold', lo=1, hi=4)
    # --- Umhang (flattert zerfranst nach hinten)
    poly(c, [(23, 15 + Yb), (12, 17 + Yb), (5, 24 + Yb), (11, 24 + Yb), (8, 31 + Yb), (16, 29 + Yb), (15, 34 + Yb), (23, 30 + Yb)], 'coal', lo=0, hi=3)
    # Beine: vorn angewinkelt, hinten hängend; Schnabelschuhe
    thick_line(c, 30, 29 + Yb, 36, 30 + Yb, 4.4, 'cloth', lo=1, hi=3)
    thick_line(c, 36, 30 + Yb, 37, 37 + Yb, 4.4, 'cloth', lo=1, hi=3)
    poly(c, [(34, 37 + Yb), (41, 37 + Yb), (44, 39 + Yb), (34, 41 + Yb)], 'coal', lo=1, hi=3)
    thick_line(c, 26, 29 + Yb, 25, 37 + Yb, 4.4, 'cloth', lo=0, hi=2)
    poly(c, [(23, 37 + Yb), (30, 37 + Yb), (33, 39 + Yb), (23, 41 + Yb)], 'coal', lo=0, hi=2)
    # Besenstiel vor dem Bein
    thick_line(c, 12, 31 + Y, 54, 24 + Y, 3.6, 'wood', lo=1, hi=4)
    c.put_ramp(55, 23 + Y, 'wood', 5)
    for (x, i) in ((13, 2), (15, 4), (17, 2)):
        c.line(x, 28 + Y, x + 1, 35 + Y, 'dirt', i)
    # Rumpf
    poly(c, [(23, 14 + Yb), (33, 14 + Yb), (36, 29 + Yb), (22, 30 + Yb)], 'cloth', lo=1, hi=4)
    for x in range(22, 37):
        c.put_ramp(x, 23 + Yb, 'gold', 2 if x % 2 else 3)
    c.rect(28, 22 + Yb, 30, 24 + Yb, 'gold', 4)
    poly(c, [(25, 13 + Yb), (33, 13 + Yb), (30, 18 + Yb)], 'bone', lo=3, hi=5)           # Kragen
    # Arm vorn greift den Stiel
    thick_line(c, 31, 18 + Yb, 40, 25 + Yb, 3.8, 'cloth', lo=1, hi=4)
    c.rect(40, 24 + Yb, 42, 26 + Yb, 'skin', 3)
    # Zauberarm erhoben, offene Hand (Finger gespreizt)
    thick_line(c, 28, 17 + Yb, 38, 10 + Yb, 3.6, 'cloth', lo=2, hi=4)
    ellipse(c, 40, 9 + Yb, 2.4, 2.4, 'skin', lo=3, hi=5)
    for (dx, dy) in ((3, -3), (4, -1), (4, 1), (3, 3)):
        c.put_ramp(40 + dx, 9 + dy + Yb, 'skin', 4)
    # Kopf: Hakennase, ein Auge, Grinsen
    ellipse(c, 29, 10 + Yb, 5.8, 5.2, 'skin', lo=2, hi=5)
    poly(c, [(33, 9 + Yb), (40, 12 + Yb), (33, 13 + Yb)], 'skin', lo=3, hi=5)
    c.rect(32, 8 + Yb, 33, 9 + Yb, 'coal', 1)
    for x in range(29, 33):
        c.put_ramp(x, 14 + Yb, 'coal', 1)
    c.put_ramp(31, 15 + Yb, 'bone', 5)
    # Haare: wilde rote Strähnen nach hinten
    for (ex, ey) in ((15, 6), (13, 11), (14, 16), (18, 20)):
        thick_line(c, 25, 9 + Yb, ex, ey + Yb, 3.0, 'fire', lo=2, hi=4)
    # Hut: Krempe, Kegel mit abgeknickter Spitze, Teamband
    ellipse(c, 28, 5 + Yb, 11.0, 3.0, 'cloth', lo=0, hi=3)
    poly(c, [(22, 4 + Yb), (34, 4 + Yb), (32, -1 + Yb), (28, -6 + Yb), (22, -6 + Yb), (24, -1 + Yb)], 'cloth', lo=0, hi=3)
    thick_line(c, 25, -5 + Yb, 17, -4 + Yb, 3.2, 'cloth', lo=0, hi=2)
    thick_line(c, 17, -4 + Yb, 15, 1 + Yb, 2.4, 'cloth', lo=0, hi=2)
    for x in range(22, 35):
        c.put_ramp(x, 3 + Yb, 'teamA', 3 if x % 2 else 2)
    c.rect(27, 2 + Yb, 28, 4 + Yb, 'gold', 4)
    # Fledermausschwarm aus der Hand: rote Augen, Mini-Zähne
    for (bx, by, fl, big) in ((52, 4, 0, True), (55, 17, 1, False)):
        b = bat_spr(fl if (f % 2 == 0) else 1 - fl, outline=False, big=big)
        c.blit(b, bx - b.w // 2, by + Y - b.h // 2)
    for (x, y, fl) in ((46, 24, 0), (61, 26, 1), (61, 3, 0)):
        c.blit(mini_bat((f + fl) % 2), x - 3, y + Y - 2)
    for (x, y) in ((47, 9), (50, 14), (46, 14), (55, 11)):
        c.put_ramp(x, y + Y, 'purple', 4)
    c.outline()
    return c
