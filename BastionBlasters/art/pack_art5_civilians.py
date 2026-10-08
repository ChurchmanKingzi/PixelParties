"""Zivilisten UZ-03..UZ-07 (klein, Werkzeug gross, Unterstuetzung). Alle Figuren blicken nach rechts."""
from __future__ import annotations

import math
import random

from pixl import *
from pack_art5_kit import *


# =========================================================================== UZ-03 Ruestungs-Zwerg (38 x 32)


def spr_armorer_dwarf(anim='idle', f=0):
    c = Canvas(42, 34)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    # Amboss auf dem Ruecken (links, hochkant festgeschnallt): Horn links, Platte, Taille, Fuss
    rows = {6: (3, 19), 7: (1, 19), 8: (0, 19), 9: (2, 19), 10: (5, 19), 11: (8, 18)}
    for y, (x0, x1) in rows.items():
        for x in range(x0, x1 + 1):
            c.put_ramp(x, y + bob, 'metal', 4 if y == 6 else (3 if y in (7, 8) else 2))
    hline(c, 3, 19, 6 + bob, 'metal', 5)
    hline(c, 1, 12, 7 + bob, 'metal', 5)
    for y in range(12, 18):
        for x in range(8, 16):
            c.put_ramp(x, y + bob, 'metal', 2 if x < 12 else 1)
    for y in range(18, 23):
        for x in range(4, 19):
            c.put_ramp(x, y + bob, 'metal', 3 if y == 18 else (2 if x < 12 else 1))
    dither_box(c, 14, 8 + bob, 19, 11 + bob, 'metal', 1, 2)
    hline(c, 4, 18, 22 + bob, 'metal', 0)
    pts(c, [(2, 8 + bob), (3, 8 + bob)], 'metal', 5)
    # Riemen vom Amboss ueber die Brust
    thick_line(c, 12, 13 + bob, 19, 19 + bob, 1.8, 'wood', lo=1, hi=4)
    thick_line(c, 12, 18 + bob, 18, 26 + bob, 1.8, 'wood', lo=1, hi=3)
    # Beine + Stiefel
    for x0 in (19, 26):
        c.rect(x0, 28, x0 + 3, 30, 'dirt', 2)
        round_rect(c, x0 - 2, 30, x0 + 5, 33, 'wood', lo=0, hi=3, radius=1)
        c.put_ramp(x0 + 2, 30, 'wood', 4)
    # Koerper: breit, Teamfarben-Rock, Brustplatte
    round_rect(c, 16, 17 + bob, 33, 29 + bob, 'teamA', lo=1, hi=4, radius=2)
    for x in range(17, 33, 3):
        c.put_ramp(x, 29 + bob, 'teamA', 1)
    round_rect(c, 17, 17 + bob, 32, 23 + bob, 'metal', lo=1, hi=5, radius=2)
    dither_box(c, 28, 18 + bob, 31, 22 + bob, 'metal', 1, 2)
    hline(c, 16, 33, 25 + bob, 'wood', 1)
    hline(c, 16, 33, 26 + bob, 'wood', 3)
    c.rect(23, 25 + bob, 25, 26 + bob, 'gold', 5)
    # hinterer Arm
    thick_line(c, 16, 20 + bob, 14, 26 + bob, 3.6, 'skin', lo=1, hi=3)
    # Kopf
    ellipse(c, 24.5, 11 + bob, 6.8, 6.2, 'skin', lo=2, hi=5)
    c.rect(28, 10 + bob, 28, 11 + bob, 'coal', 1)
    hline(c, 27, 29, 9 + bob, 'dirt', 1)
    ellipse(c, 31.5, 12 + bob, 2.4, 2.1, 'skin', lo=3, hi=5)
    c.put_ramp(31, 12 + bob, 'fire', 3)
    # Bart (rotbraun): breite Flaeche, Scheitel, zwei Zoepfe mit Goldringen
    for y in range(12, 26):
        t = (y - 12) / 13.0
        half = 7.4 * (1 - t ** 1.8) + (0.6 if y > 20 else 0)
        for x in range(int(24.5 - half), int(24.5 + half) + 1):
            u = (x - (24.5 - half)) / (2 * half + 1)
            tone = quant(0.9 - 0.45 * u - 0.15 * t, 2, 5, x, y)
            c.put_ramp(x, y + bob, 'wood', tone)
    vline(c, 24, 14 + bob, 21 + bob, 'wood', 1)
    for x in (21, 27):
        for y in range(20, 27):
            c.put_ramp(x, y + bob, 'wood', 4 if (y + x) % 2 else 2)
            c.put_ramp(x + 1, y + bob, 'wood', 3)
        c.rect(x, 26 + bob, x + 1, 26 + bob, 'gold', 4)
    for (x, y) in ((19, 16), (20, 18), (28, 16), (29, 18), (22, 15), (26, 15)):
        c.put_ramp(x, y + bob, 'wood', 1)
    poly(c, [(20, 12 + bob), (32, 12 + bob), (33, 14 + bob), (28, 15 + bob), (21, 15 + bob)], 'wood', lo=3, hi=5)
    hline(c, 21, 31, 12 + bob, 'wood', 5)
    # Helm mit Hoernern
    def cap(x, y):
        return y <= 8 + bob
    ellipse(c, 24.5, 8 + bob, 7.8, 6.4, 'metal', lo=1, hi=5, clip=cap)
    hline(c, 17, 32, 8 + bob, 'gold', 3)
    hline(c, 17, 32, 9 + bob, 'metal', 1)
    c.rect(27, 8 + bob, 28, 11 + bob, 'metal', 3)
    for k, (x, y) in enumerate(((17, 6), (16, 5), (15, 4), (15, 3), (16, 2), (17, 2))):
        c.put_ramp(x, y + bob, 'bone', 5 if k < 3 else 4)
        c.put_ramp(x + 1, y + bob, 'bone', 3)
    for k, (x, y) in enumerate(((32, 6), (33, 5), (34, 4), (34, 3), (33, 2), (32, 2))):
        c.put_ramp(x, y + bob, 'bone', 4 if k < 3 else 3)
        c.put_ramp(x - 1, y + bob, 'bone', 2)
    c.put_ramp(24, 2 + bob, 'metal', 5)
    c.put_ramp(23, 3 + bob, 'metal', 5)
    # Arm mit Hammer (vorn)
    hand = [(36, 22), (37, 20), (36, 18)][f % 3] if anim == 'hammer' else (36, 21)
    thick_line(c, 32, 19 + bob, hand[0], hand[1] + bob, 3.4, 'skin', lo=2, hi=5)
    thick_line(c, hand[0], hand[1] + bob, hand[0] + 1, hand[1] - 9 + bob, 1.8, 'wood', lo=2, hi=4)
    round_rect(c, hand[0] - 3, hand[1] - 14 + bob, hand[0] + 4, hand[1] - 8 + bob, 'metal', lo=0, hi=5, radius=1)
    hline(c, hand[0] - 2, hand[0] + 3, hand[1] - 14 + bob, 'metal', 5)
    pts(c, [(hand[0] + 5, hand[1] - 16 + bob), (hand[0] + 4, hand[1] - 17 + bob), (hand[0] + 6, hand[1] - 13 + bob)], 'gold', 5)
    c.outline()
    return c


