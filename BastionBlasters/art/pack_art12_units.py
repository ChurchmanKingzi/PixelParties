"""pack_art12: kleine Figuren fuer die Chaos-Bauten (Gnom, Troll, Frosch, Schnecke, Kuckuck-Boxer). Alle blicken nach rechts."""
from __future__ import annotations

import math
import random

from pixl import *
from pack_art12_kit import hline, vline, vflip


# =========================================================================== Gnom (S/M)


def spr_gnome(anim='idle', f=0, hat='teamA', coat='ice') -> Canvas:
    """Gnom mit spitzem Hut, weissem Bart, Knubbelnase. anim: idle | jump | sweat | cheer | point"""
    c = Canvas(24, 28)
    jump = anim in ('jump', 'cheer')
    dy = 0
    # Beine
    if anim == 'jump':
        thick_line(c, 10, 21, 7, 24, 3, 'wood', lo=1, hi=3)
        thick_line(c, 14, 21, 17, 23, 3, 'wood', lo=2, hi=4)
        c.rect(5, 24, 8, 25, 'wood', 2)
        c.rect(16, 23, 19, 24, 'wood', 3)
    else:
        thick_line(c, 10, 21, 10, 25, 3, 'wood', lo=1, hi=3)
        thick_line(c, 15, 21, 15, 25, 3, 'wood', lo=2, hi=4)
        c.rect(8, 26, 12, 27, 'wood', 2)
        c.rect(8, 26, 12, 26, 'wood', 3)
        c.rect(14, 26, 18, 27, 'wood', 3)
        c.rect(14, 26, 18, 26, 'wood', 4)
    # Kittel
    round_rect(c, 7, 14, 18, 23, coat, lo=1, hi=4, radius=2)
    hline(c, 7, 18, 20, 'gold', 2)
    c.put_ramp(12, 20, 'gold', 5)
    c.put_ramp(13, 20, 'gold', 5)
    # Arme (hinter dem Bart)
    if anim in ('jump', 'cheer'):
        thick_line(c, 8, 16, 4, 9, 2.6, coat, lo=1, hi=3)
        thick_line(c, 17, 16, 21, 9, 2.6, coat, lo=2, hi=4)
        ellipse(c, 4, 8, 1.8, 1.8, 'skin', lo=3, hi=5)
        ellipse(c, 21, 8, 1.8, 1.8, 'skin', lo=3, hi=5)
    elif anim == 'sweat':
        thick_line(c, 8, 16, 11, 20, 2.6, coat, lo=1, hi=3)
        thick_line(c, 17, 16, 15, 20, 2.6, coat, lo=2, hi=4)
    elif anim == 'point':
        thick_line(c, 8, 16, 7, 22, 2.6, coat, lo=1, hi=3)
        thick_line(c, 17, 16, 23, 14, 2.6, coat, lo=2, hi=4)
        ellipse(c, 23, 14, 1.6, 1.6, 'skin', lo=3, hi=5)
    else:
        thick_line(c, 8, 16, 6, 21, 2.6, coat, lo=1, hi=3)
        thick_line(c, 17, 16, 19, 21, 2.6, coat, lo=2, hi=4)
        c.put_ramp(6, 22, 'skin', 3)
        c.put_ramp(19, 22, 'skin', 4)
    # Bart
    poly(c, [(8, 12), (17, 12), (16, 19), (12.5, 23), (9, 18)], 'bone', lo=3, hi=5)
    for (x, y) in ((11, 17), (13, 19), (14, 16), (10, 20)):
        c.put_ramp(x, y, 'bone', 2)
    if anim == 'sweat':
        c.rect(11, 18, 15, 19, 'skin', 3)        # gefaltete Haende vor dem Bart
        c.rect(11, 18, 15, 18, 'skin', 4)
    # Kopf + Knubbelnase
    ellipse(c, 12.5, 10, 5.0, 4.4, 'skin', lo=2, hi=5)
    ellipse(c, 17.5, 11.4, 2.2, 1.9, 'skin', lo=3, hi=5)
    c.put_ramp(17, 11, 'fire', 4)
    c.put_ramp(14, 8, 'coal', 1)
    if anim in ('jump', 'cheer'):
        c.rect(14, 13, 16, 13, 'coal', 1)         # lacht
    elif anim == 'sweat':
        c.put_ramp(14, 13, 'coal', 1)
        c.put_ramp(15, 13, 'coal', 2)
        c.put_ramp(14, 9, 'coal', 1)
        c.put_ramp(15, 8, 'bone', 4)
    # Hut: knickt nach rechts
    poly(c, [(6, 8), (19, 8), (17, 4), (15, 1), (19, 0), (13, 0), (9, 4)], hat, lo=1, hi=4)
    hline(c, 6, 19, 7, hat, 2)
    hline(c, 7, 18, 6, hat, 4)
    c.put_ramp(11, 6, 'gold', 5)
    c.put_ramp(12, 6, 'gold', 4)
    c.put_ramp(19, 0, 'gold', 5)
    c.outline()
    return c


