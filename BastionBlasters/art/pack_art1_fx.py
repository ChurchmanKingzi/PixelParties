"""pack_art1: Geschosse, Effekte und kleine Nebenfiguren für die Dioramen UA-02 .. UA-13 (alles eigene Sprites)."""
from __future__ import annotations

import math
import random

from cards_art import *
from pack_art1_kit import *


# --------------------------------------------------------------------------- Feuer


def flame(w=9, h=14, seed=1, tall=1.0):
    """Flamme (Zungen), heller Kern; ohne Outline"""
    c = Canvas(w, h)
    cx = w / 2.0
    for y in range(h):
        t = y / float(max(1, h - 1))                       # 0 oben .. 1 unten
        half = (w / 2.0) * (math.sin(math.pi * min(1.0, 0.18 + t * 0.95)) ** 0.9) * (0.35 + 0.65 * t)
        wob = math.sin(y * 0.85 + seed * 1.7) * 0.9 * (1 - t) + (0.6 if (y + seed) % 5 == 0 else 0)
        for x in range(w):
            d = abs(x + 0.5 - cx - wob) / max(0.45, half)
            if d > 1.0:
                continue
            if d > 0.78:
                idx = 2 if (x + y) % 2 else 3
            elif d > 0.5:
                idx = 3 if t < 0.55 else 4
            elif d > 0.25:
                idx = 4
            else:
                idx = 5 if t > 0.35 else 4
            ramp = 'fire'
            if d < 0.22 and t > 0.55:
                ramp, idx = 'gold', 5
            c.put_ramp(x, y, ramp, idx)
    return c


def fireball(f=0):
    c = Canvas(26, 14)
    poly(c, [(15, 3), (0, 7), (15, 11)], 'fire', lo=2, hi=4)
    poly(c, [(15, 5), (5, 7), (15, 9)], 'gold', lo=4, hi=5)
    for (x, y) in ((3, 4), (7, 2), (9, 11), (2, 9), (11, 1)):
        c.put_ramp(x, y, 'fire', 4)
    ellipse(c, 19, 7, 5.6, 5.6, 'fire', lo=2, hi=5)
    ellipse(c, 19.5, 7, 3.4, 3.4, 'gold', lo=3, hi=5)
    c.put_ramp(18, 6, 'gold', 5)
    return c


# --------------------------------------------------------------------------- kleine Figuren


def proj_goblin(f=0):
    """fliegender Goblin (Geschoss der Goblin-Kanone): Arme hoch, Beine angezogen, Mund auf"""
    c = Canvas(24, 24)
    thick_line(c, 10, 17, 6, 22, 3.0, 'goblin', lo=1, hi=3)
    thick_line(c, 13, 17, 15, 22, 3.0, 'goblin', lo=2, hi=4)
    round_rect(c, 7, 11, 16, 19, 'cloth', lo=1, hi=4, radius=2)
    c.rect(7, 16, 16, 16, 'gold', 2)
    thick_line(c, 7, 12, 3, 5, 2.4, 'goblin', lo=1, hi=4)
    thick_line(c, 16, 12, 21, 5, 2.4, 'goblin', lo=2, hi=5)
    c.rect(20, 1, 22, 4, 'metal', 4)                                     # Dolch in der Faust
    c.put_ramp(21, 0, 'metal', 5)
    poly(c, [(8, 6), (1, 2), (8, 11)], 'goblin', lo=1, hi=4)
    poly(c, [(16, 6), (23, 8), (16, 11)], 'goblin', lo=2, hi=5)
    ellipse(c, 12, 8, 5.4, 4.8, 'goblin', lo=2, hi=5)
    c.rect(14, 6, 15, 7, 'coal', 1)
    c.rect(11, 10, 15, 11, 'coal', 0)                                    # Mund auf (brüllt)
    c.put_ramp(12, 10, 'bone', 5)
    c.put_ramp(14, 10, 'bone', 5)
    c.outline()
    return c


