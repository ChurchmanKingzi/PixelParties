"""pack_art1: Sprites UA-10 Nagelbrett-Ballista, UA-11 Blitzspulen-Hexe, UA-12 Maulwurf-Mörser, UA-13 Frosch-Katapult."""
from __future__ import annotations

import math
import random

from cards_art import *
from pack_art1_kit import *


# =========================================================================== UA-10 Nagelbrett-Ballista (XL, 64 x 46)


def spr_nailboard_ballista(anim='idle', f=0):
    c = Canvas(64, 46)
    # --- Nagelbrett: Bohle am Boden, dicht mit Nägeln (Spitzen nach oben) gespickt
    for x in range(8, 58, 4):
        c.line(x, 38, x, 33, 'metal', 3)
        c.put_ramp(x, 32, 'metal', 5)
        c.put_ramp(x + 1, 38, 'metal', 1)
    # Stütze + Strebe
    c.rect(26, 30, 32, 40, 'wood', 2)
    c.rect(26, 30, 26, 40, 'wood', 3)
    thick_line(c, 17, 40, 27, 31, 3.0, 'wood', lo=1, hi=3)
    round_rect(c, 3, 39, 60, 44, 'wood', lo=1, hi=4, radius=2)
    for x in range(6, 58, 5):
        c.put_ramp(x, 41, 'metal', 4)                       # Nagelköpfe in der Bohle
        c.put_ramp(x + 1, 41, 'metal', 2)
    # --- Schaft (Rail) mit Rille
    thick_line(c, 9, 29, 51, 23, 5.6, 'wood', lo=1, hi=4)
    thick_line(c, 12, 26, 49, 20.5, 1.2, 'wood', lo=0, hi=1)
    # --- Bogen: kräftig, nach vorn gewölbt, Metallspitzen; Sehne in V-Form zum Nocken
    pts = []
    for i in range(0, 13):
        t = i / 12.0
        pts.append((40 + 10.5 * math.sin(math.pi * t), 3 + 40 * t))
    for i in range(12):
        t = i / 12.0
        w_ = 5.0 - 2.2 * (abs(2 * t - 1) ** 1.6)
        thick_line(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w_, 'wood', lo=1, hi=4)
    for (x, y) in ((40, 3), (40, 43)):
        c.rect(x - 1, y - 1, x + 1, y + 1, 'metal', 4)
    thick_line(c, 49, 17, 49, 29, 3.6, 'metal', lo=1, hi=3)           # Eisenbeschlag am Griff
    loaded = anim != 'fire'
    nock = (20, 26) if loaded else (40, 23)
    c.line(40, 3, nock[0], nock[1], 'bone', 4)
    c.line(40, 43, nock[0], nock[1], 'bone', 3)
    # --- Bolzen: heller Schaft, Eisenspitze, Federn, Schleife (nur wenn geladen)
    if loaded:
        thick_line(c, 18, 25.5, 56, 18, 2.6, 'wood', lo=3, hi=5)
        poly(c, [(54, 14.5), (54, 21.5), (63, 17.5)], 'metal', lo=2, hi=5)
        for (dx, dy) in ((0, -2), (1, -3), (0, 3), (1, 4)):
            c.put_ramp(17 + dx, 25 + dy, 'bone', 4)
        # Schleife (Teamfarbe): zwei Schlaufen + Knoten + Bänder
        poly(c, [(46, 18), (41, 14), (41, 22), (46, 20)], 'teamA', lo=2, hi=5)
        poly(c, [(47, 18), (52, 14), (52, 22), (47, 20)], 'teamA', lo=1, hi=4)
        c.rect(45, 17, 48, 20, 'teamA', 4)
        c.put_ramp(46, 17, 'teamA', 5)
        c.line(46, 21, 44, 27, 'teamA', 3)
        c.line(48, 21, 50, 27, 'teamA', 2)
    # --- Kettenrad hinten mit Kette und Kurbel
    ellipse(c, 11, 27, 7.2, 7.2, 'metal', lo=1, hi=4)
    for k in range(10):
        a = math.radians(k * 36)
        c.put_ramp(11 + int(round(math.cos(a) * 8.4)), 27 + int(round(math.sin(a) * 8.4)), 'metal', 3)
    ellipse(c, 11, 27, 4.0, 4.0, 'metal', lo=0, hi=2, ambient=0.2)
    for k in range(5):
        a = math.radians(k * 72 + 20)
        c.line(11, 27, 11 + int(round(math.cos(a) * 5.4)), 27 + int(round(math.sin(a) * 5.4)), 'metal', 4)
    ellipse(c, 11, 27, 1.8, 1.8, 'gold', lo=3, hi=5)
    thick_line(c, 11, 27, 3, 20, 1.6, 'wood', lo=2, hi=4)
    c.rect(1, 18, 3, 20, 'wood', 4)
    # Kettenglieder vom Rad zum Nocken
    for k in range(8):
        x = 15 + k
        y = 20 + int(k * 0.8) + (1 if k % 2 else 0)
        c.put_ramp(x, y, 'metal', 5 if k % 2 else 3)
    c.outline()
    return c


