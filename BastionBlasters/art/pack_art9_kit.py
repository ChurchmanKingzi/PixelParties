"""pack_art9: gemeinsame Helfer (Raum-Gerüst, Boden-Kacheln, Weltpixel-Effekte, kleine Zeichenhilfen)."""
from __future__ import annotations

import math
import random

import numpy as np

from cards_art import *          # noqa: F401,F403  (Helfer, Registry, pixl / scenekit / landscape / assets_*)
from cards_art import mini_castle, crop_world, ground_world, finish, unit_at, prop_at
from assets_env import tile_cobble, tile_planks


# --------------------------------------------------------------------------- kleine Zeichenhilfen (Canvas)


def hline(c, x0, x1, y, ramp, i):
    for x in range(int(x0), int(x1) + 1):
        c.put_ramp(x, y, ramp, i)


def vline(c, x, y0, y1, ramp, i):
    for y in range(int(y0), int(y1) + 1):
        c.put_ramp(x, y, ramp, i)


def checker(c, x0, y0, x1, y1, ramp, a, b, ramp2=None):
    """Schachbrett-Dither zweier Töne"""
    r2 = ramp2 or ramp
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            if (x + y) % 2 == 0:
                c.put_ramp(x, y, ramp, a)
            else:
                c.put_ramp(x, y, r2, b)


def block(c, x0, y0, x1, y1, ramp, hi=4, mid=3, lo=2, deep=1):
    """Vorderansicht eines Blocks: Lichtkante oben/links, Schatten rechts/unten, Dither im Übergang"""
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            if y == y0 or x == x0:
                i = hi
            elif y == y1 or x == x1:
                i = deep
            elif y == y1 - 1 or x == x1 - 1:
                i = lo
            else:
                i = mid if (x + y) % 5 else lo if (x - x0) > (x1 - x0) * 0.6 else mid
            c.put_ramp(x, y, ramp, i)


def tint_over(c, x0, y0, x1, y1, ramp, idx, every=2):
    """Dither-Schleier (Glas, Dampf): nur jeder `every`-te Pixel"""
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            if (x + y) % every == 0 and c.alpha(x, y):
                c.put_ramp(x, y, ramp, idx)


def put_if(c, x, y, ramp, idx):
    if c.alpha(x, y):
        c.put_ramp(x, y, ramp, idx)


def rot_poly(cx, cy, pts, deg):
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + px * ca - py * sa, cy + px * sa + py * ca) for (px, py) in pts]


# --------------------------------------------------------------------------- Weltpixel-Effekte (liegen über allem)


def wput(world, x, y, ramp, i, key=9000):
    x, y = int(x), int(y)
    if 0 <= x < world.w and 0 <= y < world.h:
        world.px[y, x, :3] = RAMPS[ramp][max(0, min(5, i))]
        world.depth[y, x] = key


def wline(world, x0, y0, x1, y1, ramp, i, key=9000, dashed=False):
    x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    n = 0
    while True:
        if not dashed or n % 2 == 0:
            wput(world, x0, y0, ramp, i, key)
        n += 1
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def wrope(world, p0, p1, sag=4, key=9000, ramp='dirt', hi=5, lo=3):
    """durchhängendes Seil zwischen zwei Punkten (1 px, Licht oben)"""
    (x0, y0), (x1, y1) = p0, p1
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    prev = None
    for k in range(n * 2 + 1):
        t = k / (n * 2)
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)
        pt = (int(round(x)), int(round(y)))
        if pt != prev:
            wput(world, pt[0], pt[1], ramp, hi if (pt[0] + pt[1]) % 3 else lo, key)
            prev = pt


def wsparkle(world, x, y, ramp='gold', key=9100, big=False):
    for (dx, dy, i) in ((0, 0, 5), (-1, 0, 4), (1, 0, 4), (0, -1, 4), (0, 1, 4)):
        wput(world, x + dx, y + dy, ramp, i, key)
    if big:
        for (dx, dy) in ((-2, 0), (2, 0), (0, -2), (0, 2)):
            wput(world, x + dx, y + dy, ramp, 3, key)


def wdot(world, x, y, ramp, i, key=9100):
    wput(world, x, y, ramp, i, key)


def wblit(world, spr, x, y, key=9050, flip=False):
    world.draw(spr, int(x), int(y), key, flip)


# --------------------------------------------------------------------------- Böden (32 x 32 x 3 uint8)


def _rgb(c):
    return c.px[:, :, :3].copy()


def floor_cobble(seed, base='stone', tone=(2, 3), mortar=1, hi=4):
    return _rgb(tile_cobble(seed, 32, base=base, tone=tone, mortar=mortar, hi=hi))


def floor_planks(seed, tone=(2, 3, 4)):
    return _rgb(tile_planks(seed, 32, tone=tone))