def mini_goblin(f=0):
    """kleiner Goblin am Boden (gelandet), Dolch gezückt (S)"""
    c = Canvas(18, 20)
    bob = [0, -1][f % 2]
    thick_line(c, 7, 15 + bob, 6, 18, 2.6, 'goblin', lo=1, hi=3)
    thick_line(c, 11, 15 + bob, 12, 18, 2.6, 'goblin', lo=2, hi=4)
    round_rect(c, 5, 10 + bob, 13, 16 + bob, 'cloth', lo=1, hi=4, radius=2)
    c.rect(5, 14 + bob, 13, 14 + bob, 'gold', 2)
    thick_line(c, 13, 11 + bob, 16, 13 + bob, 2.0, 'goblin', lo=2, hi=5)
    c.rect(16, 11 + bob, 17, 13 + bob, 'metal', 4)
    poly(c, [(6, 6 + bob), (0, 3 + bob), (6, 9 + bob)], 'goblin', lo=1, hi=4)
    poly(c, [(13, 6 + bob), (17, 3 + bob), (13, 9 + bob)], 'goblin', lo=2, hi=5)
    ellipse(c, 9.5, 7 + bob, 4.4, 4.0, 'goblin', lo=2, hi=5)
    c.rect(11, 6 + bob, 12, 7 + bob, 'coal', 1)
    c.rect(10, 9 + bob, 12, 9 + bob, 'coal', 0)
    c.outline()
    return c


def proj_orc(f=0):
    """fliegender Ork (Geschoss der Ork-Kanone): breit, Hauer, Stirnband, Axt hoch, brüllt"""
    c = Canvas(34, 34)
    # Beine
    thick_line(c, 12, 24, 8, 31, 5.0, 'leaf', lo=1, hi=3)
    thick_line(c, 18, 24, 21, 31, 5.0, 'leaf', lo=2, hi=4)
    c.rect(5, 31, 10, 32, 'wood', 2)
    c.rect(19, 31, 24, 32, 'wood', 3)
    # Rumpf: Wams + Lendenschurz
    ellipse(c, 15, 19, 8.6, 7.4, 'leaf', lo=1, hi=4)
    for (x, y) in ((11, 16), (14, 15), (17, 17), (13, 20), (18, 21)):
        c.put_ramp(x, y, 'leaf', 4)
    poly(c, [(8, 24), (22, 24), (20, 29), (10, 29)], 'wood', lo=1, hi=4)
    for x in range(8, 23, 3):
        c.put_ramp(x, 25, 'wood', 0)
    # Streifen der Kriegsbemalung auf der Brust
    c.line(10, 14, 14, 19, 'fire', 3)
    c.line(14, 14, 18, 19, 'fire', 3)
    # Arme hoch: links mit Faust, rechts mit Axt
    thick_line(c, 7, 15, 3, 8, 4.4, 'leaf', lo=1, hi=4)
    c.rect(1, 5, 4, 8, 'leaf', 4)
    thick_line(c, 22, 15, 27, 9, 4.4, 'leaf', lo=2, hi=5)
    c.rect(26, 6, 29, 9, 'leaf', 4)
    thick_line(c, 28, 12, 28, 0, 1.8, 'wood', lo=2, hi=4)
    poly(c, [(28, 0), (33, 2), (33, 8), (28, 7)], 'metal', lo=2, hi=5)
    c.put_ramp(31, 3, 'metal', 5)
    # Kopf: klein, breite Kiefer, Hauer, Stirnband
    ellipse(c, 15, 9, 6.2, 5.4, 'leaf', lo=2, hi=5)
    c.rect(17, 7, 18, 8, 'coal', 1)
    c.rect(12, 11, 19, 12, 'coal', 0)                                    # weit offener Mund
    poly(c, [(12, 11), (11, 7), (13, 10)], 'bone', lo=3, hi=5)           # Hauer
    poly(c, [(19, 11), (21, 7), (20, 10)], 'bone', lo=3, hi=5)
    for x in range(9, 22):
        c.put_ramp(x, 5, 'teamA', 3 if x % 2 else 2)
    c.put_ramp(21, 6, 'teamA', 4)
    c.put_ramp(22, 7, 'teamA', 3)
    c.outline()
    return c