# =========================================================================== Troll am Mikrofon (L)


def spr_mic_troll(f=0) -> Canvas:
    """Troll im Glitzerjackett, Haartolle, Sonnenbrille, Mikrofon; eine Hand zeigt zur Discokugel (36 x 46)"""
    c = Canvas(36, 46)
    sway = [0, 1][f % 2]
    # Stiefel + Hosen
    thick_line(c, 12, 33, 11, 42, 5.0, 'coal', lo=0, hi=2)
    thick_line(c, 22, 33, 23, 42, 5.0, 'coal', lo=1, hi=3)
    for y in (34, 36, 38):
        c.put_ramp(10, y, 'gold', 3)
        c.put_ramp(24, y, 'gold', 4)
    c.rect(7, 42, 15, 44, 'coal', 2)
    c.rect(7, 42, 15, 42, 'coal', 4)
    c.rect(19, 42, 28, 44, 'coal', 2)
    c.rect(19, 42, 28, 42, 'coal', 4)
    c.rect(7, 44, 15, 44, 'coal', 0)
    c.rect(19, 44, 28, 44, 'coal', 0)
    # hinterer (erhobener) Arm
    thick_line(c, 8, 21, 4, 11, 5.0, 'gold', lo=1, hi=4)
    ellipse(c, 4, 9, 3.2, 3.0, 'purple', lo=2, hi=5)
    for (x, y) in ((3, 5), (4, 5), (6, 7)):
        c.put_ramp(x, y, 'purple', 3)           # Finger
    c.put_ramp(3, 6, 'purple', 4)
    # Rumpf: Glitzerjackett
    ellipse(c, 17.5, 26, 11.5, 10.5, 'gold', lo=1, hi=5, ambient=0.18)
    # Revers/Schluss
    for y in range(18, 36):
        c.put_ramp(21, y, 'gold', 1)
    rng = random.Random(5)
    for _ in range(26):
        x, y = rng.randint(8, 27), rng.randint(17, 35)
        if c.alpha(x, y):
            c.put_ramp(x, y, 'bone', 5)
    for (x, y) in ((13, 22), (19, 27), (15, 31), (25, 24)):
        c.put_ramp(x, y, 'teamA', 4)
    # Gurt mit Schnalle
    hline(c, 8, 27, 33, 'coal', 1)
    c.rect(16, 32, 20, 34, 'gold', 5)
    c.rect(17, 33, 19, 33, 'coal', 2)
    # vorderer Arm mit Mikro (vor dem Mund)
    thick_line(c, 26, 25, 31, 24, 4.4, 'gold', lo=2, hi=5)
    ellipse(c, 32.0, 23.5, 2.6, 2.6, 'purple', lo=3, hi=5)
    thick_line(c, 31, 22, 29.5, 18, 1.6, 'metal', lo=1, hi=3)
    ellipse(c, 29.0, 16.8, 2.5, 2.5, 'metal', lo=2, hi=5)
    c.put_ramp(28, 15, 'bone', 5)
    c.put_ramp(29, 15, 'bone', 4)
    for x in range(27, 31):
        c.put_ramp(x, 17, 'metal', 1)
    # Kopf
    ellipse(c, 18, 12, 8.5, 7.5, 'purple', lo=1, hi=5, ambient=0.18)
    # grosse Nase
    ellipse(c, 25.5, 13, 3.4, 3.0, 'purple', lo=2, hi=5)
    c.put_ramp(24, 12, 'purple', 5)
    c.put_ramp(27, 14, 'purple', 1)
    # offener Mund + Hauer
    c.rect(19, 16, 24, 18, 'coal', 0)
    c.rect(20, 17, 23, 17, 'fire', 2)
    c.put_ramp(19, 15, 'bone', 5)
    c.put_ramp(24, 15, 'bone', 5)
    c.put_ramp(19, 16, 'bone', 4)
    c.put_ramp(24, 16, 'bone', 4)
    # Sonnenbrille
    c.rect(15, 9, 25, 10, 'coal', 0)
    c.rect(17, 9, 19, 11, 'coal', 0)
    c.rect(22, 9, 24, 11, 'coal', 0)
    c.put_ramp(17, 9, 'ice', 3)
    c.put_ramp(22, 9, 'ice', 3)
    # Tolle (Elvis-Haar)
    ellipse(c, 17, 5, 9.2, 4.6, 'coal', lo=0, hi=3)
    poly(c, [(13, 5), (20, 0), (30, 1), (28, 5), (22, 7)], 'coal', lo=0, hi=3)
    c.put_ramp(20, 1, 'coal', 5)
    c.put_ramp(21, 1, 'coal', 4)
    c.put_ramp(24, 2, 'coal', 4)
    c.put_ramp(15, 3, 'coal', 4)
    c.outline()
    return c


