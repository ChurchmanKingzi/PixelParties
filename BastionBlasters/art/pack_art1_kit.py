"""pack_art1: gemeinsame Helfer (Rauch, Funken, Räder, Flugbahnen, Zielmarker) für die Artillerie-Karten UA-02 .. UA-13."""
from __future__ import annotations

import math
import random

from cards_art import *


# --------------------------------------------------------------------------- kleine Effekte in Sprites


def puff(c, cx, cy, r, ramp='stone', lo=2, hi=5):
    """Rauch-/Wolkenball (flach schattiert)"""
    ellipse(c, cx, cy, r, r * 0.88, ramp, lo=lo, hi=hi, ambient=0.3)


def smoke_column(c, x, y, n=3, seed=1, ramp='stone', lo=2, hi=5, r0=1.6, rise=4, drift=-1):
    """aufsteigender Rauch: n Bälle, nach oben größer, seitlich versetzt"""
    rnd = random.Random(seed)
    for k in range(n):
        r = r0 + k * 0.55
        px = x + drift * k + rnd.randint(-1, 1) + (1 if k % 2 else 0)
        py = y - k * rise
        puff(c, px, py, r, ramp, lo, hi)


def sparkle(c, x, y, ramp='gold', idx=5):
    """kleiner Funke: Kreuz mit hellem Zentrum"""
    c.put_ramp(x, y, ramp, 5)
    for (dx, dy) in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        c.put_ramp(x + dx, y + dy, ramp, idx - 1)


def spoked_wheel(c, cx, cy, r=6.0, ramp='wood', hub='metal', spokes=6, phase=30):
    ellipse(c, cx, cy, r, r, ramp, lo=1, hi=4)
    ellipse(c, cx, cy, r * 0.58, r * 0.58, ramp, lo=0, hi=2)
    for k in range(spokes):
        a = math.radians(k * 360 / spokes + phase)
        c.put_ramp(cx + int(round(math.cos(a) * (r - 1))), cy + int(round(math.sin(a) * (r - 1))), ramp, 1)
        c.put_ramp(cx + int(round(math.cos(a) * r * 0.55)), cy + int(round(math.sin(a) * r * 0.55)), ramp, 4)
    ellipse(c, cx, cy, max(1.2, r * 0.3), max(1.2, r * 0.3), hub, lo=2, hi=5)


def band(c, x0, x1, y, ramp='metal', lo=1, hi=3):
    """Reif (waagrechte Linie mit Licht links)"""
    for x in range(x0, x1 + 1):
        c.put_ramp(x, y, ramp, hi if x < x0 + (x1 - x0) // 3 else lo)


def zigzag_hem(c, x0, x1, y, ramp, idx_a=1, idx_b=2):
    """gezackter Saum"""
    for x in range(x0, x1 + 1):
        c.put_ramp(x, y + (x % 2), ramp, idx_a if x % 2 else idx_b)


def dither_fill(c, pts, ramp, a, b):
    """Schachbrett zwischen zwei Tönen über eine Punktliste"""
    for (x, y) in pts:
        c.put_ramp(x, y, ramp, a if (x + y) % 2 == 0 else b)


# --------------------------------------------------------------------------- Szenen-Helfer (Welt, 144 x 96)


def arc_pts(x0, y0, x1, y1, height, n):
    """Parabelbahn von (x0,y0) nach (x1,y1), Scheitel `height` Pixel über der Geraden"""
    pts = []
    for k in range(n + 1):
        t = k / n
        pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - 4 * height * t * (1 - t)))
    return pts