def shout_bubble(f=0):
    """zackige Brüll-Sprechblase mit drei Ausrufezeichen (nur Symbole, kein Text)"""
    W, H = 34, 24
    c = Canvas(W, H)
    cx, cy = 17.0, 10.0
    for y in range(H):
        for x in range(W):
            dx, dy = (x + 0.5 - cx) / 15.0, (y + 0.5 - cy) / 9.0
            a = math.atan2(dy, dx)
            r = math.hypot(dx, dy)
            spike = 1.0 + 0.16 * (1.0 if math.cos(a * 9) > 0.35 else -0.5)
            if r <= spike * 0.9:
                c.put_ramp(x, y, 'bone', 5 if (x + y * 1.4) < 24 else 4)
    # Schwanz zur Kanone (links unten)
    poly(c, [(8, 15), (3, 23), (14, 17)], 'bone', lo=4, hi=5)
    for k in range(3):
        x = 10 + k * 7
        c.rect(x, 4, x + 2, 11, 'fire', 3)
        c.rect(x, 4, x, 11, 'fire', 4)
        c.rect(x, 13, x + 2, 15, 'fire', 3)
    c.outline(dark=0, lit=1)
    return c


# --------------------------------------------------------------------------- Frost


def icicle_shape(length, width, ramp='ice'):
    """senkrecht stehender Eiszapfen (Spitze oben): Canvas (width, length)"""
    c = Canvas(width, length)
    cx = (width - 1) / 2.0
    for y in range(length):
        t = y / float(max(1, length - 1))                 # 0 Spitze .. 1 Basis
        hw = (width / 2.0) * (t ** 0.85)
        for x in range(width):
            d = (x - cx) / max(0.5, hw)
            if abs(d) <= 1.0 or (y == 0 and x == int(cx)):
                idx = 5 if d < -0.35 else (4 if d < 0.2 else (3 if d < 0.65 else 2))
                c.put_ramp(x, y, ramp, idx)
    return c


def icicle_at(world, x0, y0, x1, y1, width=4, key=9000):
    """Eiszapfen, dessen Spitze bei (x1, y1) liegt und dessen Basis bei (x0, y0) liegt (Flugrichtung)"""
    L = int(math.hypot(x1 - x0, y1 - y0))
    for k in range(L):
        t = k / float(max(1, L - 1))
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        hw = max(0.4, (1.0 - t) * width / 2.0 + 0.3)
        nx, ny = -(y1 - y0) / max(1.0, L), (x1 - x0) / max(1.0, L)
        for s in range(-int(hw + 1), int(hw + 1) + 1):
            if abs(s) > hw:
                continue
            idx = 5 if s < 0 else (4 if s == 0 else 3)
            if t > 0.75:
                idx = 5 if s <= 0 else 4
            put_px(world, x + nx * s, y + ny * s, 'ice', idx, key)


# --------------------------------------------------------------------------- Blitz


def lightning(world, pts, seed=1, key=9500, jitter=3.0, segs=4):
    """verzweigter Zickzack-Blitz entlang pts; Kern hell, Rand golden"""
    rnd = random.Random(seed)
    path = []
    for (a, b) in zip(pts[:-1], pts[1:]):
        for k in range(segs):
            t = k / float(segs)
            x = a[0] + (b[0] - a[0]) * t
            y = a[1] + (b[1] - a[1]) * t
            if k:
                x += rnd.uniform(-jitter, jitter)
                y += rnd.uniform(-jitter, jitter)
            path.append((x, y))
    path.append(pts[-1])
    for (a, b) in zip(path[:-1], path[1:]):
        n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
        for k in range(n + 1):
            t = k / float(n)
            x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            for (dx, dy) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                put_px(world, x + dx, y + dy, 'gold', 4, key - 1)
    for (a, b) in zip(path[:-1], path[1:]):
        n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1]))) + 1
        for k in range(n + 1):
            t = k / float(n)
            put_px(world, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 'ice', 5, key)
    return path


# --------------------------------------------------------------------------- Ballista-Bolzen, Bohrer, Frosch, Schleim


def proj_bolt(f=0):
    """Bolzen mit Schleife (fliegt nach rechts), 40 x 14"""
    c = Canvas(40, 14)
    thick_line(c, 4, 7, 32, 7, 2.6, 'wood', lo=3, hi=5)
    poly(c, [(31, 3), (31, 11), (39, 7)], 'metal', lo=2, hi=5)
    for (dx, dy) in ((0, -2), (1, -3), (0, 2), (1, 3), (3, -3), (3, 3)):
        c.put_ramp(2 + dx, 7 + dy, 'bone', 4)
    poly(c, [(22, 7), (17, 3), (17, 11), (22, 8)], 'teamA', lo=2, hi=5)
    poly(c, [(23, 7), (28, 3), (28, 11), (23, 8)], 'teamA', lo=1, hi=4)
    c.rect(21, 6, 24, 8, 'teamA', 4)
    c.outline()
    return c


