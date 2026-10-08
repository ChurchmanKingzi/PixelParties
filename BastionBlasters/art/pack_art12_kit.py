"""pack_art12: kleine Helfer (Spiegeln, Funken, Flugbahnen, Pflasterfleck im Chaos-Boden)."""
from __future__ import annotations

import math
import random

import numpy as np

from pixl import *
from cards_art import ground_world
from assets_env import tile_cobble


def vflip(c: Canvas) -> Canvas:
    """senkrecht gespiegelt (Kopf nach unten)"""
    o = Canvas(c.w, c.h)
    o.px = c.px[::-1].copy()
    o.rid = c.rid[::-1].copy()
    return o


def plus(world: World, x, y, col='gold', i=5, key=9000):
    """kleiner Funke (Kreuz aus 5 Pixeln)"""
    for (dx, dy, k) in ((0, 0, i), (-1, 0, i - 1), (1, 0, i - 1), (0, -1, i - 1), (0, 1, i - 1)):
        if 0 <= x + dx < world.w and 0 <= y + dy < world.h:
            world.px[y + dy, x + dx, :3] = RAMPS[col][max(0, k)]
            world.depth[y + dy, x + dx] = key


def star4(world: World, x, y, col='gold', key=9000):
    """vierzackiger Stern (Glitzern), 7 x 7"""
    for d in range(-3, 4):
        i = 5 if abs(d) < 2 else 4 if abs(d) == 2 else 3
        for (px_, py_) in ((x + d, y), (x, y + d)):
            if 0 <= px_ < world.w and 0 <= py_ < world.h:
                world.px[py_, px_, :3] = RAMPS[col][i]
                world.depth[py_, px_] = key
    world.px[y, x, :3] = RAMPS['bone'][5]


def dot(world: World, x, y, col, i, key=9000):
    if 0 <= x < world.w and 0 <= y < world.h:
        world.px[int(y), int(x), :3] = RAMPS[col][i]
        world.depth[int(y), int(x)] = key


def arc_dots(world: World, p0, p1, lift, n=9, col='bone', i0=3, i1=5, key=9000, skip=0, big=True, step=2):
    """gestrichelte Flugbahn von p0 nach p1 (Bogen mit Scheitelhoehe `lift` nach oben); big = 2x2-Punkte mit dunklem Fuss"""
    for k in range(skip, n + 1):
        if k % step:
            continue
        t = k / n
        x = int(round(p0[0] + (p1[0] - p0[0]) * t))
        y = int(round(p0[1] + (p1[1] - p0[1]) * t - lift * 4 * t * (1 - t)))
        if big:
            for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1)):
                dot(world, x + dx, y + dy, col, i1 if (dx, dy) != (1, 1) else i0, key)
            dot(world, x + 2, y + 2, 'coal', 1, key - 1)
            dot(world, x + 1, y + 2, 'coal', 1, key - 1)
            dot(world, x + 2, y + 1, 'coal', 1, key - 1)
        else:
            dot(world, x, y, col, i1, key)
            dot(world, x + 1, y, col, i0, key)


def cobble_patch(world: World, cx, cy, rx, ry, seed=3, base='dirt'):
    """Pflasterfleck (Hof) auf beliebigem Boden, Rand mit Schachbrett-Dither"""
    tile = tile_cobble(seed, 32, base=base, tone=(3, 4), mortar=2, hi=5)
    Y, X = np.mgrid[0:world.h, 0:world.w]
    d = ((X + 0.5 - cx) / rx) ** 2 + ((Y + 0.5 - cy) / ry) ** 2
    chk = (X + Y) % 2 == 0
    m = (d < 0.82) | ((d < 1.0) & chk)
    tx = tile.px[(Y % 32), (X % 32), :3]
    world.px[:, :, :3][m] = tx[m]
    world.depth[m] = -100
    # Randschatten (dunkler Saum)
    rim = (d >= 0.82) & (d < 1.0) & ~chk
    world.px[:, :, :3][rim] = darken_palette(world.px[:, :, :3][rim], 1)


def disc(c: Canvas, cx, cy, r, ramp, lo, hi, ambient=0.2, **kw):
    ellipse(c, cx, cy, r, r, ramp, lo=lo, hi=hi, ambient=ambient, **kw)


def hline(c: Canvas, x0, x1, y, ramp, idx):
    for x in range(int(x0), int(x1) + 1):
        c.put_ramp(x, y, ramp, idx)


def vline(c: Canvas, x, y0, y1, ramp, idx):
    for y in range(int(y0), int(y1) + 1):
        c.put_ramp(x, y, ramp, idx)


def dither_rect(c: Canvas, x0, y0, x1, y1, ramp, a, b):
    """Schachbrett zweier Töne"""
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            c.put_ramp(x, y, ramp, a if (x + y) % 2 == 0 else b)


def stars_ring(world: World, cx, cy, rx, ry, n=4, phase=0.0, col='gold'):
    """Sternchen im Kreis um einen Kopf (Betäubung)"""
    for k in range(n):
        a = phase + k * 2 * math.pi / n
        x = int(round(cx + math.cos(a) * rx))
        y = int(round(cy + math.sin(a) * ry))
        plus(world, x, y, col, 5)


def rotate(c: Canvas, deg: float) -> Canvas:
    """Sprite drehen (Nearest-Neighbor, Leinwand waechst mit); deg > 0 = im Uhrzeigersinn"""
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    W = int(math.ceil(abs(c.w * ca) + abs(c.h * sa))) + 2
    H = int(math.ceil(abs(c.w * sa) + abs(c.h * ca))) + 2
    o = Canvas(W, H)
    cx, cy = c.w / 2.0, c.h / 2.0
    ox, oy = W / 2.0, H / 2.0
    for y in range(H):
        for x in range(W):
            dx, dy = x + 0.5 - ox, y + 0.5 - oy
            sx = dx * ca + dy * sa + cx
            sy = -dx * sa + dy * ca + cy
            ix, iy = int(math.floor(sx)), int(math.floor(sy))
            if 0 <= ix < c.w and 0 <= iy < c.h and c.px[iy, ix, 3] > 0:
                o.px[y, x] = c.px[iy, ix]
                o.rid[y, x] = c.rid[iy, ix]
    return o


def speed_lines(world: World, x, y, n=3, length=9, col='bone', i=4, dy=3, key=9000):
    """Fahrtlinien nach links ab (x, y)"""
    for k in range(n):
        yy = y + (k - (n - 1) / 2.0) * dy
        for j in range(length - k * 2):
            dot(world, int(x - j), int(round(yy)), col, i if j % 3 else i + 1, key)