# =========================================================================== UA-11 Blitzspulen-Hexe (M, 48 x 52)


def _zap(c, pts, ramp='gold', idx=5, glow='ice'):
    """Blitz-Zickzack: Linie mit helleren Rändern"""
    for (a, b) in zip(pts[:-1], pts[1:]):
        c.line(a[0], a[1], b[0], b[1], ramp, idx)


def spr_coil_witch(anim='idle', f=0):
    c = Canvas(48, 52)
    Y = 11 + ([0, -1][f % 2] if anim == 'idle' else 0)
    # Stiefel unter dem Spulenrock
    c.rect(9, Y + 38, 14, Y + 40, 'coal', 2)
    c.rect(20, Y + 38, 26, Y + 40, 'coal', 3)
    c.rect(9, Y + 40, 14, Y + 41, 'coal', 1)
    c.rect(20, Y + 40, 26, Y + 41, 'coal', 1)
    # Spulenrock: kupferner Kegel, schräge Drahtwindungen
    top, bot = Y + 17, Y + 39
    for y in range(top, bot):
        t = (y - top) / float(bot - top)
        x0 = int(round(11 - 5 * t))
        x1 = int(round(24 + 5 * t))
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1.0, float(x1 - x0))
            ph = (y + x * 0.45) % 3.0
            if ph < 1.0:
                idx = 5 if u < 0.28 else (4 if u < 0.65 else 3)
            elif ph < 2.0:
                idx = 3 if u < 0.4 else 2
            else:
                idx = 1
            c.put_ramp(x, y, 'gold', idx)
    for y in range(top, bot):                                    # dunkle Kante rechts (Schatten)
        t = (y - top) / float(bot - top)
        c.put_ramp(int(round(24 + 5 * t)), y, 'gold', 1)
    # Funken zwischen den Windungen
    for (x, y) in ((14, Y + 27), (21, Y + 33), (12, Y + 35), (24, Y + 24)):
        c.put_ramp(x, y, 'ice', 5)
    # Torus am Hals
    ellipse(c, 17.5, Y + 18, 8.8, 2.9, 'metal', lo=1, hi=5)
    ellipse(c, 17.5, Y + 18, 5.0, 1.0, 'coal', lo=0, hi=1)
    # linker Arm hoch mit Funken
    thick_line(c, 11, Y + 20, 6, Y + 15, 3.0, 'cloth', lo=0, hi=2)
    thick_line(c, 6, Y + 15, 5, Y + 10, 2.6, 'cloth', lo=0, hi=2)
    c.rect(4, Y + 8, 6, Y + 10, 'skin', 2)
    # rechter Arm streckt den Spulenstab nach vorn
    thick_line(c, 24, Y + 20, 31, Y + 18, 3.0, 'cloth', lo=1, hi=3)
    c.rect(31, Y + 16, 33, Y + 19, 'skin', 3)
    thick_line(c, 29, Y + 23, 39, Y + 9, 1.8, 'metal', lo=2, hi=4)
    ellipse(c, 40, Y + 8, 3.2, 3.2, 'ice', lo=3, hi=5)
    # Haare: zu Berge, elektrisch
    for (x0, y0, x1, y1) in ((11, 9, 3, 7), (11, 11, 2, 13), (12, 7, 5, 0), (14, 5, 11, -3), (17, 4, 18, -4), (21, 5, 26, -2), (23, 8, 31, 3), (23, 11, 30, 12)):
        thick_line(c, x0, Y + y0, x1, Y + y1, 2.4, 'ice', lo=2, hi=5)
    for (x1, y1) in ((3, 7), (5, 0), (11, -3), (18, -4), (26, -2), (31, 3)):
        c.put_ramp(x1, Y + y1, 'ice', 5)
    # Kopf: Schreck-Gesicht (o-Mund)
    ellipse(c, 17, Y + 11.5, 5.6, 5.0, 'skin', lo=2, hi=5)
    c.put_ramp(22, Y + 11, 'skin', 4)
    c.put_ramp(22, Y + 12, 'skin', 3)
    c.rect(19, Y + 9, 20, Y + 10, 'coal', 1)
    c.rect(18, Y + 13, 19, Y + 14, 'coal', 1)
    # Hut: schiefer Spitzhut mit geknickter Spitze, sitzt zwischen den Haaren
    ellipse(c, 17, Y + 5.5, 9.0, 2.4, 'purple', lo=0, hi=3)
    poly(c, [(11, Y + 5), (23, Y + 5), (21, Y - 3), (18, Y - 8), (13, Y - 9), (14, Y - 2)], 'purple', lo=0, hi=3)
    thick_line(c, 15, Y - 8, 10, Y - 5, 3.0, 'purple', lo=0, hi=2)
    for x in range(11, 24):
        c.put_ramp(x, Y + 4, 'teamA', 3 if x % 2 else 2)
    c.rect(16, Y + 3, 17, Y + 5, 'gold', 4)
    c.outline()
    # Blitzzickzack vom Stab
    _zap(c, [(43, Y + 7), (45, Y + 10), (43, Y + 12), (46, Y + 15)], 'gold', 5)
    _zap(c, [(42, Y + 4), (44, Y + 2)], 'ice', 5)
    for (x, y) in ((2, Y + 5), (5, Y + 4), (1, Y + 10)):
        c.put_ramp(x, y, 'gold', 5)
    return c


