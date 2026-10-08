"""pack_art2: Welt-Effekte fuer die Dioramen (Feuerschweif, Lichtstrahl, Staub, Tempo-Striche, Bogenpunkte, Muendungsfeuer)."""
from __future__ import annotations

import math
import random

import numpy as np

from pixl import *
from pack_art2_kit import *


def _put(world, x, y, ramp, idx, key):
    if 0 <= x < world.w and 0 <= y < world.h:
        world.px[y, x, :3] = RAMPS[ramp][idx]
        world.depth[y, x] = key


def fire_tail(world, hx, hy, dx, dy, length, width, key=9000, seed=1):
    """Feuerschweif hinter einem Meteor: Kopf bei (hx, hy), fliegt in Richtung (dx, dy), Schweif zeigt entgegen"""
    ln = math.hypot(dx, dy)
    ux, uy = -dx / ln, -dy / ln                    # Schweifrichtung
    nx, ny = -uy, ux
    rnd = random.Random(seed)
    x0, x1 = int(min(hx, hx + ux * length) - width), int(max(hx, hx + ux * length) + width)
    y0, y1 = int(min(hy, hy + uy * length) - width), int(max(hy, hy + uy * length) + width)
    for y in range(max(0, y0), min(world.h, y1 + 1)):
        for x in range(max(0, x0), min(world.w, x1 + 1)):
            px, py = x + 0.5 - hx, y + 0.5 - hy
            t = px * ux + py * uy
            if t < 0 or t > length:
                continue
            s = abs(px * nx + py * ny)
            wt = width * (1 - t / length) ** 0.8 + 0.8
            wob = 0.8 * (((x * 7 + y * 13) % 5) - 2) / 2.0
            r = (s + wob) / (wt / 2.0)
            if r > 1.0:
                continue
            f = t / length
            chk = (x + y) % 2 == 0
            if r < 0.35 and f < 0.55:
                _put(world, x, y, 'bone', 5, key)
            elif r < 0.45 and f < 0.8:
                _put(world, x, y, 'gold', 5 if f < 0.4 else 4, key)
            elif r < 0.7:
                _put(world, x, y, 'gold' if f < 0.45 else 'fire', 4 if f < 0.7 else 3, key)
            elif chk:
                _put(world, x, y, 'fire', 4 if f < 0.5 else 3, key)
            else:
                _put(world, x, y, 'fire', 2, key)
    for k in range(10):                             # Funken neben dem Schweif
        t = rnd.uniform(0.1, 0.9) * length
        s = rnd.uniform(-1, 1) * (width * (1 - t / length) * 0.9 + 3)
        _put(world, int(hx + ux * t + nx * s), int(hy + uy * t + ny * s), 'gold', 5 if k % 2 else 4, key)


def light_beam(world, cx, y0, y1, w0=8, w1=18, key=8500):
    """heller Lichtstrahl von oben: Kern weiss, Rand Schachbrett, Boden bleibt als Fleck sichtbar"""
    for y in range(max(0, y0), min(world.h, y1 + 1)):
        t = (y - y0) / max(1, (y1 - y0))
        half = (w0 + (w1 - w0) * t) / 2.0
        for x in range(int(cx - half - 2), int(cx + half + 3)):
            if not (0 <= x < world.w):
                continue
            d = abs(x + 0.5 - cx)
            chk = (x + y) % 2 == 0
            if d < half * 0.45:
                _put(world, x, y, 'bone', 5, key)
            elif d < half * 0.8:
                _put(world, x, y, 'bone', 5 if chk else 4, key)
            elif d < half:
                if chk:
                    _put(world, x, y, 'sky', 5, key)
            elif d < half + 1.5 and chk and y % 2 == 0:
                _put(world, x, y, 'sky', 5, key)


def dust(world, cx, cy, r, ramp='dirt', lo=3, hi=5, seed=1, key=8000):
    c = Canvas(int(r * 2 + 6), int(r * 1.6 + 6))
    puff(c, c.w / 2, c.h / 2, r, ramp, lo, hi, seed)
    c.outline(dark=max(0, lo - 1), lit=hi)
    world.draw(c, int(cx - c.w / 2), int(cy - c.h / 2), key)


def speed_lines(world, x, y, n=3, length=10, seed=1, ramp='bone', idx=4, key=8000, gap=3):
    rnd = random.Random(seed)
    for k in range(n):
        yy = y + k * gap + rnd.randint(-1, 1)
        ln = length + rnd.randint(-3, 3)
        x0 = x - rnd.randint(0, 4)
        for i in range(ln):
            _put(world, x0 - i, yy, ramp, idx if i < ln - 3 else max(1, idx - 1), key)


def arc_dots(world, p0, p1, height, n=9, ramp='bone', idx=5, key=8000, skip=0):
    """gepunkteter Wurfbogen von p0 nach p1 mit Scheitelhoehe `height` (nach oben)"""
    for k in range(skip, n + 1):
        t = k / n
        x = p0[0] + (p1[0] - p0[0]) * t
        y = p0[1] + (p1[1] - p0[1]) * t - height * 4 * t * (1 - t)
        _put(world, int(x), int(y), ramp, idx if k % 2 else idx - 1, key)
        if k % 2 == 0:
            _put(world, int(x) + 1, int(y), ramp, idx - 1, key)


def burst(world, cx, cy, r=7, key=9100):
    """Muendungsfeuer / Einschlagblitz: Stern aus Gold, Weiss und Feuer"""
    for ang in range(0, 360, 45):
        a = math.radians(ang)
        ln = r if ang % 90 == 0 else r * 0.65
        for i in range(0, int(ln) + 1):
            x, y = int(round(cx + math.cos(a) * i)), int(round(cy + math.sin(a) * i))
            f = i / max(1.0, ln)
            _put(world, x, y, 'bone' if f < 0.3 else ('gold' if f < 0.65 else 'fire'), 5 if f < 0.65 else 4, key)
    for dx in range(-2, 3):
        for dy in range(-2, 3):
            if dx * dx + dy * dy <= 5:
                _put(world, int(cx) + dx, int(cy) + dy, 'bone' if dx * dx + dy * dy <= 2 else 'gold', 5, key + 1)


def sparkles(world, pts, ramp='gold', key=9100):
    for (x, y) in pts:
        for (dx, dy, i) in ((0, 0, 5), (-1, 0, 4), (1, 0, 4), (0, -1, 4), (0, 1, 4)):
            _put(world, x + dx, y + dy, ramp, i, key)


def drops(world, pts, ramp='sky', idx=5, key=9000):
    for (x, y) in pts:
        _put(world, x, y, ramp, idx, key)
        _put(world, x, y + 1, ramp, idx - 1, key)


def blob_shadow(world, cx, cy, rx, ry, steps=2):
    """Schachbrett-Schatten auf Bodenpixeln (wie scenekit.shadow, aber eigene Tiefe-Schwelle)"""
    x0, x1 = max(0, int(cx - rx - 1)), min(world.w, int(cx + rx + 2))
    y0, y1 = max(0, int(cy - ry - 1)), min(world.h, int(cy + ry + 2))
    Y, X = np.mgrid[y0:y1, x0:x1]
    d = ((X + 0.5 - cx) / rx) ** 2 + ((Y + 0.5 - cy) / ry) ** 2
    m = (d <= 1.0) & ((d < 0.5) | ((X + Y) % 2 == 0)) & (world.depth[y0:y1, x0:x1] < -40)
    sub = world.px[y0:y1, x0:x1, :3]
    sub[m] = darken_palette(sub[m], steps)
