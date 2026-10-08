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


# =========================================================================== UV-09 Dreikoepfiger Pudel


def _puff(c, cx, cy, r, ramp, lo, hi, n=8, seed=0, ry=None, ambient=0.2):
    """Fellkugel: Kranz kleiner Kugeln + grosse Kugel in der Mitte (gescheckter, flauschiger Rand)"""
    rnd = random.Random(seed)
    ry = ry if ry is not None else r
    for k in range(n):
        a = 2 * math.pi * k / n + rnd.random() * 0.4
        px_ = cx + math.cos(a) * r * 0.78
        py_ = cy + math.sin(a) * ry * 0.78
        rr = r * (0.42 + 0.08 * rnd.random())
        ellipse(c, px_, py_, rr, rr * ry / r, ramp, lo=lo, hi=hi, ambient=ambient)
    ellipse(c, cx, cy, r * 0.92, ry * 0.92, ramp, lo=lo, hi=hi, ambient=ambient)


def _halo(c, cx, cy, rx, ry, ramp='cloth', idx=0):
    """dunkler Saum nur dort, wo schon Pixel liegen (trennt uebereinanderliegende Koerperteile)"""
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0 and c.alpha(x, y):
                c.put_ramp(x, y, ramp, idx)


def _poodle_head(c, hx, hy, mood, seed):
    """ein Pudelkopf (Fellkugel, Schnauze nach rechts, Schlappohr, Haarknoten mit Schleife)"""
    fur = 'cloth'
    _halo(c, hx, hy - 1, 7.0, 8.2, fur, 0)
    # Schlappohr hinter dem Kopf
    ellipse(c, hx - 4.2, hy + 2.5, 2.8, 4.6, fur, lo=1, hi=3)
    # Kopf + Haarknoten
    _puff(c, hx, hy, 5.0, fur, 2, 5, n=7, seed=seed, ry=4.7)
    _puff(c, hx + 0.5, hy - 5.0, 3.0, fur, 3, 5, n=6, seed=seed + 3)
    # Schnauze
    ellipse(c, hx + 4.8, hy + 1.6, 3.6, 2.6, fur, lo=3, hi=5, ambient=0.3)
    ellipse(c, hx + 7.8, hy + 0.8, 1.5, 1.4, 'coal', lo=0, hi=2)
    c.put_ramp(hx + 7, hy + 0, 'bone', 5)
    # Auge (2x2) oder geschlossen
    if mood == 'sleepy':
        for k in range(3):
            c.put_ramp(hx + 1 + k, hy - 1, 'coal', 1)
    else:
        c.rect(hx + 1, hy - 2, hx + 2, hy - 1, 'coal', 1)
    # Mund
    if mood == 'bark':
        c.rect(hx + 4, hy + 3, hx + 8, hy + 5, 'coal', 0)
        c.rect(hx + 5, hy + 4, hx + 7, hy + 5, 'skin', 3)
        c.put_ramp(hx + 4, hy + 3, 'bone', 5)
        c.put_ramp(hx + 8, hy + 3, 'bone', 5)
    elif mood == 'tongue':
        for x in range(hx + 4, hx + 8):
            c.put_ramp(x, hy + 4, 'coal', 1)
        c.rect(hx + 5, hy + 5, hx + 6, hy + 7, 'skin', 3)
        c.put_ramp(hx + 5, hy + 7, 'skin', 2)
    else:
        for x in range(hx + 4, hx + 8):
            c.put_ramp(x, hy + 4, 'coal', 1)
    # Schleife (Teamfarbe) am Haarknoten
    by_ = hy - 8
    poly(c, [(hx - 3, by_ - 1), (hx, by_ + 1), (hx - 3, by_ + 3)], 'teamA', lo=2, hi=4)
    poly(c, [(hx + 3, by_ - 1), (hx + 0, by_ + 1), (hx + 3, by_ + 3)], 'teamA', lo=1, hi=3)
    c.rect(hx - 1, by_, hx + 1, by_ + 2, 'teamA', 4)


