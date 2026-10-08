"""pack_art3 Hilfsfunktionen (gemeinsam fuer die Sprites und Dioramen von US-11 .. US-23)."""
from __future__ import annotations

import math
import random

from cards_art import *

_LK = {}


def _lookup():
    if not _LK:
        for name, ramp in RAMPS.items():
            for i, col in enumerate(ramp):
                _LK.setdefault(tuple(int(v) for v in col), (name, i))
    return _LK


def ramp_of(cv, x, y):
    """(Rampenname, Index) des Pixels oder None"""
    if not cv.alpha(x, y):
        return None
    return _lookup().get(tuple(int(v) for v in cv.px[y, x, :3]))


def recolor(cv, fn):
    """Pixel auf (Rampe, Index) umsetzen: fn(name, idx) -> (name, idx) | None. Bleibt in der Master-Palette."""
    out = cv.copy()
    for y in range(cv.h):
        for x in range(cv.w):
            r = ramp_of(cv, x, y)
            if r is not None:
                n = fn(*r)
                if n:
                    out.put_ramp(x, y, n[0], n[1])
    return out


def dither_cut(cv, phase=0):
    """Schachbrett-Loecher (Tarnung / Schimmer): jedes zweite Pixel wird durchsichtig"""
    out = cv.copy()
    for y in range(cv.h):
        for x in range(cv.w):
            if (x + y) % 2 == phase:
                out.clear_pixel(x, y)
    return out


def bezier(p0, p1, p2, p3, n=12):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u ** 3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t ** 3 * p3[0]
        y = u ** 3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t ** 3 * p3[1]
        pts.append((x, y))
    return pts


def strand(c, pts, w, ramp, lo=1, hi=4, ambient=0.3):
    """Linienzug aus schattierten Segmenten (Nudel, Schweif, Zuegel)"""
    for (a, b) in zip(pts[:-1], pts[1:]):
        thick_line(c, a[0], a[1], b[0], b[1], w, ramp, lo=lo, hi=hi, ambient=ambient)


def puff(c, cx, cy, r, ramp='bone', lo=2, hi=5, seed=1):
    """kleine Dampf- / Staubwolke aus drei Kugeln"""
    rnd = random.Random(seed)
    ellipse(c, cx - r * 0.5, cy + r * 0.2, r * 0.7, r * 0.6, ramp, lo=lo, hi=hi - 1, ambient=0.25)
    ellipse(c, cx + r * 0.55, cy + r * 0.25, r * 0.65, r * 0.55, ramp, lo=lo, hi=hi - 1, ambient=0.25)
    ellipse(c, cx + rnd.choice((-0.2, 0.2)) * r, cy - r * 0.25, r * 0.75, r * 0.65, ramp, lo=lo, hi=hi, ambient=0.25)


def tri(c, a, b, wa, ramp, lo, hi, flat=None):
    """Spitzkegel (Karotte, Dorn, Klinge): breit bei a, Spitze bei b"""
    dx, dy = b[0] - a[0], b[1] - a[1]
    ln = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / ln, dx / ln
    h = wa / 2.0
    pts = [(a[0] + nx * h, a[1] + ny * h), (a[0] - nx * h, a[1] - ny * h), (b[0], b[1])]
    poly(c, pts, ramp, lo=lo, hi=hi, flat=flat)


def blade(c, a, b, w, ramp='metal', lo=2, hi=5):
    """gerade Klinge als schmales Polygon mit Spitze"""
    dx, dy = b[0] - a[0], b[1] - a[1]
    ln = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / ln, dx / ln
    h = w / 2.0
    tip = (b[0] + dx / ln * w, b[1] + dy / ln * w)
    pts = [(a[0] + nx * h, a[1] + ny * h), (b[0] + nx * h, b[1] + ny * h), tip, (b[0] - nx * h, b[1] - ny * h),
           (a[0] - nx * h, a[1] - ny * h)]
    poly(c, pts, ramp, lo=lo, hi=hi)


def gear(c, cx, cy, r, ramp='gold', lo=1, hi=4, teeth=8, hole=True, phase=0.0):
    """Zahnrad: Kugel mit Zacken"""
    for k in range(teeth):
        a = phase + k * 2 * math.pi / teeth
        x, y = cx + math.cos(a) * (r + 0.9), cy + math.sin(a) * (r + 0.9)
        c.put_ramp(int(round(x)), int(round(y)), ramp, lo + 1 if math.cos(a) + math.sin(a) < 0 else hi)
    ellipse(c, cx, cy, r, r, ramp, lo=lo, hi=hi, ambient=0.3)
    if hole:
        c.put_ramp(int(cx), int(cy), ramp, 0)


def put_world(world, x, y, ramp, idx, depth=9000):
    if 0 <= x < world.w and 0 <= y < world.h:
        world.px[y, x, :3] = RAMPS[ramp][idx]
        world.depth[y, x] = depth


def dot_world(world, pts, ramp, idx, depth=9000):
    for (x, y) in pts:
        put_world(world, int(x), int(y), ramp, idx, depth)


def sprite_at(world, spr, x, y, key=None, flip=False):
    """Sprite mit seiner linken oberen Ecke bei (x, y) zeichnen (fuer Flieger und Geschosse)"""
    world.draw(spr, int(x), int(y), int(y + spr.h) if key is None else key, flip)


