"""pack_art4 - Verteidiger-Sprites Teil B: UV-07 Wurzel-Ent, UV-08 Leere Ruestung, UV-09 Dreikoepfiger Pudel,
UV-10 Gletscher-Greis, UV-11 Salamander-Waechter. Alle Figuren blicken nach rechts."""
from __future__ import annotations

import math
import random

from pixl import *
from pack_art4_a import _ring, _loop, _crack


# =========================================================================== UV-07 Wurzel-Ent


def _twig(c, pts, w, ramp='wood', lo=1, hi=4):
    for (a, b) in zip(pts[:-1], pts[1:]):
        thick_line(c, a[0], a[1], b[0], b[1], w, ramp, lo=lo, hi=hi)


def spr_root_ent(anim='idle', f=0):
    """Alter Baum auf Wurzelfuessen: Moosbart, Astarme, Laubkrone, Vogelnest mit Vogel"""
    c = Canvas(64, 66)
    sway = [0, 1][f % 2] if anim == 'idle' else 0
    rnd = random.Random(21)
    # Wurzelfuesse
    for (x1, y1, w) in ((9, 63, 5.0), (20, 65, 5.0), (38, 65, 5.4), (52, 62, 4.6)):
        _twig(c, [(30, 54), ((30 + x1) // 2, 60), (x1, y1)], w, lo=1, hi=4)
    # linker Arm (hinten): haengender Ast mit Wurzelhand
    _twig(c, [(19, 30), (11, 37), (9, 49)], 6.0, lo=0, hi=3)
    for (x, y) in ((6, 55), (9, 56), (12, 55)):
        thick_line(c, 9, 50, x, y, 2.4, 'wood', lo=0, hi=3)
    # Stamm
    for y in range(20, 60):
        t = (y - 20) / 40.0
        half = 10.5 + 3.2 * math.sin(t * math.pi * 0.9) + (3.0 if y > 52 else 0)
        cxm = 29.5
        for x in range(int(cxm - half), int(cxm + half) + 1):
            u = (x - (cxm - half)) / (2 * half + 1)
            L = 0.95 - 0.95 * u - 0.12 * t
            idx = quant(max(0.0, min(1.0, L)), 1, 4, x, y)
            if ((x + int(2.2 * math.sin(y / 6.0))) % 5 == 0) and (y % 9) < 7:
                idx = max(0, idx - 1)
            c.put_ramp(x, y, 'wood', idx)
    # Astloecher
    for (kx, ky, r) in ((22, 46, 2.4), (36, 51, 2.0), (25, 56, 1.8)):
        ellipse(c, kx, ky, r, r * 1.2, 'wood', lo=0, hi=2)
    # rechter Arm (vorn): kraeftiger Ast nach rechts, Wurzelfinger
    _twig(c, [(40, 29), (49, 33), (55, 40)], 7.0, lo=1, hi=4)
    for (x, y) in ((60, 44), (61, 40), (58, 46)):
        thick_line(c, 55, 40, x, y, 2.4, 'wood', lo=1, hi=4)
    # Nest-Ast nach oben rechts
    _twig(c, [(39, 26), (46, 24), (52, 25)], 4.4, lo=1, hi=4)
    # Krone
    blobs = [(32, 12, 21, 12), (14, 17, 10, 9), (50, 15, 10, 9), (22, 6, 11, 7), (41, 6, 11, 7), (7, 22, 6, 6)]
    for (bx, by, rx, ry) in blobs:
        ellipse(c, bx, by, rx, ry, 'leaf', lo=1, hi=4, ambient=0.18)
    for (bx, by, rx, ry) in (blobs[3], blobs[0], blobs[1]):
        ellipse(c, bx - 3, by - 3, rx * 0.55, ry * 0.5, 'leaf', lo=3, hi=5, ambient=0.3)
    for _ in range(40):
        x, y = rnd.randint(4, 58), rnd.randint(1, 26)
        if c.alpha(x, y) and c.rid[y, x] == RAMP_ID['leaf']:
            c.put_ramp(x, y, 'leaf', 5 if rnd.random() < 0.5 else 1)
    # herabhaengendes Laub ueber der Stirn
    for x in range(18, 42, 3):
        c.put_ramp(x, 21, 'leaf', 2)
        c.put_ramp(x, 22, 'leaf', 1)
    # Gesicht: Augenhoehlen, Brauenast, Nasenknolle
    for (ex, lo_) in ((22, 0), (33, 1)):
        ellipse(c, ex, 28, 3.0, 3.4, 'coal', lo=0, hi=2, ambient=0.3)
        c.rect(ex + 1, 28, ex + 2, 29, 'gold', 4)
        c.put_ramp(ex + 1, 28, 'gold', 5)
    for x in range(18, 27):
        c.put_ramp(x, 24 + (x - 18) // 4, 'wood', 0)
        c.put_ramp(x, 23 + (x - 18) // 4, 'wood', 4)
    for x in range(30, 38):
        c.put_ramp(x, 25 - (x - 30) // 5, 'wood', 0)
        c.put_ramp(x, 24 - (x - 30) // 5, 'wood', 3)
    ellipse(c, 28.5, 33, 3.4, 3.6, 'wood', lo=2, hi=5)
    c.put_ramp(27, 35, 'wood', 0)
    c.put_ramp(30, 35, 'wood', 0)
    # Moosbart: zottelig, laeuft nach unten in Straehnen aus
    brnd = random.Random(8)
    strands = [(21 + k * 2 + brnd.randint(0, 1), brnd.randint(46, 54)) for k in range(0, 9)]
    for y in range(32, 56):
        t = (y - 32) / 22.0
        half = 10.0 - 4.5 * t
        for x in range(int(29 - half), int(29 + half) + 1):
            # unterer Teil nur in Straehnen
            in_strand = any(abs(x - sx) <= 1 and y <= ey_ for (sx, ey_) in strands)
            if y > 45 and not in_strand:
                continue
            if y > 38 and abs(x - 29) > half - 1 and (x * 7 + y * 3) % 5 == 0:
                continue
            u = (x - (29 - half)) / (2 * half + 1)
            L = 0.92 - 0.75 * u - 0.1 * t
            idx = quant(max(0.0, min(1.0, L)), 2, 5, x, y)
            if (x * 5 + y // 3) % 4 == 0:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'grass', idx)
    for (x, y) in ((24, 36), (30, 35), (27, 41), (33, 42), (25, 44), (29, 47), (22, 38)):
        c.put_ramp(x, y, 'grass', 5)
        c.put_ramp(x + 1, y, 'grass', 4)
    ellipse(c, 28.5, 33, 3.4, 3.2, 'wood', lo=2, hi=5)
    c.put_ramp(27, 34, 'wood', 0)
    c.put_ramp(30, 34, 'wood', 0)
    # Moos auf den Schultern
    for (x, y, i) in ((16, 24, 4), (17, 23, 3), (41, 25, 4), (42, 24, 3), (46, 31, 3), (47, 30, 4)):
        c.put_ramp(x, y, 'grass', i)
    # Vogelnest + Vogel auf dem Ast
    nx, ny = 52 + sway, 22
    ellipse(c, nx, ny, 7.0, 3.6, 'wood', lo=0, hi=3, clip=lambda x, y: y >= ny - 1)
    for k in range(7):
        c.put_ramp(nx - 6 + k * 2, ny + (k % 2), 'dirt', 4)
        c.put_ramp(nx - 5 + k * 2, ny + 1 + (k % 2), 'dirt', 3)
    ellipse(c, nx - 2, ny - 2, 2.2, 2.2, 'bone', lo=3, hi=5)
    ellipse(c, nx + 1.5, ny - 3.6, 3.6, 3.2, 'sky', lo=2, hi=5)
    c.put_ramp(nx + 4, ny - 4, 'gold', 4)
    c.put_ramp(nx + 5, ny - 4, 'gold', 3)
    c.put_ramp(nx + 2, ny - 5, 'coal', 1)
    c.put_ramp(nx + 1, ny - 1, 'fire', 4)
    c.put_ramp(nx + 2, ny - 1, 'fire', 3)
    c.outline()
    return c


# =========================================================================== UV-08 Leere Ruestung


def spr_empty_armor(anim='idle', f=0):
    """Hohle Plattenruestung mit Hellebarde: Luecken am Hals und an den Handgelenken, Licht im Visier, Federbusch + Wappenrock in Teamfarbe"""
    c = Canvas(54, 58)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    flick = [0, 1][f % 2]
    # Hellebarden-Schaft (hinter den Handschuhen)
    c.rect(43, 5, 44, 56, 'wood', 3)
    c.rect(43, 5, 43, 56, 'wood', 4)
    c.rect(44, 5, 44, 56, 'wood', 2)
    # Beine: Beinschienen mit Knieschutz (leicht schwebend)
    for (x0, x1, lo_, hi_) in ((10, 19, 0, 3), (25, 34, 1, 4)):
        round_rect(c, x0, 41, x1, 51, 'metal', lo=lo_, hi=min(5, hi_ + 1), radius=2)
        ellipse(c, (x0 + x1) / 2.0 + 0.5, 41, 5.0, 3.6, 'metal', lo=lo_ + 1, hi=5)
        c.rect(x0 + 1, 50, x1 - 1, 50, 'metal', 1)
        round_rect(c, x0 - 1, 52, x1 + 2, 57, 'metal', lo=lo_, hi=min(5, hi_ + 2), radius=2)
        c.put_ramp(x0 + 1, 53, 'metal', 5)
    # dunkle Leere zwischen Knie und Rock
    c.rect(11, 37, 33, 39, 'coal', 0)
    # Rumpf: Kuerass
    round_rect(c, 9, 17 + bob, 36, 35 + bob, 'metal', lo=0, hi=5, radius=5, ambient=0.2)
    for y in (24, 29):
        for x in range(10, 36):
            if c.alpha(x, y + bob):
                c.put_ramp(x, y + bob, 'metal', 1 if x % 2 else 2)
    for y in range(18, 35):
        c.put_ramp(22, y + bob, 'metal', 4)
        c.put_ramp(23, y + bob, 'metal', 1)
    for (x, y) in ((13, 19), (14, 19), (13, 20), (27, 21)):
        c.put_ramp(x, y + bob, 'metal', 5)
    # Rost + Delle
    for (x, y) in ((28, 26), (29, 26), (28, 27), (30, 28), (15, 31), (16, 31), (17, 32)):
        c.put_ramp(x, y + bob, 'dirt', 3 if (x + y) % 2 else 2)
    for (x, y) in ((31, 22), (32, 23), (31, 24)):
        c.put_ramp(x, y + bob, 'metal', 1)
    # Gurt + Schnalle
    c.rect(9, 33 + bob, 36, 35 + bob, 'wood', 2)
    c.rect(9, 33 + bob, 36, 33 + bob, 'wood', 3)
    c.rect(20, 32 + bob, 25, 36 + bob, 'gold', 4)
    c.rect(21, 33 + bob, 24, 35 + bob, 'gold', 2)
    c.put_ramp(21, 33 + bob, 'gold', 5)
    # Panzerrock (Schuerzen-Platten)
    for k, x0 in enumerate((10, 17, 24, 31)):
        round_rect(c, x0, 36 + bob, x0 + 6, 43 + bob, 'metal', lo=0, hi=4, radius=1)
        c.rect(x0 + 1, 37 + bob, x0 + 1, 41 + bob, 'metal', 5)
    # Wappenrock (Teamfarbe), unten ausgefranst
    for y in range(35, 49):
        for x in range(19, 27):
            if y > 44 and (x + y) % 3 == 0:
                continue
            if y > 47 and (x * 2 + y) % 4 == 0:
                continue
            L = 0.85 - 0.45 * (x - 19) / 8.0 - 0.08 * (y - 35) / 14.0
            c.put_ramp(x, y + bob, 'teamA', quant(max(0.0, min(1.0, L)), 1, 4, x, y))
    c.rect(22, 38 + bob, 22, 43 + bob, 'gold', 4)
    c.rect(20, 40 + bob, 24, 40 + bob, 'gold', 4)
    # Schulterstuecke mit Dornen
    for (px_, lo_, hi_, sp) in ((8, 1, 4, -1), (37, 2, 5, 1)):
        poly(c, [(px_ - 2, 18 + bob), (px_ + sp * 2, 9 + bob), (px_ + 3, 17 + bob)], 'metal', lo=2, hi=5)
        ellipse(c, px_, 21 + bob, 7.0, 6.0, 'metal', lo=lo_, hi=min(5, hi_ + 1))
        c.put_ramp(px_ - 2, 19 + bob, 'metal', 5)
        c.put_ramp(px_ - 1, 19 + bob, 'metal', 5)
        for k in range(3):
            c.put_ramp(px_ - 3 + k * 3, 24 + bob, 'metal', 0)
    # Arme: Oberarm, Unterarm, schwebende Handschuhe
    round_rect(c, 3, 26 + bob, 8, 34 + bob, 'metal', lo=0, hi=3, radius=2)
    ellipse(c, 5.5, 36 + bob, 3.4, 3.0, 'metal', lo=1, hi=4)      # Ellbogen
    round_rect(c, 3, 38 + bob, 8, 42 + bob, 'metal', lo=0, hi=3, radius=1)
    round_rect(c, 2, 45 + bob, 9, 51 + bob, 'metal', lo=1, hi=4, radius=2)   # Handschuh (schwebt)
    for x in (3, 5, 7):
        c.put_ramp(x, 50 + bob, 'metal', 0)
    round_rect(c, 36, 26 + bob, 42, 31 + bob, 'metal', lo=1, hi=4, radius=2)
    round_rect(c, 38, 32 + bob, 44, 37 + bob, 'metal', lo=1, hi=5, radius=2)
    round_rect(c, 40, 39 + bob, 47, 45 + bob, 'metal', lo=1, hi=5, radius=2)   # Handschuh greift den Schaft
    for x in (41, 43, 45):
        c.put_ramp(x, 44 + bob, 'metal', 0)
    # Hellebarde: Klinge, Spitze, Quaste
    poly(c, [(44, 11), (52, 7), (52, 19), (44, 17)], 'metal', lo=1, hi=5)
    poly(c, [(44, 11), (47, 10), (47, 17), (44, 17)], 'metal', lo=3, hi=5)
    for y in range(8, 19):
        c.put_ramp(52, y, 'metal', 5)
    poly(c, [(42, 6), (46, 6), (44, -1)], 'metal', lo=2, hi=5)
    c.rect(41, 18, 46, 19, 'wood', 1)
    for k in range(4):
        c.put_ramp(45 + k // 2, 20 + k, 'teamA', 4 if k < 2 else 3)
    # Koerper nach unten schieben, damit Platz fuer den schwebenden Helm + Federbusch bleibt
    body = c
    c = Canvas(54, 63)
    c.blit(body, 0, 5)
    # Schaft nach oben verlaengern + Spitze
    c.rect(43, 3, 44, 11, 'wood', 3)
    c.rect(43, 3, 43, 11, 'wood', 4)
    c.rect(44, 3, 44, 11, 'wood', 2)
    poly(c, [(42, 5), (46, 5), (44, -1)], 'metal', lo=2, hi=5)
    c.rect(43, 5, 44, 7, 'metal', 4)
    # Kragen auf dem Brustpanzer, darueber die Leere (der Helm schwebt)
    round_rect(c, 15, 21, 30, 25, 'metal', lo=0, hi=4, radius=1)
    for x in range(16, 30):
        c.put_ramp(x, 21, 'metal', 4 if x < 23 else 2)
    for (x, y) in ((22, 19), (23, 19), (21, 20), (22, 20), (23, 20), (24, 20), (22, 17), (23, 18)):
        c.put_ramp(x, y, 'ice', 2 if (x + y) % 2 else 1)
    # Helm: Topfhelm mit Visierschlitz und Licht
    hy0, hy1 = 3, 15
    round_rect(c, 14, hy0, 31, hy1, 'metal', lo=0, hi=5, radius=5, ambient=0.2)
    ellipse(c, 22.5, hy0 + 3, 9.0, 6.0, 'metal', lo=1, hi=5, clip=lambda x, y: y <= hy0 + 4)
    c.rect(15, hy0 + 5, 30, hy0 + 5, 'metal', 1)
    c.rect(16, hy0 + 6, 29, hy0 + 8, 'coal', 0)
    for y in range(hy0 + 9, hy1 + 1):
        c.put_ramp(22, y, 'metal', 4)
        c.put_ramp(23, y, 'metal', 1)
    for x in range(15, 31):
        c.put_ramp(x, hy1, 'metal', 0 if x % 2 else 1)
    # Licht im Visier
    for x in range(19, 27):
        c.put_ramp(x, hy0 + 7, 'ice', 5 if 20 <= x <= 25 else 3)
    c.put_ramp(21, hy0 + 6, 'ice', 3)
    c.put_ramp(24, hy0 + 6, 'ice', 3)
    c.put_ramp(22, hy0 + 8, 'ice', 3)
    c.put_ramp(23, hy0 + 8, 'ice', 3)
    for (x, y) in ((27, hy0 + 11), (27, hy0 + 12), (28, hy0 + 11)):
        c.put_ramp(x, y, 'coal', 0)
    # Federbusch (Teamfarbe): Kamm ueber dem Helm, hinten wehend und ausgefranst
    for k in range(16):
        t = k / 15.0
        x = int(25 - 14 * t)
        y = int(hy0 - 1 - 2.2 * math.sin(math.pi * min(1.0, t * 1.2)) + 9 * t * t)
        for dy in range(0, 3):
            c.put_ramp(x, y + dy, 'teamA', 4 if dy == 0 else (3 if dy == 1 else 2))
        if k % 3 == 1:
            c.put_ramp(x, y + 3, 'teamA', 1)
        if k > 10 and k % 2 == 0:
            c.put_ramp(x - 1, y + 3 + flick, 'teamA', 2)
    c.outline()
    return c