def drill_proj(f=0):
    """Bohrgeschoss (Spitze nach oben), 12 x 18"""
    c = Canvas(12, 18)
    for y in range(0, 18):
        t = y / 17.0
        hw = 0.5 + t * 5.0
        x0, x1 = int(round(6 - hw)), int(round(6 + hw)) - 1
        for x in range(x0, x1 + 1):
            ph = (y + (x - 6) * 0.8) % 4.0
            idx = 5 if ph < 1 else (4 if ph < 2 else (3 if ph < 3 else 2))
            if x >= x1 - 1:
                idx = max(1, idx - 2)
            c.put_ramp(x, y, 'metal', idx)
    c.outline()
    return c


def mini_frog(f=0, hop=0):
    """kleiner Frosch (Ergebnis der Verwandlung), 18 x 14"""
    c = Canvas(18, 16)
    y0 = 3 - hop
    ellipse(c, 9, 9 + y0 - 2, 6.4, 4.4, 'leaf', lo=1, hi=5)
    ellipse(c, 12, 7 + y0 - 2, 4.4, 3.4, 'leaf', lo=2, hi=5)
    thick_line(c, 4, 12 + y0 - 2, 8, 13 + y0 - 2, 2.6, 'leaf', lo=1, hi=3)
    for (ex, ey) in ((10, 4), (14, 4)):
        ellipse(c, ex, ey + y0 - 2, 2.2, 2.2, 'leaf', lo=2, hi=5)
        c.put_ramp(ex + 1, ey + y0 - 2, 'coal', 0)
        c.put_ramp(ex, ey + y0 - 3, 'bone', 5)
    for x in range(11, 16):
        c.put_ramp(x, 9 + y0 - 2, 'leaf', 0)
    c.outline()
    return c


def slime_ball(f=0):
    """Schleimkugel des Frosch-Katapults mit Tropfenschweif, 20 x 14"""
    c = Canvas(20, 14)
    poly(c, [(12, 4), (0, 7), (12, 10)], 'slime', lo=1, hi=3)
    for (x, y) in ((3, 4), (6, 10), (9, 3)):
        c.put_ramp(x, y, 'slime', 4)
    ellipse(c, 14, 7, 5.4, 5.4, 'slime', lo=1, hi=5)
    for (dx, dy) in ((-2, -2), (1, 1)):
        c.put_ramp(14 + dx, 7 + dy, 'bone', 5)
    c.put_ramp(17, 9, 'slime', 0)
    return c


def ink_blob(r=3, seed=1):
    """Tintenklecks (Spritzer), Radius r"""
    n = int(r * 2 + 3)
    c = Canvas(n, n)
    rnd = random.Random(seed)
    cx = cy = n / 2.0
    for y in range(n):
        for x in range(n):
            d = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
            if d <= r * (0.82 + 0.28 * rnd.random()):
                c.put_ramp(x, y, 'coal', 0 if (x + y) % 3 else 1)
    for (dx, dy) in ((-1, -1), (0, -1)):
        if c.alpha(int(cx + dx), int(cy + dy)):
            c.put_ramp(int(cx + dx), int(cy + dy), 'purple', 2)
    return c


def spore_cloud(w, h, seed=1, ramp='leaf'):
    """wabernde Sporenwolke aus Schachbrett-Dither (halbtransparent wirkend), w x h"""
    c = Canvas(w, h)
    rnd = random.Random(seed)
    blobs = []
    for _ in range(int(w * h / 40) + 4):
        blobs.append((rnd.uniform(w * 0.12, w * 0.88), rnd.uniform(h * 0.15, h * 0.85), rnd.uniform(h * 0.16, h * 0.30)))
    for y in range(h):
        for x in range(w):
            dens = 0.0
            for (bx, by, br) in blobs:
                d = math.hypot((x - bx) / 1.2, y - by)
                if d < br:
                    dens = max(dens, 1.0 - d / br)
            if dens <= 0.0:
                continue
            if dens > 0.55:
                idx = 4 if (x + y) % 2 == 0 else 3
            elif dens > 0.3:
                idx = 3 if (x + y) % 2 == 0 else -1
            else:
                idx = 2 if (x + 2 * y) % 4 == 0 else -1
            if idx >= 0:
                c.put_ramp(x, y, ramp, idx)
    return c
