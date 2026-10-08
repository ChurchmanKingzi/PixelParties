"""pack_art11: gemeinsame Hilfen (Palette-treues Aufhellen, Glanz, Rauch, Blasen, Szenenhelfer).
Dieses Modul registriert keine Karten."""
from __future__ import annotations

import math
import random

import numpy as np

from cards_art import *      # noqa: F401,F403  (pixl, scenekit, landscape, assets_*, castle, ground_world, unit_at, ...)

_LIGHT_CACHE = {}


def _code(c):
    return (int(c[0]) << 16) | (int(c[1]) << 8) | int(c[2])


def _lut():
    if 'lut' not in _LIGHT_CACHE:
        where = {}
        for name, ramp in RAMPS.items():
            for i, col in enumerate(ramp):
                where.setdefault(_code(col), (name, i))
        _LIGHT_CACHE['lut'] = where
        _LIGHT_CACHE['pal'] = np.array(list(where.keys()), np.int64)
    return _LIGHT_CACHE['lut'], _LIGHT_CACHE['pal']


def shift_palette(rgb, steps):
    """Rampenstufen verschieben (steps > 0 heller, < 0 dunkler), bleibt in der Master-Palette"""
    where, pal = _lut()
    flat = rgb.reshape(-1, 3)
    codes = (flat[:, 0].astype(np.int64) << 16) | (flat[:, 1].astype(np.int64) << 8) | flat[:, 2].astype(np.int64)
    uniq, inv = np.unique(codes, return_inverse=True)
    mapped = np.zeros((len(uniq), 3), np.uint8)
    for k, u in enumerate(uniq):
        u = int(u)
        if u not in where:
            r, g, b = (u >> 16) & 255, (u >> 8) & 255, u & 255
            d = ((pal >> 16) & 255) - r
            d = d * d + (((pal >> 8) & 255) - g) ** 2 + ((pal & 255) - b) ** 2
            u = int(pal[int(np.argmin(d))])
        name, i = where[u]
        mapped[k] = RAMPS[name][max(0, min(5, i + steps))]
    return mapped[inv.reshape(-1)].reshape(rgb.shape)


def lighten_disc(world, cx, cy, r, steps=1, ring=0.35, key_min=None):
    """Kreisfoermiger Lichtschein: innen `steps` Stufen heller, am Rand Schachbrett-Dither"""
    x0, x1 = max(0, int(cx - r - 1)), min(world.w, int(cx + r + 2))
    y0, y1 = max(0, int(cy - r - 1)), min(world.h, int(cy + r + 2))
    if x1 <= x0 or y1 <= y0:
        return
    Y, X = np.mgrid[y0:y1, x0:x1]
    d = np.hypot(X + 0.5 - cx, Y + 0.5 - cy) / float(r)
    chk = ((X + Y) % 2 == 0)
    inner = d < (1.0 - ring)
    edge = (d >= (1.0 - ring)) & (d < 1.0) & chk
    m = inner | edge
    sub = world.px[y0:y1, x0:x1, :3]
    sub[m] = shift_palette(sub[m], steps)


def shade_mask(world, mask, steps):
    """Maske (bool, Weltgroesse) um `steps` Stufen aufhellen/abdunkeln"""
    sub = world.px[:, :, :3]
    if mask.any():
        sub[mask] = shift_palette(sub[mask], steps)


def dim_world(world, steps=1):
    sub = world.px[:, :, :3]
    sub[:] = shift_palette(sub, -steps)


def px_at(world, x, y, ramp, idx, key=9000):
    if 0 <= x < world.w and 0 <= y < world.h:
        world.px[y, x, :3] = RAMPS[ramp][idx]
        world.depth[y, x] = max(int(world.depth[y, x]), key) if key is not None else world.depth[y, x]


def star(world, x, y, ramp='gold', big=False, key=9500):
    """kleiner Glitzerstern (Kreuz); big = mit Diagonalen"""
    pts = [(0, 0, 5), (-1, 0, 4), (1, 0, 4), (0, -1, 4), (0, 1, 4)]
    if big:
        pts += [(0, -2, 3), (0, 2, 3), (-2, 0, 3), (2, 0, 3)]
    for dx, dy, i in pts:
        px_at(world, x + dx, y + dy, ramp, i, key)