def floor_wood(seed=1, tones=(1, 2), nails=False, rowh=8):
    """ruhiger Dielenboden: weiche Fugen, kaum Kontrast (damit Möbel davor lesbar bleiben)"""
    c = Canvas(32, 32)
    rnd = random.Random(seed)
    lo, hi = tones
    for row in range(32 // rowh):
        y0 = row * rowh
        x = -rnd.randint(0, 12)
        while x < 32:
            ln = rnd.randint(14, 26)
            t = rnd.choice([lo, hi])
            for yy in range(rowh):
                for xx in range(ln):
                    px = x + xx
                    if not (0 <= px < 32):
                        continue
                    i = t
                    if yy == rowh - 1 or xx == ln - 1:
                        i = max(0, lo - 1)
                    elif yy == 0:
                        i = min(5, t + 1)
                    elif yy in (3, 4) and texture_noise(px // 3, row, seed) > 0.66:
                        i = max(0, t - 1)
                    c.put_ramp(px, y0 + yy, 'wood', i)
            if nails:
                for nx in (x + 2, x + ln - 4):
                    if 0 <= nx < 32:
                        c.put_ramp(nx, y0 + 3, 'wood', hi + 1)
            x += ln
    return _rgb(c)


def floor_checker(a, b, size=8, seed=1, shade=True):
    """Schachbrett-Fliesen, a / b = (Rampe, Index); Lichtkante oben/links, Fuge unten/rechts"""
    c = Canvas(32, 32)
    for y in range(32):
        for x in range(32):
            cell = ((x // size) + (y // size)) % 2
            ramp, i = a if cell == 0 else b
            lx, ly = x % size, y % size
            if shade:
                if lx == size - 1 or ly == size - 1:
                    i = max(0, i - 1)
                elif lx == 0 or ly == 0:
                    i = min(5, i + 1)
                elif texture_noise(x, y, seed) > 0.93:
                    i = max(0, i - 1)
            c.put_ramp(x, y, ramp, i)
    return _rgb(c)


def floor_plates(ramp='metal', lo=1, hi=2, seed=1, size=16):
    """Eisenplatten mit Nieten"""
    c = Canvas(32, 32)
    for y in range(32):
        for x in range(32):
            lx, ly = x % size, y % size
            i = hi if (x + y) % 7 else lo
            if lx == 0 or ly == 0:
                i = hi + 1
            elif lx == size - 1 or ly == size - 1:
                i = lo - 1
            elif texture_noise(x // 2, y // 2, seed) > 0.8:
                i = lo
            c.put_ramp(x, y, ramp, max(0, i))
    for (cx, cy) in ((2, 2), (13, 2), (2, 13), (13, 13), (18, 2), (29, 2), (18, 13), (29, 13),
                     (2, 18), (13, 18), (2, 29), (13, 29), (18, 18), (29, 18), (18, 29), (29, 29)):
        c.put_ramp(cx, cy, ramp, hi + 2)
        c.put_ramp(cx + 1, cy + 1, ramp, max(0, lo - 1))
    return _rgb(c)


def floor_noise(ramp, lo, hi, seed, glints=(), cells=(16, 8)):
    """Rauschboden (Erde, Stroh, Eis ...) mit eingestreuten Lichtpunkten: glints = [(ramp, idx, count)]"""
    c = Canvas(32, 32)
    n1 = [[value_noise_px(x, y, 32, seed) for x in range(32)] for y in range(32)]
    for y in range(32):
        for x in range(32):
            c.put_ramp(x, y, ramp, quant(n1[y][x], lo, hi, x, y))
    rng = random.Random(seed * 31 + 5)
    for (r2, i2, cnt) in glints:
        for _ in range(cnt):
            c.put_ramp(rng.randint(0, 31), rng.randint(0, 31), r2, i2)
    return _rgb(c)


def value_noise_px(x, y, period, seed):
    from assets_env import value_noise
    return min(1.0, max(0.0, value_noise(x, y, period, seed) * 0.75 + value_noise(x * 2, y * 2, period * 2, seed + 3) * 0.25))


# --------------------------------------------------------------------------- Raum-Gerüst


def room_world(letter, theme, kind, ground='grass', seed=3, door_side='S', extra_rows=None):
    """Baut Welt + Burg mit einem Raum-Modul `letter`. kind: '3x2' | '3x3'. Gibt (world, X0, Y0, out) zurück;
    Fensterausschnitt: crop_world(world, 8, 6) -> Raum-Modul beginnt bei Fenster-x 24, Fenster-y 26."""
    if kind == '3x2':
        rows = ['.....', f'.{letter * 3}.', f'.{letter * 3}.', '.hhh.', '.....']
        world = ground_world(ground, seed, 160, 160)
    else:
        rows = ['.....', f'.{letter * 3}.', f'.{letter * 3}.', f'.{letter * 3}.', '.hhh.', '.....']
        world = ground_world(ground, seed, 160, 192)
    c, out = mini_castle(rows, 0, 0, world, themes={letter: theme})
    return world, 32, 32, out


def window_of(world, x0=8, y0=6):
    return crop_world(world, x0, y0)


def draw_prop(ctx, spr, x, y, flip=False, key_add=0):
    """Möbel mit linker oberer Ecke (x, y) relativ zum Modul (lokale Koordinaten)"""
    ctx.prop(spr, ctx.X0 + x, ctx.Y0 + y, key_add=key_add, flip=flip)


def draw_floor(ctx, spr, x, y):
    ctx.floor_deco(spr, ctx.X0 + x, ctx.Y0 + y)


def draw_wall(ctx, spr, cx):
    """Wanddeko, Mitte bei lokalem x = cx"""
    ctx.decor(spr, ctx.X0 + cx)