def dot_world(world, x, y, ramp='bone', idx=5, size=2, key=9000):
    d = Canvas(size, size)
    d.rect(0, 0, size - 1, size - 1, ramp, idx)
    world.draw(d, int(x - size // 2), int(y - size // 2), key)


def trail(world, pts, ramp='bone', every=1, size=2, hi=5, lo=3):
    """gepunktete Spur entlang pts; hinten dunkler, vorn heller"""
    n = len(pts)
    for k, (x, y) in enumerate(pts):
        if k % every:
            continue
        idx = lo if k < n * 0.45 else hi
        dot_world(world, x, y, ramp, idx, size, 9000 - (n - k))


def put(world, spr, cx, cy, key=9000, flip=False):
    """Sprite mit Mittelpunkt (cx, cy) in die Welt (über allem)"""
    world.draw(spr, int(cx - spr.w // 2), int(cy - spr.h // 2), key, flip)


def put_px(world, x, y, ramp, idx, key=9100):
    if 0 <= int(x) < world.w and 0 <= int(y) < world.h:
        world.px[int(y), int(x), :3] = RAMPS[ramp][idx]
        world.px[int(y), int(x), 3] = 255
        world.depth[int(y), int(x)] = key


def burst(world, x, y, ramp='fire', n=8, r=5, seed=1, key=9100):
    """Funkenstern: Strahlen um (x, y)"""
    rnd = random.Random(seed)
    for k in range(n):
        a = k * 2 * math.pi / n + rnd.random() * 0.4
        d = r * (0.6 + 0.5 * rnd.random())
        put_px(world, x + math.cos(a) * d, y + math.sin(a) * d, ramp, 5 if k % 2 else 4, key)
        put_px(world, x + math.cos(a) * d * 0.55, y + math.sin(a) * d * 0.55, ramp, 4, key)
    put_px(world, x, y, ramp, 5, key)


def ground_ring(world, cx, cy, rx, ry, ramp='ice', phase=0, key=-30):
    """Zielmarker (Ellipse, Schachbrettring) in Eisfarben o.ä. - liegt auf dem Boden"""
    x0, x1 = max(0, int(cx - rx - 3)), min(world.w, int(cx + rx + 4))
    y0, y1 = max(0, int(cy - ry - 3)), min(world.h, int(cy + ry + 4))
    for y in range(y0, y1):
        for x in range(x0, x1):
            d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
            if world.depth[y, x] >= -40:
                continue
            if abs(d - 1.0) * min(rx, ry) < 1.2:
                world.px[y, x, :3] = RAMPS[ramp][5 if (x + y) % 2 == 0 else 4]
            elif d < 0.99 and ((x % 3 == 0 and y % 3 == 0) or (d > 0.7 and (x + y) % 2 == 0)):
                world.px[y, x, :3] = RAMPS[ramp][2]
            elif d < 0.12:
                world.px[y, x, :3] = RAMPS[ramp][5]


# --------------------------------------------------------------------------- Rohre und Achsen


def axis_pts(ox, oy, ux, uy, pts):
    """Punkte in (längs, quer)-Koordinaten einer Achse (Ursprung ox,oy; Richtung ux,uy) in Bildkoordinaten umrechnen.
    quer zeigt nach unten/rechts (Normale = (-uy, ux) bzw. so, dass sie für nach rechts oben zeigende Achsen nach unten zeigt)."""
    ln = math.hypot(ux, uy) or 1.0
    ux, uy = ux / ln, uy / ln
    nx, ny = -uy, ux
    if ny < 0:
        nx, ny = -nx, -ny
    return [(ox + ux * a + nx * b, oy + uy * a + ny * b) for (a, b) in pts]


def barrel_tube(c, x0, y0, x1, y1, w, ramp='gold', lo=1, hi=4, bands=(), band_ramp=None, flare=None, flare_len=7, cap=None):
    """Kanonenrohr von (x0,y0) (Bodenstück) nach (x1,y1) (Mündung). bands: Positionen 0..1 für Reifen,
    flare=(Mündungsbreite) für eine Trichtermündung, cap=(Radius) für ein Kugelende hinten."""
    thick_line(c, x0, y0, x1, y1, w, ramp, lo=lo, hi=hi)
    ux, uy = x1 - x0, y1 - y0
    ln = math.hypot(ux, uy)
    for t in bands:
        bx, by = x0 + ux * t, y0 + uy * t
        for (a, b, idx) in ((0, w * 0.5 + 0.3, 1), (1, w * 0.5 + 0.3, 2)):
            pass
        p0, p1 = axis_pts(bx, by, ux, uy, [(0, -w / 2 - 0.5), (0, w / 2 + 0.5)])
        c.line(p0[0], p0[1], p1[0], p1[1], band_ramp or ramp, 5 if hi >= 4 else hi)
        q0, q1 = axis_pts(bx, by, ux, uy, [(1.4, -w / 2 - 0.5), (1.4, w / 2 + 0.5)])
        c.line(q0[0], q0[1], q1[0], q1[1], band_ramp or ramp, max(0, lo - 1))
    if flare:
        pts = axis_pts(x1, y1, ux, uy, [(-flare_len, -w / 2 + 0.2), (1.5, -flare / 2), (1.5, flare / 2), (-flare_len, w / 2 - 0.2)])
        poly(c, pts, ramp, lo=lo, hi=hi)
        r0, r1 = axis_pts(x1, y1, ux, uy, [(1.5, -flare / 2), (1.5, flare / 2)])
        c.line(r0[0], r0[1], r1[0], r1[1], ramp, 5 if hi >= 4 else hi)
    if cap:
        ellipse(c, x0 - ux / ln * 1.5, y0 - uy / ln * 1.5, cap, cap, ramp, lo=lo, hi=hi)


def wheel2(c, cx, cy, r=7.0, ramp='wood', hub='metal', spokes=6, phase=15):
    """Speichenrad: heller Felgenring, dunkles Inneres, helle Speichen, Metallnabe"""
    ellipse(c, cx, cy, r, r, ramp, lo=1, hi=4)
    ellipse(c, cx, cy, max(1.0, r - 2.0), max(1.0, r - 2.0), ramp, lo=0, hi=1, ambient=0.1)
    for k in range(spokes):
        a = math.radians(k * 360 / spokes + phase)
        x1, y1 = cx + math.cos(a) * (r - 1.6), cy + math.sin(a) * (r - 1.6)
        c.line(cx, cy, int(round(x1)), int(round(y1)), ramp, 4 if math.cos(a) + math.sin(a) < 0.3 else 3)
    ellipse(c, cx, cy, max(1.5, r * 0.28), max(1.5, r * 0.28), hub, lo=1, hi=5)