def spr_three_headed_poodle(anim='idle', f=0):
    """Pudel mit drei Koepfen und Schleifchen: Fellkugeln, Beine mit Puscheln, Pompon-Schwanz"""
    c = Canvas(60, 56)
    fur = 'cloth'
    dy = 5
    # Beine mit Puscheln (hinten dunkler)
    for (lx, lo_, hi_) in ((11, 1, 3), (17, 1, 3), (32, 2, 4), (38, 2, 5)):
        thick_line(c, lx, 36 + dy, lx, 49 + dy, 2.4, fur, lo=lo_, hi=min(5, hi_ + 1))
        _puff(c, lx, 50 + dy, 4.2, fur, lo_ + 1, min(5, hi_ + 1), n=6, seed=lx, ry=3.2)
        _puff(c, lx, 42 + dy, 3.0, fur, lo_ + 1, min(5, hi_ + 1), n=5, seed=lx + 1, ry=2.4)
    # Schwanz-Stiel + Pompon
    thick_line(c, 6, 28 + dy, 2, 19 + dy, 2.0, fur, lo=1, hi=3)
    _puff(c, 3, 15 + dy, 4.6, fur, 2, 5, n=7, seed=3)
    # Rumpf
    _puff(c, 13, 30 + dy, 8.6, fur, 1, 4, n=9, seed=11, ry=8.0)
    _puff(c, 24, 31 + dy, 11.0, fur, 2, 5, n=10, seed=12, ry=8.0)
    # Hals-Stiele (drei)
    thick_line(c, 25, 27 + dy, 16, 17 + dy, 6.0, fur, lo=1, hi=4)
    thick_line(c, 30, 27 + dy, 28, 13 + dy, 6.0, fur, lo=2, hi=4)
    thick_line(c, 35, 29 + dy, 43, 22 + dy, 6.0, fur, lo=2, hi=5)
    _puff(c, 31, 29 + dy, 7.6, fur, 2, 5, n=8, seed=13, ry=6.6)
    # Halsbaender (Teamfarbe)
    for (x0, y0, x1, y1) in ((20, 22, 24, 22), (27, 21, 32, 21), (38, 25, 42, 25)):
        c.rect(x0, y0 + dy, x1, y1 + dy + 1, 'teamA', 3)
        c.rect(x0, y0 + dy, x1, y0 + dy, 'teamA', 4)
    c.put_ramp(30, 23 + dy, 'gold', 5)
    c.put_ramp(30, 24 + dy, 'gold', 4)
    # Koepfe: hinten-links verschlafen, Mitte bellt (hoechster), vorn rechts mit Zunge
    _poodle_head(c, 15, 15 + dy, 'sleepy', 21)
    _poodle_head(c, 28, 8 + dy, 'bark', 22)
    _poodle_head(c, 43, 17 + dy, 'tongue', 23)
    c.outline()
    return c


# =========================================================================== UV-10 Gletscher-Greis


def _shard(c, pts, ramp='ice', lo=2, hi=5):
    poly(c, pts, ramp, lo=lo, hi=hi)


