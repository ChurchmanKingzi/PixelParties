"""pack_art2: gemeinsame Zeichen-Helfer (Masken, organische Schattierung, kleine Effekte).

Nur Master-Palette (pixl.RAMPS), deterministisch, kein Zufall ohne Seed.
"""
from __future__ import annotations

import math
import random

import numpy as np
from PIL import Image, ImageDraw

from pixl import *


# --------------------------------------------------------------------------- Masken


def m_new(c):
    return np.zeros((c.h, c.w), bool)


def m_ellipse(c, cx, cy, rx, ry):
    Y, X = np.mgrid[0:c.h, 0:c.w]
    return (((X + 0.5 - cx) / rx) ** 2 + ((Y + 0.5 - cy) / ry) ** 2) <= 1.0


def m_ellipse_rot(c, cx, cy, rx, ry, deg):
    Y, X = np.mgrid[0:c.h, 0:c.w]
    a = math.radians(deg)
    dx, dy = X + 0.5 - cx, Y + 0.5 - cy
    u = dx * math.cos(a) + dy * math.sin(a)
    v = -dx * math.sin(a) + dy * math.cos(a)
    return ((u / rx) ** 2 + (v / ry) ** 2) <= 1.0


def m_poly(c, pts):
    im = Image.new('L', (c.w, c.h), 0)
    ImageDraw.Draw(im).polygon([(float(x), float(y)) for (x, y) in pts], fill=255)
    return np.asarray(im) > 0


def m_line(c, x0, y0, x1, y1, width):
    Y, X = np.mgrid[0:c.h, 0:c.w]
    px, py = X + 0.5, Y + 0.5
    dx, dy = x1 - x0, y1 - y0
    ln2 = dx * dx + dy * dy or 1.0
    t = np.clip(((px - x0) * dx + (py - y0) * dy) / ln2, 0, 1)
    d = np.hypot(px - (x0 + t * dx), py - (y0 + t * dy))
    return d <= width / 2.0


def m_profile(c, x0, x1, top_fn, bot_fn):
    """Körper aus Ober- und Unterkante: top_fn(u), bot_fn(u) mit u = 0..1 entlang x"""
    m = m_new(c)
    for x in range(int(x0), int(x1) + 1):
        u = (x - x0) / max(1.0, (x1 - x0))
        a, b = top_fn(u), bot_fn(u)
        for y in range(int(round(a)), int(round(b)) + 1):
            if 0 <= x < c.w and 0 <= y < c.h:
                m[y, x] = True
    return m


# --------------------------------------------------------------------------- organische Schattierung


def _blur(a, r):
    """Box-Blur (separabel) mit Radius r, Rand = 0"""
    k = 2 * r + 1
    pad = np.pad(a, r, mode='constant')
    cs = np.cumsum(pad, axis=1)
    cs = np.pad(cs, ((0, 0), (1, 0)), mode='constant')
    h1 = (cs[:, k:] - cs[:, :-k]) / k
    cs = np.cumsum(h1, axis=0)
    cs = np.pad(cs, ((1, 0), (0, 0)), mode='constant')
    return (cs[k:, :] - cs[:-k, :]) / k


def height_field(mask, r=3, passes=2):
    h = mask.astype(np.float32)
    for _ in range(passes):
        h = _blur(h, r)
    return h


def shade_mask(c, mask, ramp, lo=1, hi=4, r=3, passes=2, strength=5.0, ambient=0.34, bias=0.0, dither='check',
               clip=None):
    """beliebige Form organisch schattieren (Licht von links oben), Schachbrett-Dither im Übergang"""
    H = height_field(mask, r, passes)
    gy, gx = np.gradient(H)
    nx, ny = -gx * strength, -gy * strength
    nz = np.ones_like(nx)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    dot = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / ln
    L = ambient + (1 - ambient) * np.clip(dot, 0, 1) * 1.15 + bias
    rid = RAMP_ID[ramp]
    ys, xs = np.nonzero(mask)
    for y, x in zip(ys, xs):
        if clip is not None and not clip(x, y):
            continue
        l = float(L[y, x])
        idx = quant(l, lo, hi, int(x), int(y)) if dither == 'check' else quant_bayer(l, lo, hi, int(x), int(y))
        c.put(x, y, RAMPS[ramp][idx], rid)