# =========================================================================== UZ-04 Eintopf-Koch (40 x 38)


def spr_stew_cook(anim='idle', f=0):
    c = Canvas(40, 38)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    # Dampfwolken um die Kochmuetze (hinter der Figur)
    for (cx, cy, r) in ((7, 9, 3.2), (4, 4, 2.4), (30, 8, 3.0), (33, 3, 2.2)):
        ellipse(c, cx, cy + bob, r, r, 'bone', lo=2, hi=4, ambient=0.4)
    for (x, y) in ((9, 3), (10, 2), (27, 2), (26, 1), (5, 0), (31, 0)):
        c.put_ramp(x, y, 'bone', 3)
    # Beine, Schuhe
    for x0 in (13, 20):
        c.rect(x0, 31, x0 + 3, 34, 'stone', 2)
        round_rect(c, x0 - 1, 34, x0 + 6, 37, 'wood', lo=0, hi=3, radius=1)
        c.put_ramp(x0 + 3, 34, 'wood', 4)
    # grosser runder Bauch (Kochjacke) mit Schuerze
    ellipse(c, 18, 25 + bob, 12.4, 10.0, 'bone', lo=1, hi=5, ambient=0.3, flatness=0.15)
    poly(c, [(12, 23 + bob), (26, 23 + bob), (27, 33 + bob), (10, 33 + bob)], 'bone', lo=3, hi=5)
    for y in range(23, 33):
        c.put_ramp(24 + (y % 2), y + bob, 'bone', 2)
    hline(c, 11, 26, 31 + bob, 'bone', 2)
    hline(c, 11, 26, 33 + bob, 'bone', 2)
    # Flecken auf der Schuerze (Eintopf!)
    pts(c, [(14, 28 + bob), (15, 28 + bob), (21, 30 + bob), (22, 30 + bob), (17, 26 + bob)], 'wood', 3)
    pts(c, [(21, 26 + bob), (22, 26 + bob)], 'fire', 3)
    # Knoepfe + Schuerzenband
    for y in (21, 24):
        c.put_ramp(18, y + bob, 'coal', 2)
    hline(c, 11, 26, 22 + bob, 'fire', 3)
    hline(c, 11, 26, 23 + bob, 'fire', 2)
    c.put_ramp(18, 22 + bob, 'gold', 5)
    # Halstuch in Teamfarbe
    poly(c, [(13, 16 + bob), (24, 16 + bob), (19, 20 + bob)], 'teamA', lo=1, hi=4)
    # hinterer Arm
    thick_line(c, 8, 19 + bob, 6, 26 + bob, 4.4, 'bone', lo=2, hi=5)
    ellipse(c, 6, 27 + bob, 2.4, 2.4, 'skin', lo=2, hi=5)
    # Kopf: rund, rote Wangen, schlichtes Gesicht
    ellipse(c, 18, 13 + bob, 6.2, 5.8, 'skin', lo=2, hi=5)
    c.rect(22, 11 + bob, 22, 12 + bob, 'coal', 1)
    pts(c, [(24, 13 + bob), (24, 14 + bob)], 'skin', 3)
    pts(c, [(21, 15 + bob), (22, 15 + bob)], 'fire', 3)             # Wange
    hline(c, 20, 24, 17 + bob, 'skin', 1)
    # Kochmuetze: hoher Wulst aus Puffs
    c.rect(13, 8 + bob, 23, 9 + bob, 'bone', 4)
    hline(c, 13, 23, 9 + bob, 'bone', 3)
    for (bx, by, rx, ry) in ((13, 4, 4.4, 4.0), (23, 4, 4.0, 3.8), (18, 2, 5.4, 4.2)):
        ellipse(c, bx, by + bob, rx, ry, 'bone', lo=3, hi=5, ambient=0.35)
    hline(c, 13, 23, 7 + bob, 'bone', 3)
    c.put_ramp(16, 3 + bob, 'bone', 2)
    c.put_ramp(21, 4 + bob, 'bone', 2)
    # vorderer Arm mit riesiger Kelle (Stiel hoch, Schoepfloeffel nach oben)
    thick_line(c, 25, 19 + bob, 29, 23 + bob, 4.4, 'bone', lo=2, hi=5)
    ellipse(c, 30, 23 + bob, 2.6, 2.6, 'skin', lo=2, hi=5)
    thick_line(c, 29, 24 + bob, 35, 8 + bob, 1.8, 'wood', lo=1, hi=4)
    ellipse(c, 36, 6 + bob, 4.4, 4.0, 'metal', lo=0, hi=4)
    ellipse(c, 36, 6.5 + bob, 3.2, 2.8, 'wood', lo=2, hi=4, ambient=0.3)
    pts(c, [(34, 5 + bob), (35, 5 + bob), (37, 7 + bob)], 'fire', 3)
    pts(c, [(35, 6 + bob)], 'gold', 4)
    c.outline()
    return c


