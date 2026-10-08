"""pack_art4 - Kulissen und Effekte fuer die Verteidiger-Dioramen (Tor, Seilabsperrung, Toepferware, Wurzeln, Flammen, Frost, Schleim ...).
Alle Helfer heissen a4_*, damit sie nicht mit anderen Packs kollidieren."""
from __future__ import annotations

import math
import random

import numpy as np

from pixl import *
from castle import Textures

_CACHE = {}


def _tex():
    if 'tex' not in _CACHE:
        _CACHE['tex'] = Textures()
    return _CACHE['tex']


def a4_ground_put(world, x, y, ramp, idx):
    """Pixel nur auf Boden (nicht auf Sprites) setzen"""
    if 0 <= x < world.w and 0 <= y < world.h and world.depth[y, x] < -40:
        world.px[y, x, :3] = RAMPS[ramp][idx]


def a4_over_put(world, x, y, ramp, idx, depth=9000):
    """Pixel oben auf alles setzen (Effekte)"""
    if 0 <= x < world.w and 0 <= y < world.h:
        world.px[y, x, :3] = RAMPS[ramp][idx]
        world.depth[y, x] = max(world.depth[y, x], depth)


# =========================================================================== Tor

def a4_gate(span=24, wall_l=26, wall_r=26, pw=11, crest_spr=None):
    """Torbau in Suedansicht: zwei Pfeiler (hoch), Torbogen mit offener Durchfahrt (transparent), Mauerstuecke links/rechts.
    Fusspunkt = Unterkante."""
    tex = _tex()
    top = tex.tops[1]
    f22 = tex.fronts[(22, 1)]
    f34 = tex.fronts[(34, 1)]
    W = wall_l + pw + span + pw + wall_r
    h_p = 34
    H = 8 + h_p
    c = Canvas(W, H)
    rid = RAMP_ID['stone']

    def paint(x0, x1, hh, front):
        y0 = H - 8 - hh
        for x in range(x0, x1):
            for y in range(8):
                c.put(x, y0 + y, tuple(int(v) for v in top[y, x % 32]), rid)
            for y in range(hh):
                c.put(x, H - hh + y, tuple(int(v) for v in front[y, x % 32]), rid)

    paint(0, wall_l, 22, f22)
    paint(wall_l + pw + span + pw, W, 22, f22)
    paint(wall_l, wall_l + pw, h_p, f34)
    paint(wall_l + pw + span, wall_l + pw + span + pw, h_p, f34)
    # Mittelstueck ueber der Durchfahrt (volle Hoehe) und Bogen ausschneiden
    paint(wall_l + pw, wall_l + pw + span, h_p, f34)
    ax = wall_l + pw + span / 2.0
    r = span / 2.0
    spring = 19 + int(r)                        # Bogenansatz (y)
    for x in range(wall_l + pw, wall_l + pw + span):
        for y in range(0, H):
            dx = x + 0.5 - ax
            inside = y >= spring or (math.hypot(dx, y + 0.5 - spring) <= r)
            if inside and y >= 12:
                c.clear_pixel(x, y)
    # Bogenring (helle Keilsteine)
    for x in range(wall_l + pw - 4, wall_l + pw + span + 4):
        for y in range(8, H):
            dx = x + 0.5 - ax
            d = math.hypot(dx, y + 0.5 - spring)
            if y < spring and r < d <= r + 4.5 and c.alpha(x, y):
                ang = math.atan2(y + 0.5 - spring, dx)
                seg = int((ang + math.pi) * 5.0)
                idx = 4 if seg % 2 == 0 else 3
                if d > r + 3.6:
                    idx = 2
                if d < r + 1.0:
                    idx = 1
                c.put_ramp(x, y, 'stone', idx)
    # Pfeilerkappen
    for (x0, x1) in ((wall_l - 1, wall_l + pw + 1), (wall_l + pw + span - 1, wall_l + pw + span + pw + 1)):
        for x in range(max(0, x0), min(W, x1)):
            for y in range(0, 3):
                if c.alpha(x, y + (H - 8 - h_p)):
                    c.put_ramp(x, y + (H - 8 - h_p), 'stone', 5 if y == 0 else 4)
    if crest_spr is not None:
        c.blit(crest_spr, int(ax - crest_spr.w // 2), 1)
    c.outline()
    return c


def a4_rope_post():
    """Absperrpfosten (Samtseil-Staender): Messingkugel, dunkler Pfosten, Fussplatte, 8 x 22"""
    c = Canvas(10, 22)
    c.rect(4, 5, 5, 18, 'coal', 2)
    c.rect(4, 5, 4, 18, 'coal', 4)
    ellipse(c, 5, 3.5, 3.0, 3.0, 'gold', lo=2, hi=5)
    ellipse(c, 5, 19, 4.6, 2.4, 'gold', lo=1, hi=4)
    c.put_ramp(3, 2, 'gold', 5)
    c.outline()
    return c


def a4_rope(world, x0, y0, x1, y1, sag=4, team='teamA'):
    """durchhaengendes Samtseil zwischen zwei Weltpunkten"""
    n = int(abs(x1 - x0)) * 2 + 1
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)
        a4_over_put(world, int(x), int(y), team, 3, 8000)
        a4_over_put(world, int(x), int(y) + 1, team, 2, 8000)
        if i % 2 == 0:
            a4_over_put(world, int(x), int(y) - 1, team, 4, 8000)


# =========================================================================== Toepferei

def a4_amphora(seed=1):
    """kleine Amphore, 14 x 22"""
    c = Canvas(14, 22)
    ellipse(c, 7, 13, 5.8, 7.0, 'wood', lo=1, hi=5)
    rect_neck = [(5, 4, 8, 8)]
    c.rect(5, 4, 8, 8, 'wood', 3)
    c.rect(5, 4, 5, 8, 'wood', 4)
    c.rect(8, 4, 8, 8, 'wood', 2)
    ellipse(c, 6.5, 3.5, 4.2, 1.6, 'wood', lo=3, hi=5)
    for y in (11, 12):
        for x in range(2, 12):
            if c.alpha(x, y):
                c.put_ramp(x, y, 'ice', 3 if (x + y) % 2 else 4)
    for (x, y) in ((1, 8), (1, 9), (12, 8), (12, 9)):
        c.put_ramp(x, y, 'wood', 2)
    c.outline()
    return c


def a4_pot(seed=1):
    """rundes Tonfass-Toepfchen mit Rand, 14 x 14"""
    c = Canvas(14, 14)
    ellipse(c, 7, 8, 6.2, 5.0, 'wood', lo=1, hi=5)
    ellipse(c, 7, 3.6, 5.2, 1.7, 'wood', lo=3, hi=5)
    ellipse(c, 7, 3.9, 3.6, 0.9, 'coal', lo=0, hi=1)
    c.outline()
    return c


def a4_shards(seed=1):
    """Tonscherben-Haufen (Geroell des Golems), 34 x 18"""
    c = Canvas(34, 18)
    rnd = random.Random(seed)
    # Haufen: grosse Brocken hinten, kleine Scherben vorn
    for (cx, cy, w, h, lo_, hi_) in ((17, 9, 9, 7, 1, 4), (9, 11, 7, 5, 1, 4), (25, 11, 7, 5, 2, 5), (14, 13, 6, 4, 2, 5), (21, 14, 5, 3, 3, 5)):
        pts = [(cx - w, cy + h * 0.5), (cx - w * 0.5, cy - h * 0.8), (cx + w * 0.2, cy - h), (cx + w, cy - h * 0.2), (cx + w * 0.8, cy + h * 0.6)]
        poly(c, pts, 'wood', lo=lo_, hi=hi_)
    for k in range(10):
        cx = 3 + rnd.randint(0, 28)
        cy = 12 + rnd.randint(0, 4)
        w = rnd.randint(2, 3)
        poly(c, [(cx - w, cy + 1), (cx, cy - 2), (cx + w, cy + 1)], 'wood', lo=2, hi=5)
    # Bruchkanten
    for (x, y) in ((12, 6), (13, 7), (14, 8), (20, 5), (21, 6), (26, 10), (27, 11), (8, 10), (9, 11)):
        c.put_ramp(x, y, 'wood', 0)
    for (x, y) in ((16, 4), (17, 4), (11, 9), (24, 9)):
        c.put_ramp(x, y, 'wood', 5)
    # Glasurscherben
    for (x, y) in ((13, 5), (14, 5), (22, 8), (23, 8), (8, 13)):
        c.put_ramp(x, y, 'ice', 4)
        c.put_ramp(x + 1, y, 'ice', 3)
    # Restglut zwischen den Scherben
    for (x, y) in ((16, 12), (17, 12), (10, 14), (19, 10)):
        c.put_ramp(x, y, 'fire', 4)
    c.outline()
    return c


def a4_shard(seed=1):
    """einzelne fliegende Scherbe, 5 x 5"""
    c = Canvas(5, 5)
    rnd = random.Random(seed)
    poly(c, [(0, 3 + rnd.randint(0, 1)), (2, 0), (4, 2), (3, 4)], 'wood', lo=2, hi=5)
    c.outline()
    return c


def a4_wheel():
    """Toepferscheibe mit Tonklumpen, 24 x 22"""
    c = Canvas(24, 22)
    c.rect(10, 9, 13, 18, 'wood', 2)
    c.rect(10, 9, 10, 18, 'wood', 3)
    ellipse(c, 12, 18.5, 8.0, 3.0, 'wood', lo=1, hi=4)
    ellipse(c, 12, 8.5, 10.0, 3.6, 'stone', lo=2, hi=5, ambient=0.3)
    ellipse(c, 12, 5.5, 3.8, 3.4, 'wood', lo=2, hi=5)
    c.put_ramp(11, 4, 'wood', 5)
    c.outline()
    return c


# =========================================================================== Wurzeln

def a4_root_grip(front=False, seed=1):
    """Wurzelgriff: Wurzelranken umschlingen ein Ziel; front=False: hintere Ranken, front=True: vordere Ranken (quer vor den Beinen des Ziels).
    38 x 34, Fusspunkt unten mittig."""
    c = Canvas(38, 34)
    rnd = random.Random(seed + (7 if front else 0))
    if front:
        specs = [((2, 31), (10, 22), (22, 25), (31, 14)), ((35, 31), (28, 25), (16, 24), (6, 16))]
    else:
        specs = [((9, 32), (1, 22), (5, 10), (14, 3)), ((30, 32), (37, 20), (32, 9), (23, 3))]
    for k, (p0, p1, p2, p3) in enumerate(specs):
        pts = []
        n = 14
        for i in range(n + 1):
            t = i / n
            x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t ** 3 * p3[0]
            y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t ** 3 * p3[1]
            pts.append((x, y))
        for i in range(n):
            w = 5.2 - 3.0 * (i / n)
            lo_, hi_ = (1, 4) if (k + (1 if front else 0)) % 2 == 0 else (0, 3)
            thick_line(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, 'wood', lo=lo_, hi=hi_)
        for i in range(2, n - 2, 3):
            x, y = int(pts[i][0]), int(pts[i][1])
            if c.alpha(x, y):
                c.put_ramp(x, y, 'wood', 0)
        # Blaetter an der Spitze + Dornen
        tx, ty = pts[-1]
        ellipse(c, tx, ty, 2.4, 2.0, 'leaf', lo=2, hi=5)
        c.put_ramp(int(tx) - 1, int(ty) - 1, 'leaf', 5)
        ellipse(c, tx + (3 if k == 0 else -3), ty + 2, 1.8, 1.4, 'leaf', lo=2, hi=4)
        for i in (4, 8):
            x, y = int(pts[i][0]), int(pts[i][1])
            c.put_ramp(x + (1 if k else -1), y - 2, 'wood', 4)
    for kx in range(7):
        x = 2 + kx * 5 + rnd.randint(0, 1)
        c.put_ramp(x, 32 + (kx % 2), 'dirt', 2 + (kx % 3))
    c.outline()
    return c


def a4_boulder():
    """grosser Felsbrocken (faellt herab), 22 x 21"""
    c = Canvas(22, 21)
    ellipse(c, 11, 10.5, 9.6, 9.2, 'stone', lo=1, hi=5, ambient=0.15)
    for (x, y) in ((7, 6), (8, 6), (7, 7), (9, 5)):
        c.put_ramp(x, y, 'stone', 5)
    for (x, y) in ((13, 12), (14, 13), (15, 14), (12, 15), (13, 15), (16, 8), (16, 9)):
        c.put_ramp(x, y, 'coal', 2)
    c.line(11, 3, 13, 8, 'stone', 1)
    c.line(13, 8, 11, 12, 'stone', 1)
    c.outline()
    return c


def a4_heat_glow(world, cx, cy, rx, ry, seed=1):
    """gluehender Boden (Dither aus Feuerfarben) unter dem Feueratem"""
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if d > 1.0:
                continue
            n = texture_noise(x, y, seed)
            L = (1.0 - d) * 1.1 + (n - 0.5) * 0.5
            if L > 0.7 and (x + y) % 2 == 0:
                a4_ground_put(world, x, y, 'fire', 2)
            elif L > 0.45 and (x % 2 == 0 and y % 2 == 0):
                a4_ground_put(world, x, y, 'fire', 1)
            elif L > 0.3 and (x % 3 == 0 and y % 3 == 0):
                a4_ground_put(world, x, y, 'fire', 1)


def a4_ice_cluster(seed=1):
    """Eiskristall-Gruppe am Boden, 20 x 18 (mehrere Spitzen, nicht handfoermig)"""
    c = Canvas(20, 18)
    poly(c, [(2, 17), (4, 9), (7, 17)], 'ice', lo=1, hi=4)
    poly(c, [(6, 17), (10, 2), (14, 17)], 'ice', lo=2, hi=5)
    poly(c, [(12, 17), (16, 7), (19, 17)], 'ice', lo=1, hi=4)
    c.line(9, 6, 10, 15, 'ice', 5)
    c.put_ramp(4, 12, 'ice', 5)
    c.put_ramp(16, 11, 'ice', 5)
    c.outline()
    return c


# =========================================================================== Flammen

def a4_flame_cone(length=70, spread=22, seed=1, phase=0):
    """nach rechts zeigender Feuerkegel (Salamander-Atem); Ursprung links mittig; Fusspunkt egal"""
    H = spread * 2 + 4
    c = Canvas(length, H)
    rnd = random.Random(seed)
    cy = H / 2.0
    tongues = [rnd.random() * 6.28 for _ in range(7)]
    for x in range(length):
        t = x / float(length)
        half = 2.0 + spread * (t ** 0.8)
        for y in range(H):
            dy = y + 0.5 - cy
            wob = 0.8 * math.sin(x * 0.45 + phase) + 1.2 * math.sin(x * 0.17 + dy * 0.35 + tongues[x % 7])
            lim = half + wob * (0.3 + t * 1.6)
            if abs(dy) > lim:
                continue
            # 0 = Achse, 1 = Rand
            u = abs(dy) / max(lim, 1.0)
            L = (1.0 - u * 0.95) * (1.0 - 0.45 * t) + 0.05
            L += 0.10 * math.sin(x * 0.6 + dy * 0.9 + phase * 2)
            if t > 0.8 and ((x + y) % 2 == 0) and rnd.random() < (t - 0.8) * 3.0:
                continue
            idx = quant(max(0.0, min(1.0, L)), 1, 5, x, y)
            ramp = 'fire'
            if idx == 5 and u < 0.35 and t < 0.6:
                ramp, idx = 'gold', 5
            elif idx == 4 and u < 0.5 and t < 0.4:
                ramp, idx = 'gold', 4
            c.put_ramp(x, y, ramp, idx)
    # Funken am Rand
    for k in range(10):
        x = int(length * (0.25 + 0.7 * rnd.random()))
        y = int(cy + (rnd.random() - 0.5) * (spread * 2.0 * (x / length)))
        c.put_ramp(x, y, 'gold', 5)
    return c


def a4_flames_small(seed=1, w=14, h=18, phase=0):
    """kleine brennende Flamme auf einer Figur (Brennen), Fusspunkt unten"""
    c = Canvas(w, h)
    rnd = random.Random(seed)
    for y in range(h):
        t = y / float(h - 1)             # 0 oben, 1 unten
        half = 1.0 + (w / 2.0 - 1.0) * math.sin(min(1.0, t * 1.15) * math.pi * 0.5) ** 1.2
        wob = 0.9 * math.sin(y * 0.8 + phase + seed)
        for x in range(w):
            dx = x + 0.5 - w / 2.0 - wob * (1 - t)
            if abs(dx) > half:
                continue
            u = abs(dx) / max(half, 1.0)
            L = (1.0 - u) * 0.8 + t * 0.3
            idx = quant(max(0.0, min(1.0, L)), 1, 5, x, y)
            ramp = 'fire'
            if idx >= 5:
                ramp, idx = 'gold', 5
            elif idx == 4 and u < 0.4:
                ramp, idx = 'gold', 4
            c.put_ramp(x, y, ramp, idx)
    c.outline(dark=1, lit=2)
    return c


# =========================================================================== Frost, Schleim, Schweiss, Bellen

def a4_frost_ring(world, cx, cy, R, seed=1):
    """Kaelteaura: Reifflaeche auf dem Boden (Dither), Randring und Eiskristalle"""
    rnd = random.Random(seed)
    x0, x1 = max(0, int(cx - R - 2)), min(world.w, int(cx + R + 3))
    y0, y1 = max(0, int(cy - R - 2)), min(world.h, int(cy + R + 3))
    for y in range(y0, y1):
        for x in range(x0, x1):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d > R + 1.5:
                continue
            u = d / R
            n = texture_noise(x // 2, y // 2, seed) * 0.5 + texture_noise(x, y, seed + 1) * 0.5
            L = (1.0 - u) * 1.15 + (n - 0.5) * 0.7
            if abs(d - R) < 1.0:
                a4_ground_put(world, x, y, 'ice', 5 if (x + y) % 2 == 0 else 4)
                continue
            if d > R:
                continue
            if L > 0.88:
                a4_ground_put(world, x, y, 'ice', 5 if (x + y) % 2 == 0 else 4)
            elif L > 0.62:
                a4_ground_put(world, x, y, 'ice', 4 if (x + y) % 2 == 0 else 3)
            elif L > 0.42 and (x + y) % 2 == 0:
                a4_ground_put(world, x, y, 'ice', 3)
            elif L > 0.30 and (x % 3 == 0 and y % 3 == 0):
                a4_ground_put(world, x, y, 'fur', 4)


def a4_ice_crystal(seed=1, h=14):
    """Eiskristall am Boden, 8 x h"""
    c = Canvas(9, h)
    rnd = random.Random(seed)
    poly(c, [(1, h - 1), (3, 2), (5, h - 1)], 'ice', lo=2, hi=5)
    poly(c, [(4, h - 1), (6, 0), (8, h - 1)], 'ice', lo=1, hi=4)
    c.put_ramp(3, 4, 'ice', 5)
    c.put_ramp(6, 3, 'ice', 5)
    c.outline()
    return c


def a4_snowflake(world, x, y, big=False):
    a4_over_put(world, x, y, 'ice', 5, 9100)
    for (dx, dy) in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        a4_over_put(world, x + dx, y + dy, 'ice', 4, 9100)
    if big:
        for (dx, dy) in ((-2, -2), (2, -2), (-2, 2), (2, 2)):
            a4_over_put(world, x + dx, y + dy, 'ice', 5, 9100)


def a4_slime_trail(world, pts, width=7, seed=1):
    """glaenzende Schleimspur entlang eines Linienzugs (Bodendecke)"""
    rnd = random.Random(seed)
    path = []
    for (a, b) in zip(pts[:-1], pts[1:]):
        n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
        for i in range(n):
            t = i / n
            path.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    for k, (px_, py_) in enumerate(path):
        w = width * (0.55 + 0.45 * min(1.0, k / 12.0)) * (1 + 0.15 * math.sin(k * 0.4))
        for dy in range(-int(w // 2) - 1, int(w // 2) + 2):
            for dx in range(-1, 2):
                x, y = int(px_) + dx, int(py_) + dy
                r = abs(dy) / max(w / 2.0, 1)
                if r > 1.0:
                    continue
                if r > 0.8:
                    a4_ground_put(world, x, y, 'slime', 2 if (x + y) % 2 else 1)
                elif r > 0.45:
                    a4_ground_put(world, x, y, 'slime', 3 if (x + y) % 2 == 0 else 2)
                else:
                    a4_ground_put(world, x, y, 'slime', 4 if (x + y) % 2 == 0 else 3)
    for k in range(0, len(path), 5):
        px_, py_ = path[k]
        a4_ground_put(world, int(px_) - 1, int(py_) - 1, 'slime', 5)
        a4_ground_put(world, int(px_), int(py_) - 1, 'bone', 5)
    # Blasen
    for k in range(6):
        px_, py_ = path[rnd.randint(0, len(path) - 1)]
        x, y = int(px_) + rnd.randint(-2, 2), int(py_) + rnd.randint(-2, 2)
        a4_ground_put(world, x, y, 'slime', 5)
        a4_ground_put(world, x + 1, y, 'slime', 4)


def a4_sweat(world, x, y):
    """Schweisstropfen (Angst) neben einer Figur"""
    for (dx, dy, i) in ((0, 0, 5), (0, 1, 4), (-1, 1, 4), (1, 1, 4), (0, 2, 3)):
        a4_over_put(world, x + dx, y + dy, 'sky', i, 9100)


def a4_bark(world, x, y, n=3, flip=False):
    """Bell-/Schallbogen vor einem Maul (Viertelbogen, heller Schachbrett-Rand)"""
    for k in range(n):
        r = 5 + k * 4
        for a in range(-55, 56, 8):
            ang = math.radians(a)
            px_ = x + int(math.cos(ang) * r) * (-1 if flip else 1)
            py_ = y + int(math.sin(ang) * r * 0.9)
            a4_over_put(world, px_, py_, 'bone', 5 if k == 0 else (4 if k == 1 else 3), 9100)
            if k < 2:
                a4_over_put(world, px_ + (-1 if flip else 1), py_, 'bone', 3, 9100)


def a4_stake():
    """Pflock mit Eisenring (Leine), 8 x 24"""
    c = Canvas(10, 26)
    c.rect(3, 6, 6, 23, 'wood', 3)
    c.rect(3, 6, 3, 23, 'wood', 4)
    c.rect(6, 6, 6, 23, 'wood', 2)
    poly(c, [(3, 6), (6, 6), (5, 2), (4, 2)], 'wood', lo=3, hi=5)
    ellipse(c, 4.5, 12, 3.2, 2.8, 'metal', lo=1, hi=4)
    ellipse(c, 4.5, 12, 1.4, 1.2, 'wood', lo=0, hi=1)
    c.rect(2, 23, 7, 24, 'wood', 1)
    c.outline()
    return c


def a4_leash(world, x0, y0, x1, y1, sag=6):
    n = int(abs(x1 - x0)) * 2 + 1
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)
        a4_over_put(world, int(x), int(y), 'teamA', 3, 8000)
        if i % 3 != 2:
            a4_over_put(world, int(x), int(y) + 1, 'teamA', 2, 8000)


def a4_bowl():
    """Futternapf mit Knochen, 14 x 9"""
    c = Canvas(14, 9)
    ellipse(c, 7, 5.5, 6.2, 3.4, 'teamA', lo=1, hi=4)
    ellipse(c, 7, 4.2, 4.8, 1.8, 'bone', lo=3, hi=5)
    c.rect(3, 3, 5, 3, 'bone', 5)
    c.rect(4, 2, 4, 4, 'bone', 5)
    c.outline()
    return c


def a4_armor_heap():
    """Haufen aus Ruestungsteilen (Leere Ruestung nach dem Sturz), 30 x 16"""
    c = Canvas(30, 16)
    ellipse(c, 14, 11, 12.0, 4.4, 'metal', lo=0, hi=3)
    # Brustplatte (schraeg liegend)
    poly(c, [(4, 11), (12, 5), (19, 8), (14, 14)], 'metal', lo=1, hi=5)
    c.line(6, 11, 13, 7, 'metal', 5)
    # Helm
    ellipse(c, 21, 9, 5.0, 4.4, 'metal', lo=1, hi=5, clip=lambda x, y: y <= 10)
    c.rect(18, 10, 24, 11, 'coal', 0)
    c.put_ramp(20, 10, 'ice', 4)
    # Handschuh + Schienbein
    ellipse(c, 6, 13, 3.4, 2.6, 'metal', lo=1, hi=4)
    poly(c, [(22, 12), (29, 11), (29, 14), (23, 14)], 'metal', lo=1, hi=4)
    # Federbusch-Rest
    c.rect(14, 4, 17, 5, 'teamA', 3)
    c.put_ramp(18, 5, 'teamA', 2)
    c.outline()
    return c


def a4_shock_arc(world, cx, cy, r, phase=0):
    """Klirren-Schreiwelle: Ringstuecke um die Ruestung (Dither)"""
    for a in range(0, 360, 5):
        ang = math.radians(a)
        x = cx + math.cos(ang) * r
        y = cy + math.sin(ang) * r * 0.8
        if (a // 5 + phase) % 3 == 0:
            continue
        a4_over_put(world, int(x), int(y), 'ice', 5 if a % 10 == 0 else 4, 9050)


def a4_tuft(c, x, y, ramp='grass'):
    c.put_ramp(x, y, ramp, 4)
    c.put_ramp(x - 1, y + 1, ramp, 3)
    c.put_ramp(x + 1, y + 1, ramp, 3)