# =========================================================================== UA-12 Maulwurf-Mörser (L, 48 x 46)


def _drill_cone(c, cx, base_y, tip_y, half, phase=0):
    """Bohrergeschoss: Kegel mit Spiralnut"""
    for y in range(tip_y, base_y + 1):
        t = (y - tip_y) / float(max(1, base_y - tip_y))
        hw = t * half
        x0, x1 = int(round(cx - hw)), int(round(cx + hw))
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(1.0, float(x1 - x0))
            ph = (y + (x - cx) * 0.75 + phase) % 4.0
            idx = 5 if ph < 1.0 else (4 if ph < 2.0 else (3 if ph < 3.0 else 2))
            if u > 0.78:
                idx = max(1, idx - 2)
            elif u < 0.2:
                idx = min(5, idx + 1)
            c.put_ramp(x, y, 'metal', idx)


def spr_mole_mortar(anim='idle', f=0):
    c = Canvas(48, 46)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    rnd = random.Random(121)
    # --- Mörser: Rohr leicht nach rechts geneigt, Messingreifen, Bodenplatte
    c.rect(26, 42, 45, 44, 'metal', 2)
    c.rect(26, 42, 45, 42, 'metal', 4)
    c.rect(26, 44, 45, 44, 'metal', 1)
    thick_line(c, 34, 42, 37, 22, 11.0, 'metal', lo=1, hi=4)
    for y in (27, 37):
        for (dy, idx) in ((0, 5), (1, 3), (2, 1)):
            for x in range(30, 43):
                if abs(x - (34 + (42 - y) * -0.15)) < 6:
                    c.put_ramp(int(x + (y - 32) * -0.15), y + dy, 'gold', idx)
    for (x, y) in ((32, 32), (40, 32), (33, 41), (41, 40)):
        c.put_ramp(x, y, 'metal', 5)                                   # Nieten
    ellipse(c, 37, 21, 6.8, 2.4, 'metal', lo=2, hi=5)
    ellipse(c, 37, 21.4, 5.0, 1.4, 'coal', lo=0, hi=1)
    # --- Bohrer steckt im Rohr
    _drill_cone(c, 37, 20, 3, 6, phase=f)
    c.put_ramp(37, 2, 'metal', 5)
    # --- Maulwurf
    # Beine/Füße mit Grabkrallen
    for (cx, i0, i1) in ((8, 1, 3), (19, 2, 4)):
        ellipse(c, cx, 41, 5.0, 3.2, 'coal', lo=i0, hi=i1 + 1)
        for k in (-3, -1, 1):
            c.put_ramp(cx + k + 3, 43, 'bone', 4)
    # Körper (Buckel)
    ellipse(c, 14, 31 + bob, 12.4, 10.4, 'coal', lo=1, hi=5, ambient=0.18)
    ellipse(c, 17, 35 + bob, 6.5, 5.5, 'coal', lo=3, hi=5, ambient=0.3)
    for _ in range(18):
        x, y = rnd.randint(4, 22), rnd.randint(23, 38)
        if c.alpha(x, y + bob):
            c.put_ramp(x, y + bob, 'coal', rnd.choice([2, 3, 4]))
    # Schwänzchen
    thick_line(c, 3, 34 + bob, 0, 36 + bob, 2.0, 'skin', lo=2, hi=4)
    # Arme: beide Schaufelpfoten schieben das Geschoss ins Rohr
    thick_line(c, 20, 26 + bob, 29, 21 + bob, 5.0, 'coal', lo=1, hi=4)
    thick_line(c, 18, 30 + bob, 28, 28 + bob, 5.0, 'coal', lo=2, hi=4)
    for (hx, hy) in ((31, 20), (30, 28)):
        ellipse(c, hx, hy + bob, 3.8, 3.4, 'skin', lo=3, hi=5)
        for k in (-2, 0, 2):
            c.put_ramp(hx + 3, hy + k + bob, 'bone', 5)
    # Kopf: spitze rosa Schnauze, Schutzbrille mit Gummi
    ellipse(c, 21, 22 + bob, 7.0, 6.2, 'coal', lo=1, hi=5, ambient=0.2)
    poly(c, [(24, 21 + bob), (32, 25 + bob), (24, 27 + bob)], 'skin', lo=3, hi=5)
    ellipse(c, 32, 25 + bob, 1.6, 1.4, 'skin', lo=2, hi=4)
    c.put_ramp(31, 24 + bob, 'skin', 5)
    thick_line(c, 15, 18 + bob, 23, 19 + bob, 2.4, 'wood', lo=1, hi=3)          # Brillenband
    ellipse(c, 24, 19.5 + bob, 3.4, 3.4, 'metal', lo=1, hi=4)
    ellipse(c, 24, 19.5 + bob, 2.2, 2.2, 'ice', lo=2, hi=5)
    c.put_ramp(23, 18 + bob, 'ice', 5)
    c.put_ramp(25, 20 + bob, 'coal', 1)
    # kleines Teamband als Stirnband-Rest
    for x in range(15, 20):
        c.put_ramp(x, 17 + bob, 'teamA', 3)
    c.outline()
    # Erdbrocken
    for (x, y) in ((24, 44), (43, 40), (46, 43), (4, 44)):
        c.put_ramp(x, y, 'dirt', 4)
        c.put_ramp(x + 1, y, 'dirt', 3)
    return c