def dot_trail(world, pts, ramp='bone', idx=5, key=9000):
    for (x, y) in pts:
        px_at(world, int(x), int(y), ramp, idx, key)


def arc_points(x0, y0, x1, y1, height, n):
    """Parabelbogen von (x0,y0) nach (x1,y1), height = Scheitelhoehe ueber der Sehne (px)"""
    out = []
    for k in range(n + 1):
        t = k / float(n)
        out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - height * 4 * t * (1 - t)))
    return out


def ball(r=4, ramp='stone', lo=0, hi=5):
    """Kugel mit Umriss (Kanonenkugel / Stein)"""
    d = int(r * 2 + 3)
    c = Canvas(d, d)
    ellipse(c, d / 2.0, d / 2.0, r, r, ramp, lo=lo, hi=hi)
    c.outline()
    return c


def smoke_puff(c, cx, cy, r, ramp='cloth', lo=1, hi=5, ambient=0.15):
    ellipse(c, cx, cy, r, r * 0.88, ramp, lo=lo, hi=hi, ambient=ambient)


def dither_fill_mask(c, mask_fn, ramp, idx, bounds, phase=0):
    """Schachbrettfuellung in einer Form (transparent wirkend)"""
    x0, y0, x1, y1 = bounds
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            if (x + y + phase) % 2 == 0 and mask_fn(x, y):
                c.put_ramp(x, y, ramp, idx)


def hatch_rows(c, x0, x1, y, ramp, idx_a, idx_b):
    for x in range(x0, x1 + 1):
        c.put_ramp(x, y, ramp, idx_a if x % 2 else idx_b)


def rivet(c, x, y):
    c.put_ramp(x, y, 'metal', 5)
    c.put_ramp(x + 1, y + 1, 'metal', 1)


def tile_rgb_of(cv):
    return cv.px[:, :, :3].copy()


def flat_floor(kind, seed=1):
    """kleine Bodenkacheln fuer Raum-Themen (32x32x3)"""
    rnd = random.Random(seed)
    c = Canvas(32, 32)
    if kind == 'steel':
        # genietete Stahlplatten 16x16
        for py in range(2):
            for px in range(2):
                x0, y0 = px * 16, py * 16
                base = 2 if (px + py) % 2 == 0 else 3
                for y in range(16):
                    for x in range(16):
                        idx = base
                        if y == 15 or x == 15:
                            idx = 0
                        elif y == 0 or x == 0:
                            idx = 4
                        elif texture_noise(x0 + x, y0 + y, seed) > 0.92:
                            idx = base - 1
                        c.put_ramp(x0 + x, y0 + y, 'metal', idx)
                for (rx, ry) in ((3, 3), (11, 3), (3, 11), (11, 11)):
                    c.put_ramp(x0 + rx, y0 + ry, 'metal', 5)
                    c.put_ramp(x0 + rx + 1, y0 + ry + 1, 'metal', 1)
    elif kind == 'checker':
        for y in range(32):
            for x in range(32):
                dark = ((x // 8) + (y // 8)) % 2 == 0
                if dark:
                    idx = 2
                    if y % 8 == 0 or x % 8 == 0:
                        idx = 3
                    elif y % 8 == 7 or x % 8 == 7:
                        idx = 1
                else:
                    idx = 4
                    if y % 8 == 0 or x % 8 == 0:
                        idx = 5
                    elif y % 8 == 7 or x % 8 == 7:
                        idx = 3
                if texture_noise(x, y, seed) > 0.94:
                    idx = max(1, idx - 1)
                c.put_ramp(x, y, 'stone', idx)
    elif kind == 'crystal':
        for y in range(32):
            for x in range(32):
                dark = ((x // 8) + (y // 8)) % 2 == 0
                idx = 1 if dark else 2
                if y % 8 == 0 or x % 8 == 0:
                    idx += 1
                elif y % 8 == 7 or x % 8 == 7:
                    idx = 0
                if texture_noise(x, y, seed) > 0.95:
                    idx = min(4, idx + 1)
                c.put_ramp(x, y, 'purple', idx)
    return tile_rgb_of(c)