# =========================================================================== Frosch (S)


def spr_frog() -> Canvas:
    c = Canvas(14, 11)
    ellipse(c, 7, 7, 5.6, 3.4, 'leaf', lo=1, hi=5)
    ellipse(c, 9.5, 6, 3.4, 2.8, 'leaf', lo=2, hi=5)
    # Beine
    thick_line(c, 3, 9, 6, 9, 2.2, 'leaf', lo=1, hi=3)
    c.rect(2, 9, 5, 10, 'leaf', 2)
    c.rect(9, 9, 12, 10, 'leaf', 3)
    # Augenwuelste
    ellipse(c, 8.5, 3.0, 1.9, 1.9, 'leaf', lo=3, hi=5)
    ellipse(c, 11.5, 3.2, 1.8, 1.8, 'leaf', lo=3, hi=5)
    c.put_ramp(9, 3, 'coal', 1)
    c.put_ramp(12, 3, 'coal', 1)
    # Mund + Bauch
    hline(c, 10, 13, 7, 'coal', 1)
    hline(c, 5, 10, 9, 'bone', 3)
    c.outline()
    return c


# =========================================================================== Schnecke (S)


def spr_snail() -> Canvas:
    c = Canvas(18, 13)
    # Koerper
    for x in range(1, 17):
        c.put_ramp(x, 10, 'skin', 3 if x > 4 else 2)
        c.put_ramp(x, 11, 'skin', 2)
        if x > 10:
            c.put_ramp(x, 9, 'skin', 4)
    ellipse(c, 14.5, 8.0, 2.6, 2.6, 'skin', lo=2, hi=5)
    c.put_ramp(15, 7, 'coal', 1)
    # Fuehler
    c.line(14, 6, 13, 3, 'skin', 3)
    c.line(16, 6, 17, 3, 'skin', 4)
    c.put_ramp(13, 2, 'coal', 1)
    c.put_ramp(17, 2, 'coal', 1)
    # Haus
    ellipse(c, 7, 6, 6.2, 5.6, 'gold', lo=1, hi=5, ambient=0.15)
    for (x, y) in ((7, 6), (8, 6), (8, 5), (7, 4), (5, 4), (4, 6), (5, 8), (7, 9), (9, 8)):
        c.put_ramp(x, y, 'gold', 1)
    c.put_ramp(4, 3, 'gold', 5)
    c.put_ramp(5, 2, 'gold', 5)
    c.outline()
    return c


# =========================================================================== Kuckuck mit Boxhandschuh (in der Uhr)


def spr_cuckoo(punch=True) -> Canvas:
    """Kuckuck-Boxer, schaut nach rechts; steht aufrecht, Fluegel mit rotem Boxhandschuh weit vorgestreckt (34 x 19)"""
    c = Canvas(34, 19)
    # Schwanzfedern
    poly(c, [(2, 18), (5, 10), (10, 12), (8, 18)], 'metal', lo=1, hi=3)
    # Koerper (aufrecht, graue Brust, dunklerer Ruecken)
    ellipse(c, 11, 11.5, 6.4, 7.0, 'fur', lo=2, hi=5, ambient=0.2)
    ellipse(c, 8, 12, 4.0, 5.8, 'metal', lo=1, hi=3, ambient=0.3)
    for k in range(4):
        c.put_ramp(11, 11 + k * 2, 'fur', 3)       # Brustband
        c.put_ramp(13, 12 + k * 2, 'fur', 3)
    # Kopf mit Schopf
    ellipse(c, 16, 5.5, 4.4, 4.0, 'fur', lo=2, hi=5)
    poly(c, [(13, 3), (15, 0), (17, 3)], 'metal', lo=1, hi=3)
    # Schnabel (gross, gold)
    poly(c, [(19, 3.5), (27, 6), (19, 8.5)], 'gold', lo=2, hi=5)
    hline(c, 20, 25, 6, 'gold', 1)
    # Auge mit Weiss
    c.rect(16, 4, 17, 5, 'bone', 5)
    c.put_ramp(17, 5, 'coal', 0)
    # zorniger Strich ueber dem Auge
    c.line(15, 3, 18, 4, 'coal', 1)
    if punch:
        thick_line(c, 14, 11, 24, 12, 2.4, 'fur', lo=2, hi=4)
        ellipse(c, 27.5, 12, 4.4, 4.0, 'teamA', lo=1, hi=5)
        c.put_ramp(25, 10, 'teamA', 5)
        c.put_ramp(26, 9, 'teamA', 5)
        hline(c, 22, 23, 14, 'bone', 4)
        c.put_ramp(24, 15, 'bone', 3)
    else:
        thick_line(c, 14, 11, 16, 16, 2.4, 'fur', lo=2, hi=4)
    c.outline()
    return c