# =========================================================================== UA-13 Frosch-Katapult (XL, 62 x 50)


def spr_frog_catapult(anim='idle', f=0):
    c = Canvas(62, 50)
    rnd = random.Random(131)
    wob = [0, 1][f % 2] if anim == 'idle' else 0
    # --- Wagen: Bohlen + Räder
    round_rect(c, 3, 40, 58, 46, 'wood', lo=1, hi=4, radius=2)
    for x in range(6, 56, 6):
        c.put_ramp(x, 43, 'wood', 1)
    # --- Frosch: Hinterbein/Keule, Körper, Vorderbein
    ellipse(c, 12, 33, 9.0, 8.2, 'leaf', lo=1, hi=4)
    thick_line(c, 6, 39, 16, 39, 4.0, 'leaf', lo=1, hi=3)
    for k in (-1, 1, 3):
        c.put_ramp(3 + k * 2 + 2, 40, 'leaf', 3)
    ellipse(c, 24, 29, 16.5, 11.2, 'leaf', lo=1, hi=5, ambient=0.16)
    for _ in range(18):
        x, y = rnd.randint(10, 32), rnd.randint(20, 38)
        if c.alpha(x, y):
            c.put_ramp(x, y, 'leaf', rnd.choice([1, 4, 5]))
    # Satteldecke (Teamfarbe)
    poly(c, [(10, 22), (22, 19), (27, 28), (12, 32)], 'teamA', lo=1, hi=4)
    for k in range(7):
        c.put_ramp(11 + k * 2, 31 - k, 'gold', 4)
    # Vorderbein
    thick_line(c, 31, 33, 36, 39, 5.0, 'leaf', lo=2, hi=4)
    ellipse(c, 37, 39, 5.0, 2.2, 'leaf', lo=2, hi=5)
    for k in (0, 2, 4):
        c.put_ramp(39 + k // 2 + 1, 38 + (k % 3 == 0), 'leaf', 1)
    # Kopf: breites Maul, Glubschaugen
    ellipse(c, 32, 24, 12.6, 8.4, 'leaf', lo=2, hi=5)
    ellipse(c, 31, 30, 9.5, 3.4, 'goblin', lo=3, hi=5)                 # Kehle
    for x in range(21, 43):
        c.put_ramp(x, 27 + (1 if 26 < x < 38 else 0) - (1 if x > 39 else 0), 'leaf', 0)
    c.put_ramp(42, 25, 'leaf', 0)
    for (nx, ny) in ((40, 20), (42, 21)):
        c.put_ramp(nx, ny, 'leaf', 0)
    for (ex, ey) in ((26, 13), (35, 12)):
        ellipse(c, ex, ey, 4.8, 4.8, 'leaf', lo=2, hi=5)
        ellipse(c, ex + 1.2, ey + 0.4, 3.0, 3.0, 'bone', lo=4, hi=5)
        c.rect(int(ex + 1.5), int(ey), int(ex + 2.5), int(ey + 1), 'coal', 0)
    # --- Zunge = Wurfarm: aus dem Maul in weitem Bogen nach oben-rechts, Klebeball an der Spitze
    if anim == 'fire':                                    # Zunge nach vorn geschnalzt, Kugel ist weg
        tp = [(41, 27), (47, 25), (53, 22), (59, 20)]
    else:
        tp = [(41, 27), (47, 25 + wob), (52, 19), (55, 11 - wob)]
    for (a, b, w_) in ((tp[0], tp[1], 4.0), (tp[1], tp[2], 3.4), (tp[2], tp[3], 3.0)):
        thick_line(c, a[0], a[1], b[0], b[1], w_, 'skin', lo=2, hi=4)
    for (x, y) in ((44, 25), (49, 23), (54, 21)):
        c.put_ramp(x, y, 'skin', 5)
    if anim == 'fire':
        ellipse(c, 60, 20, 1.8, 1.8, 'skin', lo=3, hi=5)
        for (x, y) in ((59, 24), (61, 23), (60, 26)):
            c.put_ramp(x, y, 'slime', 4)
    else:
        ellipse(c, 56, 7 - wob, 4.6, 4.6, 'slime', lo=1, hi=5)
        for (dx, dy) in ((-1, -2), (1, 1)):
            c.put_ramp(56 + dx, 7 - wob + dy, 'bone', 5)
        c.put_ramp(58, 9 - wob, 'slime', 0)
    # Räder vorn
    for wx in (14, 47):
        wheel2(c, wx, 44, 5.8, 'wood', 'metal', 6, wx)
    c.outline()
    return c