def spr_glacier_elder(anim='idle', f=0):
    """Eisriese, alt und gebueckt: Strickmuetze (Teamfarbe) mit Bommel, Eisbart mit Zapfen, Hausschuhe, Gehstock"""
    c = Canvas(66, 68)
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    # Gehstock (hinten rechts): Holz mit Kruecke
    c.rect(58, 36, 59, 67, 'wood', 3)
    c.rect(58, 36, 58, 67, 'wood', 4)
    c.rect(59, 36, 59, 67, 'wood', 2)
    thick_line(c, 59, 36, 55, 33, 2.4, 'wood', lo=2, hi=4)
    c.put_ramp(55, 33, 'wood', 5)
    # Beine (Eissaeulen)
    for (x0, x1, lo_, hi_) in ((13, 26, 1, 4), (36, 49, 2, 5)):
        round_rect(c, x0, 42, x1, 61, 'ice', lo=lo_, hi=hi_, radius=3)
        for k in range(4):
            c.put_ramp(x0 + 3 + k, 48 + k * 2, 'ice', 5)
        c.put_ramp(x0 + 6, 54, 'ice', 0)
        c.put_ramp(x0 + 7, 55, 'ice', 0)
        c.put_ramp(x0 + 7, 56, 'ice', 0)
    # Hausschuhe: flauschige Pantoffeln mit Fellkragen
    for (x0, x1, lo_, hi_) in ((7, 30, 1, 4), (32, 55, 2, 5)):
        round_rect(c, x0, 59, x1, 67, 'cloth', lo=lo_ + 1, hi=min(5, hi_ + 1), radius=3)
        ellipse(c, x1 - 4, 63, 6.0, 4.6, 'cloth', lo=lo_ + 1, hi=min(5, hi_ + 1))
        # Fellkragen oben
        for x in range(x0 + 5, x1 - 4):
            c.put_ramp(x, 59, 'bone', 5 if x % 3 else 4)
            c.put_ramp(x, 60, 'bone', 4 if x % 2 else 3)
            if x % 4 == 0:
                c.put_ramp(x, 58, 'bone', 4)
        for x in range(x0 + 2, x1 - 2):
            c.put_ramp(x, 67, 'cloth', 0)
        # Bommel
        ellipse(c, x1 - 7, 61, 2.4, 2.2, 'teamA', lo=2, hi=5)
    # linker Arm (hinten, haengend)
    thick_line(c, 12, 28 + bob, 7, 48, 10.0, 'ice', lo=0, hi=3)
    ellipse(c, 7, 51, 6.0, 5.4, 'ice', lo=1, hi=4)
    for x in (4, 7, 10):
        c.put_ramp(x, 55, 'ice', 0)
    # Rumpf: kristalliner Block mit Facetten
    poly(c, [(9, 27 + bob), (20, 19 + bob), (45, 19 + bob), (57, 28 + bob), (52, 46), (15, 46)], 'ice', lo=1, hi=4)
    poly(c, [(20, 19 + bob), (45, 19 + bob), (38, 30 + bob), (23, 29 + bob)], 'ice', flat=4)
    poly(c, [(9, 27 + bob), (20, 19 + bob), (23, 29 + bob), (14, 38)], 'ice', flat=3)
    poly(c, [(45, 19 + bob), (57, 28 + bob), (52, 46), (44, 36)], 'ice', flat=2)
    poly(c, [(15, 46), (14, 38), (23, 29 + bob), (30, 46)], 'ice', flat=2)
    for (x0, y0, x1, y1) in ((20, 19, 23, 29), (23, 29, 38, 30), (38, 30, 45, 19), (14, 38, 23, 29), (44, 36, 57, 28)):
        c.line(x0, y0 + (bob if y0 < 30 else 0), x1, y1 + (bob if y1 < 30 else 0), 'ice', 5)
    c.line(30, 46, 23, 29 + bob, 'ice', 1)
    c.line(44, 36, 38, 30 + bob, 'ice', 1)
    # Schulterkristalle
    _shard(c, [(10, 28 + bob), (6, 14 + bob), (17, 22 + bob)], 'ice', 2, 5)
    _shard(c, [(18, 22 + bob), (17, 10 + bob), (26, 20 + bob)], 'ice', 3, 5)
    _shard(c, [(47, 21 + bob), (53, 9 + bob), (56, 24 + bob)], 'ice', 1, 4)
    _shard(c, [(40, 20 + bob), (44, 12 + bob), (48, 21 + bob)], 'ice', 2, 4)
    # Schneehaeufchen auf den Schultern
    for (cx_, cy_, rr) in ((12, 24, 3.6), (50, 22, 3.8)):
        ellipse(c, cx_, cy_ + bob, rr, rr * 0.6, 'fur', lo=3, hi=5)
    # rechter Arm: haelt den Stock
    thick_line(c, 52, 28 + bob, 57, 41 + bob, 10.0, 'ice', lo=1, hi=4)
    ellipse(c, 57, 42 + bob, 5.0, 4.6, 'ice', lo=2, hi=5)
    for k in range(3):
        c.put_ramp(54 + k * 3, 45 + bob, 'ice', 1)
    # Schal (Teamfarbe) mit Streifen
    for x in range(21, 46):
        for k in range(4):
            c.put_ramp(x, 25 + k + bob, 'teamA', quant(0.9 - 0.7 * (x - 21) / 24.0 - 0.1 * k, 1, 4, x, 25 + k))
    for x in range(23, 46, 4):
        c.rect(x, 25 + bob, x + 1, 28 + bob, 'bone', 5 if x < 33 else 4)
    thick_line(c, 40, 28 + bob, 42, 40, 5.0, 'teamA', lo=1, hi=4)
    for y in range(34, 41, 2):
        c.rect(40, y, 43, y, 'bone', 4)
    # Kopf (Gesicht frei zwischen Muetze und Bart)
    ellipse(c, 31, 15 + bob, 9.8, 8.8, 'ice', lo=2, hi=5, ambient=0.25)
    # Nase (knubbelig, vorn) mit kalter roter Spitze
    ellipse(c, 40.5, 18 + bob, 4.2, 3.4, 'ice', lo=3, hi=5)
    ellipse(c, 42.5, 19 + bob, 2.2, 2.0, 'skin', lo=3, hi=5)
    # Eisbart: tropfenfoermig, weiss, Straehnen, Zapfen
    brnd = random.Random(4)
    ends = {}
    for y in range(22, 47):
        t = (y - 22) / 24.0
        half = 12.2 * math.sqrt(max(0.0, 1.0 - t ** 1.7))
        for x in range(int(31 - half), int(31 + half) + 1):
            u = (x - (31 - half)) / (2 * half + 1)
            L = 0.98 - 0.55 * u - 0.12 * t
            idx = quant(max(0.0, min(1.0, L)), 3, 5, x, y)
            if (x + y // 4) % 4 == 0 and y > 25:
                idx = max(2, idx - 1)
            if t > 0.7 and brnd.random() < 0.18:
                continue
            c.put_ramp(x, y + (bob if y < 24 else 0), 'fur', idx)
    for (x, ln) in ((21, 3), (24, 5), (27, 3), (30, 6), (33, 4), (36, 5), (39, 3)):
        for dy in range(ln):
            c.put_ramp(x, 46 + dy, 'ice' if dy > 1 else 'fur', 5 if dy < ln - 1 else 4)
            if dy < ln - 2:
                c.put_ramp(x + 1, 46 + dy, 'ice', 4)
    for (x, y) in ((24, 30), (27, 36), (33, 31), (36, 38), (29, 42)):
        c.put_ramp(x, y, 'ice', 5)
    # Schnurrbart ueber dem Mund
    ellipse(c, 33.0, 23 + bob, 6.4, 2.6, 'fur', lo=3, hi=5)
    ellipse(c, 40.0, 23 + bob, 3.8, 2.2, 'fur', lo=3, hi=5)
    # Augen: schlaefrig geschlossen unter dichten Brauen
    for x in range(34, 39):
        c.put_ramp(x, 17 + bob, 'ice', 0)
    c.put_ramp(33, 16 + bob, 'ice', 0)
    for x in range(25, 29):
        c.put_ramp(x, 17 + bob, 'ice', 0)
    ellipse(c, 36.5, 14 + bob, 4.8, 2.2, 'fur', lo=3, hi=5)
    ellipse(c, 26.5, 15 + bob, 3.2, 2.0, 'fur', lo=2, hi=4)
    # Strickmuetze: Kuppel, Umschlag mit Rippen, haengende Spitze + Bommel
    def capclip(x, y):
        return y <= 8 + bob
    ellipse(c, 31, 8 + bob, 10.8, 8.0, 'teamA', lo=1, hi=5, clip=capclip, ambient=0.2)
    for y in range(0, 8 + bob):
        for x in range(20, 42):
            if c.alpha(x, y) and c.rid[y, x] == RAMP_ID['teamA'] and x % 3 == 0:
                c.put_ramp(x, y, 'teamA', 1)
    for y in range(8 + bob, 12 + bob):
        for x in range(19, 43):
            L = 0.85 - 0.5 * (x - 19) / 23.0
            idx = quant(max(0.0, min(1.0, L)), 2, 5, x, y)
            if x % 2 == 0:
                idx = max(1, idx - 1)
            c.put_ramp(x, y, 'teamA', idx)
    for x in range(19, 43):
        c.put_ramp(x, 11 + bob, 'teamA', 1)
    for x in range(23, 40, 6):
        c.rect(x, 8 + bob, x + 1, 10 + bob, 'bone', 5 if x < 31 else 4)
    thick_line(c, 25, 3 + bob, 17, 11 + bob, 5.4, 'teamA', lo=1, hi=4)
    ellipse(c, 15, 14 + bob, 3.6, 3.4, 'bone', lo=3, hi=5)
    for (x, y) in ((14, 13), (16, 13), (15, 15)):
        c.put_ramp(x, y + bob, 'bone', 5)
    c.outline()
    return c


# =========================================================================== UV-11 Salamander-Waechter


def _lava(c, pts, seed=0):
    """Lavaader: glimmende Linie mit hellen Knoten auf dunkler Haut (nur auf vorhandenen Pixeln)"""
    path = []
    for (a, b) in zip(pts[:-1], pts[1:]):
        n = max(abs(b[0] - a[0]), abs(b[1] - a[1]), 1)
        for i in range(n + 1):
            path.append((int(round(a[0] + (b[0] - a[0]) * i / n)), int(round(a[1] + (b[1] - a[1]) * i / n))))
    for k, (x, y) in enumerate(path):
        if c.alpha(x, y) and c.rid[y, x] == RAMP_ID['coal']:
            c.put_ramp(x, y, 'fire', 4 if k % 3 else 5)
            if c.alpha(x, y + 1) and c.rid[y + 1, x] == RAMP_ID['coal'] and k % 2 == 0:
                c.put_ramp(x, y + 1, 'fire', 2)


def spr_salamander_warden(anim='idle', f=0):
    """Lavahaeutiger Salamander mit Waechtermuetze (Teamfarbe). anim 'breath': Maul offen (Feuerkegel kommt separat)."""
    c = Canvas(66, 46)
    breath = anim == 'breath'
    bob = [0, -1][f % 2] if anim == 'idle' else 0
    # Schwanz: dick, nach hinten auslaufend, Spitze glueht
    thick_line(c, 18, 28, 8, 33, 9.0, 'coal', lo=0, hi=3)
    thick_line(c, 8, 33, 3, 27, 6.0, 'coal', lo=1, hi=3)
    thick_line(c, 3, 27, 4, 19, 3.6, 'coal', lo=1, hi=3)
    ellipse(c, 4, 17, 2.4, 2.6, 'fire', lo=3, hi=5)
    c.put_ramp(4, 16, 'gold', 5)
    # hintere Beine (links), dunkler
    for lx in (14, 21):
        thick_line(c, lx, 31, lx - 1, 41, 6.0, 'coal', lo=0, hi=3)
        for k in range(3):
            c.put_ramp(lx - 4 + k * 2, 44, 'bone', 3)
            c.put_ramp(lx - 4 + k * 2, 45, 'bone', 1)
        ellipse(c, lx - 1, 42, 4.4, 2.6, 'coal', lo=1, hi=3)
    # Rumpf: langer Tonnenleib
    ellipse(c, 30, 26 + bob, 19.5, 12.0, 'coal', lo=1, hi=4, ambient=0.15)
    # glimmender Unterbauch
    for x in range(14, 49):
        dx = (x + 0.5 - 31) / 19.0
        if abs(dx) >= 0.97:
            continue
        yb = int(27 + bob + 10.5 * math.sqrt(1 - dx * dx))
        for k in range(3):
            if c.alpha(x, yb - k):
                c.put_ramp(x, yb - k, 'fire', 3 if k == 0 else (2 if (x + k) % 2 else 1))
    # Lava-Flecken (Salamanderflecken) auf dem Ruecken
    for (sx, sy, sr) in ((19, 21, 2.4), (26, 18, 2.8), (34, 19, 2.6), (41, 22, 2.2), (23, 26, 2.0), (31, 25, 2.2), (38, 27, 1.8)):
        ellipse(c, sx, sy + bob, sr, sr * 0.85, 'fire', lo=2, hi=5, ambient=0.4)
        c.put_ramp(int(sx) - 1, int(sy) - 1 + bob, 'gold', 5)
    _lava(c, [(15, 24 + bob), (19, 29 + bob), (24, 31 + bob), (29, 30 + bob)])
    _lava(c, [(36, 30 + bob), (41, 31 + bob), (45, 28 + bob)])
    _lava(c, [(21, 17 + bob), (23, 22 + bob), (22, 26 + bob)], 1)
    # vordere Beine (rechts), heller
    for lx in (35, 43):
        thick_line(c, lx, 31, lx + 1, 41, 6.6, 'coal', lo=1, hi=4)
        ellipse(c, lx + 1.5, 42, 5.0, 2.8, 'coal', lo=2, hi=4)
        for k in range(3):
            c.put_ramp(lx - 2 + k * 3, 44, 'bone', 4)
            c.put_ramp(lx - 2 + k * 3, 45, 'bone', 2)
    _lava(c, [(35, 33), (36, 37)])
    _lava(c, [(43, 33), (44, 38)])
    # Hals + Kopf: breiter, flacher Echsenkopf mit Stirnwulst
    thick_line(c, 42, 25 + bob, 50, 21 + bob, 11.0, 'coal', lo=1, hi=4)
    hx, hy = 52, 21 + bob
    ellipse(c, hx, hy, 9.0, 7.0, 'coal', lo=1, hi=4, ambient=0.2)
    ellipse(c, hx + 8.0, hy + 1.5, 7.2, 4.4, 'coal', lo=1, hi=4, ambient=0.25)
    jaw_open = 5 if breath else 0
    # Unterkiefer
    ellipse(c, hx + 6.0, hy + 5.0 + jaw_open, 7.0, 2.8, 'coal', lo=0, hi=3, ambient=0.2)
    if breath:
        # Rachen: Keil zwischen Oberkiefer (oben) und Unterkiefer (unten), Glut waechst zur Schnauzenspitze
        for x in range(hx + 1, hx + 15):
            t = (x - (hx + 1)) / 13.0
            top = hy + 4
            bot = hy + 5 + int(round(jaw_open * t)) + 1
            for y in range(top, bot + 1):
                if y == top:
                    idx_, ramp_ = 1, 'fire'
                elif y == bot:
                    idx_, ramp_ = 2, 'fire'
                else:
                    ramp_ = 'fire'
                    L = 0.15 + 0.85 * t
                    idx_ = quant(L, 1, 5, x, y)
                    if idx_ >= 5:
                        ramp_, idx_ = 'gold', 5
                c.put_ramp(x, y, ramp_, idx_)
            if x % 3 == 0:
                c.put_ramp(x, top + 1, 'bone', 5)
                c.put_ramp(x, bot - 1, 'bone', 4)
    else:
        for x in range(hx + 3, hx + 14):
            c.put_ramp(x, hy + 4, 'coal', 0)
        c.put_ramp(hx + 14, hy + 3, 'coal', 0)
        for (x, y) in ((hx + 12, hy - 3), (hx + 13, hy - 5), (hx + 15, hy - 7)):
            c.put_ramp(x, y, 'coal', 4)
    # Nasenloch + Glut
    c.put_ramp(hx + 13, hy, 'fire', 4)
    c.put_ramp(hx + 12, hy, 'fire', 2)
    # Auge (gross, rund, sitzt oben am Kopf)
    ellipse(c, hx + 3.0, hy - 2.6, 3.2, 3.0, 'gold', lo=3, hi=5)
    c.rect(hx + 3, hy - 3, hx + 4, hy - 2, 'coal', 0)
    c.put_ramp(hx + 2, hy - 4, 'bone', 5)
    # Haut-Adern am Kopf
    _lava(c, [(hx - 6, hy + 1), (hx - 3, hy + 3), (hx, hy + 2)])
    # Rim-Licht auf den Oberkanten (Haut ist sehr dunkel)
    for y in range(1, c.h):
        for x in range(c.w):
            if c.alpha(x, y) and c.rid[y, x] == RAMP_ID['coal'] and not c.alpha(x, y - 1):
                c.put_ramp(x, y, 'coal', 5 if x % 2 else 4)
    # Waechtermuetze: breite Tellerkappe in Teamfarbe mit Goldband, Lackschirm und Abzeichen
    capx, capy = hx - 1, hy - 8
    round_rect(c, capx - 6, capy - 3, capx + 6, capy + 3, 'teamA', lo=1, hi=4, radius=1)
    ellipse(c, capx + 1, capy - 3, 8.6, 2.8, 'teamA', lo=2, hi=5, ambient=0.3)
    for x in range(capx - 6, capx + 7):
        c.put_ramp(x, capy + 1, 'gold', 4 if x % 2 else 3)
        c.put_ramp(x, capy + 2, 'coal', 1)
    poly(c, [(capx + 1, capy + 3), (capx + 14, capy + 3), (capx + 12, capy + 6), (capx + 3, capy + 5)], 'coal', lo=0, hi=3)
    c.put_ramp(capx + 5, capy + 3, 'metal', 4)
    c.put_ramp(capx + 6, capy + 3, 'metal', 3)
    c.rect(capx + 4, capy - 2, capx + 6, capy, 'gold', 4)
    c.put_ramp(capx + 4, capy - 2, 'gold', 5)
    c.put_ramp(capx + 5, capy - 1, 'gold', 2)
    c.outline()
    return c