def cross_spark(world, x, y, ramp='gold', depth=9000):
    for (dx, dy, i) in ((0, 0, 5), (-1, 0, 4), (1, 0, 4), (0, -1, 4), (0, 1, 4)):
        put_world(world, x + dx, y + dy, ramp, i, depth)


def star_spark(world, x, y, ramp='gold', depth=9000, big=False):
    cross_spark(world, x, y, ramp, depth)
    if big:
        for (dx, dy) in ((-2, 0), (2, 0), (0, -2), (0, 2)):
            put_world(world, x + dx, y + dy, ramp, 3, depth)


def ring_world(world, cx, cy, rx, ry, ramp='dirt', idx=5, idx2=4, depth=8000, chk=True):
    """Staub- / Stampfring auf dem Boden (Ellipse, Schachbrett)"""
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            if abs(d - 1.0) < 0.16 and (not chk or (x + y) % 2 == 0):
                put_world(world, x, y, ramp, idx if (x + y) % 4 else idx2, depth)


def gravestone(kind=0):
    c = Canvas(16, 22)
    if kind == 0:
        round_rect(c, 2, 2, 13, 19, 'stone', lo=1, hi=4, radius=5)
        c.rect(2, 16, 13, 19, 'stone', 2)
    else:
        round_rect(c, 3, 6, 12, 19, 'stone', lo=1, hi=4, radius=1)
        c.rect(6, 1, 9, 12, 'stone', 3)
        c.rect(3, 6, 12, 8, 'stone', 3)
        c.rect(6, 1, 6, 12, 'stone', 4)
        c.rect(3, 6, 3, 8, 'stone', 4)
    c.rect(4, 18, 11, 19, 'stone', 1)
    for (x, y) in ((6, 6), (7, 6), (6, 7), (9, 12), (10, 13), (5, 15)):
        c.put_ramp(x, y, 'stone', 5 if x < 8 else 1)
    c.put_ramp(8, 19, 'grass', 2)
    c.put_ramp(11, 19, 'grass', 3)
    c.outline()
    return c


def dead_tree(seed=1):
    c = Canvas(30, 44)
    rnd = random.Random(seed)
    thick_line(c, 15, 43, 15, 22, 5, 'wood', lo=0, hi=3)
    thick_line(c, 15, 28, 6, 14, 3, 'wood', lo=0, hi=3)
    thick_line(c, 15, 24, 24, 10, 3, 'wood', lo=1, hi=4)
    thick_line(c, 15, 22, 16, 5, 3, 'wood', lo=1, hi=4)
    thick_line(c, 6, 14, 3, 8, 2, 'wood', lo=0, hi=3)
    thick_line(c, 24, 10, 28, 5, 2, 'wood', lo=1, hi=4)
    thick_line(c, 10, 21, 5, 22, 2, 'wood', lo=0, hi=3)
    c.rect(12, 40, 18, 43, 'wood', 1)
    c.outline()
    return c


def cone(c, a, b, wa, ramp, lo=2, hi=5, ambient=0.25):
    """schattierter Kegel (Karotte, Horn, Zahn): breit bei a, Spitze bei b; Licht von links oben quer zur Achse"""
    dx, dy = b[0] - a[0], b[1] - a[1]
    ln = math.hypot(dx, dy) or 1.0
    ux, uy = dx / ln, dy / ln
    nx, ny = -uy, ux
    if nx * LIGHT[0] + ny * LIGHT[1] < 0:
        nx, ny = -nx, -ny
    rid = RAMP_ID[ramp]
    r = wa / 2.0
    for y in range(int(min(a[1], b[1]) - r - 1), int(max(a[1], b[1]) + r + 2)):
        for x in range(int(min(a[0], b[0]) - r - 1), int(max(a[0], b[0]) + r + 2)):
            qx, qy = x + 0.5 - a[0], y + 0.5 - a[1]
            t = (qx * ux + qy * uy) / ln
            if t < 0 or t > 1:
                continue
            s = qx * nx + qy * ny
            h = max(1.0, r * (1 - t * 0.85))
            if abs(s) > h:
                continue
            k = s / h                      # +1 = Lichtseite
            L = ambient + (1 - ambient) * (0.5 + 0.5 * k) ** 0.8
            c.put(x, y, RAMPS[ramp][quant(L, lo, hi, x, y)], rid)


def rim_arc(c, cx, cy, rx, ry, ramp, idx, a0, a1, only_inside=True):
    """Bogen aus Pixeln (Winkel in Grad, y nach unten) - Trennlinie zwischen uebereinanderliegenden Kugeln"""
    n = int(abs(a1 - a0) * max(rx, ry) / 25) + 6
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        x, y = int(round(cx + math.cos(a) * rx)), int(round(cy + math.sin(a) * ry))
        if (not only_inside) or c.alpha(x, y):
            c.put_ramp(x, y, ramp, idx)


def strand_taper(c, pts, w0, w1, ramp, lo=1, hi=4, ambient=0.3):
    """wie strand, aber die Breite wechselt linear von w0 (Anfang) nach w1 (Ende)"""
    n = len(pts) - 1
    for i, (a, b) in enumerate(zip(pts[:-1], pts[1:])):
        w = w0 + (w1 - w0) * (i + 0.5) / max(1, n)
        thick_line(c, a[0], a[1], b[0], b[1], w, ramp, lo=lo, hi=hi, ambient=ambient)