# =========================================================================== UZ-05 Loeschmeister-Kobold (38 x 30)


def spr_fire_marshal_kobold(anim='idle', f=0):
    c = Canvas(46, 34)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    # Schwanz (Ringel)
    for k, (x, y) in enumerate(((9, 26), (8, 27), (6, 27), (5, 26), (4, 25), (4, 23), (5, 22), (6, 22))):
        c.put_ramp(x, y + bob, 'ice', 3 if k % 2 else 2)
        c.put_ramp(x, y + 1 + bob, 'ice', 1)
    # Beine + Stiefel
    for x0 in (11, 19):
        c.rect(x0 + 1, 28, x0 + 3, 30, 'ice', 2)
        round_rect(c, x0, 30, x0 + 6, 33, 'coal', lo=1, hi=4, radius=1)
        c.put_ramp(x0 + 3, 30, 'coal', 5)
    # Mantel (Feuerwehr-Gelb) mit Reflexstreifen
    round_rect(c, 9, 17 + bob, 25, 30 + bob, 'gold', lo=1, hi=4, radius=3)
    dither_box(c, 21, 19 + bob, 24, 29 + bob, 'gold', 1, 2)
    hline(c, 9, 25, 23 + bob, 'bone', 5)
    hline(c, 9, 25, 27 + bob, 'bone', 4)
    for y in (19, 20):
        c.put_ramp(17, y + bob, 'coal', 2)
    # grosses Ohr nach hinten (hinter dem Kopf)
    poly(c, [(13, 7 + bob), (1, 4 + bob), (13, 15 + bob)], 'ice', lo=1, hi=4)
    pts(c, [(4, 5 + bob), (5, 6 + bob), (6, 7 + bob), (7, 9 + bob), (8, 10 + bob)], 'skin', 3)
    # Kopf + Schnauze
    ellipse(c, 18, 11 + bob, 6.8, 6.0, 'ice', lo=2, hi=5)
    ellipse(c, 25, 13.5 + bob, 4.2, 3.0, 'ice', lo=3, hi=5)
    c.rect(28, 12 + bob, 29, 13 + bob, 'coal', 0)
    hline(c, 22, 27, 16 + bob, 'ice', 1)
    c.rect(22, 9 + bob, 23, 11 + bob, 'coal', 1)
    c.put_ramp(22, 9 + bob, 'bone', 5)
    # Feuerwehrhelm: Kuppel mit hohem Kamm, Abzeichen vorn, langer Nackenschutz
    def cap(x, y):
        return y <= 7 + bob
    ellipse(c, 18, 6 + bob, 8.0, 6.0, 'teamA', lo=1, hi=5, clip=cap)
    poly(c, [(11, 6 + bob), (17, 6 + bob), (17, 8 + bob), (7, 17 + bob), (3, 16 + bob)], 'teamA', lo=1, hi=4)
    hline(c, 10, 28, 7 + bob, 'teamA', 0)
    hline(c, 11, 28, 6 + bob, 'teamA', 2)
    hline(c, 11, 25, 5 + bob, 'gold', 3)
    pts(c, [(26, 6 + bob), (27, 6 + bob), (28, 6 + bob)], 'gold', 4)
    for x in range(12, 25):
        yy = int(round(6 - 6.4 * math.sqrt(max(0.0, 1 - ((x - 18) / 8.2) ** 2)))) + bob
        c.put_ramp(x, yy, 'gold', 4)
        c.put_ramp(x, yy + 1, 'teamA', 3)
    poly(c, [(20, 2 + bob), (25, 2 + bob), (25, 6 + bob), (22.5, 8 + bob), (20, 6 + bob)], 'gold', lo=2, hi=5)
    pts(c, [(22, 4 + bob), (23, 4 + bob), (22, 5 + bob)], 'fire', 3)
    # Giesskanne: Bauch, Baender, Henkel, langer Ausguss, Brause
    round_rect(c, 22, 22 + bob, 35, 32 + bob, 'metal', lo=1, hi=4, radius=2)
    hline(c, 23, 34, 22 + bob, 'metal', 5)
    hline(c, 22, 35, 25 + bob, 'gold', 3)
    hline(c, 22, 35, 29 + bob, 'gold', 2)
    for (x, y) in ((24, 21), (24, 20), (25, 19), (26, 18), (27, 18), (28, 18), (29, 19), (29, 20), (29, 21)):
        c.put_ramp(x, y + bob, 'metal', 4 if x < 27 else 2)
    thick_line(c, 34, 27 + bob, 40, 16 + bob, 2.8, 'metal', lo=1, hi=5)
    poly(c, [(37, 11 + bob), (44, 13 + bob), (43, 19 + bob), (37, 17 + bob)], 'gold', lo=2, hi=5)
    pts(c, [(39, 13 + bob), (41, 14 + bob), (40, 16 + bob), (42, 17 + bob)], 'coal', 1)
    # Arm zur Kanne
    thick_line(c, 18, 20 + bob, 24, 24 + bob, 3.2, 'ice', lo=2, hi=5)
    c.outline()
    return c