def flat_mask(c, mask, ramp, idx):
    rid = RAMP_ID[ramp]
    ys, xs = np.nonzero(mask)
    for y, x in zip(ys, xs):
        c.put(x, y, RAMPS[ramp][idx], rid)


def dots(c, pts, ramp, idx):
    for (x, y) in pts:
        c.put_ramp(x, y, ramp, idx)


def hline(c, x0, x1, y, ramp, idx):
    for x in range(int(x0), int(x1) + 1):
        c.put_ramp(x, y, ramp, idx)


def vline(c, x, y0, y1, ramp, idx):
    for y in range(int(y0), int(y1) + 1):
        c.put_ramp(x, y, ramp, idx)


def hatch(c, mask, ramp, idx, step=3, phase=0, only_over=None):
    """Schraffur/Punktmuster nur auf bereits gezeichneten Pixeln der Maske"""
    ys, xs = np.nonzero(mask)
    for y, x in zip(ys, xs):
        if (x + 2 * y + phase) % step == 0 and c.alpha(x, y):
            c.put_ramp(x, y, ramp, idx)


def recolor(c, mask, ramp, idx):
    """setzt nur Pixel der Maske, die schon gezeichnet sind"""
    rid = RAMP_ID[ramp]
    ys, xs = np.nonzero(mask)
    for y, x in zip(ys, xs):
        if c.alpha(x, y):
            c.put(x, y, RAMPS[ramp][idx], rid)


def put_if_solid(c, x, y, ramp, idx):
    if c.alpha(x, y):
        c.put_ramp(x, y, ramp, idx)


def checker_cut(c, mask, phase=0):
    """löscht jedes zweite Pixel der Maske (Geister-Durchsichtigkeit)"""
    ys, xs = np.nonzero(mask)
    for y, x in zip(ys, xs):
        if (x + y + phase) % 2 == 0:
            c.clear_pixel(int(x), int(y))


# --------------------------------------------------------------------------- Effekte für Dioramen


def stamp(world, spr, x, y, key=9000, flip=False):
    """Sprite mit Mittelpunkt (x, y) in die Welt legen (hohe Tiefe = immer obenauf)"""
    world.draw(spr, int(x - spr.w // 2), int(y - spr.h // 2), key, flip)


def trail(world, pts, ramps=(('bone', 5), ('bone', 4), ('ice', 4)), key=9000, every=1):
    """Punktspur entlang einer Punktliste"""
    for k, (x, y) in enumerate(pts):
        if k % every:
            continue
        ramp, idx = ramps[min(len(ramps) - 1, k * len(ramps) // max(1, len(pts)))]
        world.px[int(y), int(x), :3] = RAMPS[ramp][idx]
        world.depth[int(y), int(x)] = key


def wpix(world, x, y, ramp, idx, key=9000):
    x, y = int(x), int(y)
    if 0 <= x < world.w and 0 <= y < world.h:
        world.px[y, x, :3] = RAMPS[ramp][idx]
        world.depth[y, x] = key


def wrect(world, x0, y0, x1, y1, ramp, idx, key=9000):
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            wpix(world, x, y, ramp, idx, key)


def puff(c, cx, cy, r, ramp, lo, hi, seed=1):
    """kleine Rauch-/Wolkenwolke aus Kugeln"""
    rnd = random.Random(seed)
    for k in range(5):
        a = k * 1.3
        ellipse(c, cx + math.cos(a) * r * 0.6 + rnd.uniform(-1, 1), cy + math.sin(a) * r * 0.4 + rnd.uniform(-1, 1),
                r * 0.65, r * 0.55, ramp, lo=lo, hi=hi, ambient=0.25)
    ellipse(c, cx, cy, r * 0.8, r * 0.65, ramp, lo=lo, hi=hi, ambient=0.25)