# =========================================================================== UZ-06 Fanfaren-Barde (38 x 36)


def spr_fanfare_bard(anim='idle', f=0):
    c = Canvas(42, 38)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    # Dudelsack-Pfeifen: drei Bordune mit Messingtrichtern ragen hinter der Schulter hoch
    for (x0, y0, x1, y1) in ((12, 22, 6, 8), (14, 21, 11, 4), (16, 20, 17, 8)):
        thick_line(c, x0, y0 + bob, x1, y1 + bob, 1.8, 'wood', lo=1, hi=4)
        ellipse(c, x1, y1 + bob, 2.2, 1.8, 'gold', lo=2, hi=5)
        c.put_ramp(x1, y1 + bob, 'coal', 1)
    # Beine + Schnabelschuhe
    for x0 in (15, 22):
        c.rect(x0, 30, x0 + 2, 34, 'leaf', 3)
        c.rect(x0, 30, x0, 34, 'leaf', 4)
        poly(c, [(x0 - 1, 34), (x0 + 4, 34), (x0 + 8, 35), (x0 + 9, 33), (x0 + 10, 37), (x0 - 1, 37)], 'wood', lo=0, hi=3)
    # Tunika (Violett) mit Goldsaum und Guertel
    poly(c, [(12, 18 + bob), (27, 18 + bob), (29, 31 + bob), (10, 31 + bob)], 'purple', lo=1, hi=4)
    dither_box(c, 24, 20 + bob, 28, 30 + bob, 'purple', 1, 2)
    for x in range(10, 30, 2):
        c.put_ramp(x, 31 + bob, 'gold', 4)
        c.put_ramp(x + 1, 31 + bob, 'gold', 2)
    hline(c, 12, 27, 27 + bob, 'wood', 2)
    # Sack aus Schweineblase: rosa, Ohren, Ruessel, Ringelschwanz, Hufe
    for (hx, hy) in ((17, 30), (20, 31), (25, 31), (28, 30)):
        c.rect(hx, hy + bob, hx + 1, hy + 2 + bob, 'cloth', 3)
        c.put_ramp(hx, hy + 2 + bob, 'coal', 1)
    ellipse(c, 23, 25 + bob, 10.0, 6.4, 'cloth', lo=2, hi=5, ambient=0.4, flatness=0.15)
    poly(c, [(15, 21 + bob), (19, 18 + bob), (19, 22 + bob)], 'cloth', lo=1, hi=4)
    poly(c, [(25, 18 + bob), (29, 19 + bob), (27, 23 + bob)], 'cloth', lo=1, hi=4)
    ellipse(c, 33.5, 26 + bob, 3.0, 2.6, 'cloth', lo=3, hi=5, ambient=0.4)
    pts(c, [(33, 26 + bob), (35, 26 + bob)], 'cloth', 0)
    pts(c, [(13, 27 + bob), (12, 26 + bob), (11, 25 + bob), (11, 24 + bob), (12, 23 + bob), (13, 23 + bob), (13, 24 + bob)], 'cloth', 4)
    c.put_ramp(22, 23 + bob, 'cloth', 0)
    # Anblasrohr bis zum Mund
    thick_line(c, 26, 20 + bob, 27, 14 + bob, 1.6, 'wood', lo=2, hi=4)
    # Arm, das den Sack drueckt
    thick_line(c, 14, 22 + bob, 22, 26 + bob, 3.4, 'purple', lo=1, hi=4)
    ellipse(c, 23, 26 + bob, 2.0, 2.0, 'skin', lo=2, hi=5)
    # Kopf mit dicken Pausbacken
    ellipse(c, 22, 12 + bob, 5.8, 5.4, 'skin', lo=2, hi=5)
    ellipse(c, 27, 15 + bob, 3.4, 3.2, 'skin', lo=3, hi=5)
    hline(c, 23, 25, 11 + bob, 'coal', 1)
    pts(c, [(27, 16 + bob), (28, 16 + bob)], 'fire', 3)
    pts(c, [(28, 14 + bob)], 'skin', 5)
    # Spitzhut mit Feder
    poly(c, [(16, 9 + bob), (29, 9 + bob), (26, 2 + bob), (19, 2 + bob)], 'leaf', lo=1, hi=4)
    hline(c, 15, 30, 9 + bob, 'leaf', 1)
    hline(c, 15, 30, 8 + bob, 'leaf', 3)
    hline(c, 16, 28, 7 + bob, 'gold', 3)
    for k in range(10):
        x = 26 + (k // 2) - (1 if k > 7 else 0)
        y = 3 + bob - k
        if y >= 0:
            c.put_ramp(x, y, 'teamA', 4 if k % 2 else 3)
            c.put_ramp(x + 1, y, 'teamA', 2)
    c.outline()
    return c

# =========================================================================== UZ-07 Professor Schnurrbart (38 x 38)


def spr_professor_moustache(anim='idle', f=0):
    c = Canvas(38, 38)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    # Buch unter dem Arm (hinten)
    poly(c, [(2, 22 + bob), (11, 20 + bob), (12, 29 + bob), (3, 31 + bob)], 'leaf', lo=1, hi=4)
    hline(c, 3, 11, 22 + bob, 'bone', 5)
    c.rect(3, 29 + bob, 11, 30 + bob, 'bone', 4)
    pts(c, [(6, 25 + bob), (7, 25 + bob), (8, 26 + bob)], 'gold', 4)
    # Talar (violett) bis zum Boden, mit Goldborte
    poly(c, [(11, 17 + bob), (25, 17 + bob), (29, 35), (7, 35)], 'purple', lo=1, hi=4)
    dither_box(c, 22, 19 + bob, 28, 34, 'purple', 1, 2)
    vline(c, 18, 19 + bob, 34, 'gold', 3)
    vline(c, 19, 19 + bob, 34, 'gold', 4)
    for x in range(7, 30, 2):
        c.put_ramp(x, 35, 'gold', 3)
        c.put_ramp(x, 34, 'purple', 0)
    c.put_ramp(18, 25 + bob, 'gold', 5)
    c.put_ramp(18, 29 + bob, 'gold', 5)
    # Schuhspitzen
    for x0 in (11, 19):
        c.rect(x0, 36, x0 + 5, 37, 'coal', 2)
        c.put_ramp(x0 + 5, 36, 'coal', 4)
    # hinterer Arm am Buch
    thick_line(c, 12, 19 + bob, 9, 26 + bob, 3.6, 'purple', lo=0, hi=3)
    ellipse(c, 8, 27 + bob, 2.0, 2.0, 'skin', lo=2, hi=5)
    # Kopf: Glatze, wilde Haarbueschel
    ellipse(c, 18, 11 + bob, 6.4, 6.0, 'skin', lo=2, hi=5)
    for (bx, by, rx, ry) in ((10.5, 8, 3.4, 3.0), (11.5, 13, 2.8, 2.6), (25.5, 7, 2.6, 2.4)):
        ellipse(c, bx, by + bob, rx, ry, 'fur', lo=2, hi=5, ambient=0.4)
    pts(c, [(8, 5 + bob), (9, 4 + bob), (12, 4 + bob), (11, 10 + bob), (24, 3 + bob)], 'fur', 5)
    # Eulenbrille: zwei grosse runde Glaeser mit Goldrand
    for (gx, gy) in ((16, 10), (22, 10)):
        ellipse(c, gx, gy + bob, 3.4, 3.4, 'gold', lo=2, hi=5)
        ellipse(c, gx + 0.3, gy + 0.2 + bob, 2.3, 2.3, 'bone', lo=4, hi=5, ambient=0.7)
        c.put_ramp(gx + 1, gy + bob, 'coal', 0)
        c.put_ramp(gx + 1, gy + 1 + bob, 'coal', 0)
    c.put_ramp(19, 10 + bob, 'gold', 3)
    # riesiger Schnurrbart (Handlebar), breiter als der Kopf
    poly(c, [(19, 14 + bob), (30, 13 + bob), (33, 10 + bob), (32, 15 + bob), (27, 17 + bob), (19, 17 + bob)], 'fur', lo=2, hi=5)
    poly(c, [(19, 14 + bob), (8, 13 + bob), (6, 11 + bob), (7, 16 + bob), (11, 18 + bob), (19, 17 + bob)], 'fur', lo=1, hi=4)
    pts(c, [(33, 9 + bob), (33, 8 + bob), (32, 8 + bob), (6, 10 + bob), (6, 9 + bob), (7, 9 + bob)], 'fur', 4)
    for (x, y) in ((22, 15), (25, 16), (28, 14), (15, 15), (12, 16), (10, 14)):
        c.put_ramp(x, y + bob, 'fur', 1)
    hline(c, 20, 31, 14 + bob, 'fur', 5)
    # Fliege
    poly(c, [(18, 20 + bob), (14, 18 + bob), (14, 22 + bob)], 'fire', lo=2, hi=4)
    poly(c, [(18, 20 + bob), (22, 18 + bob), (22, 22 + bob)], 'fire', lo=1, hi=3)
    c.put_ramp(18, 20 + bob, 'fire', 5)
    # Arm mit Zeigestock (vorn, schraeg nach oben)
    thick_line(c, 24, 20 + bob, 28, 22 + bob, 3.6, 'purple', lo=1, hi=4)
    ellipse(c, 29, 22 + bob, 2.0, 2.0, 'skin', lo=2, hi=5)
    thick_line(c, 29, 22 + bob, 37, 12 + bob, 1.2, 'wood', lo=2, hi=5)
    c.put_ramp(37, 11 + bob, 'bone', 5)
    c.outline()
    return c
