"""pack_art10: gemeinsame Zeichenhelfer (Dither, Seile, Ketten, Wolken, Glanz) fuer die Bauteil-Dioramen.
Nur Master-Palette, deterministisch, keine Schrift."""
from __future__ import annotations

import math
import random

import numpy as np

from cards_art import *


# --------------------------------------------------------------------------- einfache Muster


def chk(c, x0, y0, x1, y1, ramp, idx, phase=0):
    """Schachbrett-Flaeche (jedes zweite Pixel)"""
    for y in range(int(y0), int(y1) + 1):
        for x in range(int(x0), int(x1) + 1):
            if (x + y + phase) % 2 == 0:
                c.put_ramp(x, y, ramp, idx)


def sparkle(c, x, y, ramp='gold', big=False):
    """kleiner Glitzerstern (Plus-Form)"""
    c.put_ramp(x, y, ramp, 5)
    for (dx, dy) in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        c.put_ramp(x + dx, y + dy, ramp, 4)
    if big:
        for (dx, dy) in ((-2, 0), (2, 0), (0, -2), (0, 2)):
            c.put_ramp(x + dx, y + dy, ramp, 3)


def world_sparkle(world, x, y, ramp='gold', big=False, key=9500):
    cv = Canvas(7, 7)
    sparkle(cv, 3, 3, ramp, big)
    world.draw(cv, x - 3, y - 3, key)


def rope(c, x0, y0, x1, y1, sag=4, ramp='dirt', hi=4, lo=3, width=1):
    """durchhaengendes Seil (Parabel), zwei Toene abwechselnd wie gedrehter Hanf"""
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 2
    last = None
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)
        p = (int(round(x)), int(round(y)))
        if p == last:
            continue
        last = p
        idx = hi if (i // 2) % 2 == 0 else lo
        for k in range(width):
            c.put_ramp(p[0], p[1] + k, ramp, idx)


def chain_line(c, x0, y0, x1, y1, ramp='metal', hi=4, lo=2):
    """Kette: Glieder wechseln zwischen hell und dunkel, jedes dritte Pixel eine Luecke"""
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n + 1):
        t = i / max(1, n)
        x = int(round(x0 + (x1 - x0) * t))
        y = int(round(y0 + (y1 - y0) * t))
        if i % 3 == 2:
            continue
        c.put_ramp(x, y, ramp, hi if i % 3 == 0 else lo)


def puff(c, cx, cy, rx, ry, ramp='fur', lo=1, hi=5, ambient=0.28):
    ellipse(c, cx, cy, rx, ry, ramp, lo=lo, hi=hi, ambient=ambient, flatness=0.1)


def drop(c, x, y, ramp='ice', big=True):
    """Regentropfen (spitz oben), Spitze bei (x, y)"""
    c.put_ramp(x, y, ramp, 4)
    c.rect(x - 1, y + 1, x + 1, y + 2, ramp, 3)
    c.put_ramp(x - 1, y + 1, ramp, 4)
    if big:
        c.rect(x - 2, y + 3, x + 2, y + 4, ramp, 3)
        c.put_ramp(x - 2, y + 3, ramp, 4)
        c.put_ramp(x - 1, y + 3, ramp, 5)
        c.rect(x - 1, y + 5, x + 1, y + 5, ramp, 2)
        c.put_ramp(x + 2, y + 4, ramp, 2)


def smiley(c, x, y, ramp='stone', dark=1, w=5):
    """winziges Gesicht: zwei Augen und ein Laecheln (Mitte x, Augenzeile y)"""
    c.put_ramp(x - 2, y, ramp, dark)
    c.put_ramp(x + 2, y, ramp, dark)
    c.put_ramp(x - 2, y + 2, ramp, dark)
    c.put_ramp(x + 2, y + 2, ramp, dark)
    for k in range(-1, 2):
        c.put_ramp(x + k, y + 3, ramp, dark)


def stripes_h(c, x0, y0, x1, y1, ramp_a, idx_a, ramp_b, idx_b, step=2):
    for y in range(int(y0), int(y1) + 1):
        if ((y - y0) // step) % 2 == 0:
            c.rect(x0, y, x1, y, ramp_a, idx_a)
        else:
            c.rect(x0, y, x1, y, ramp_b, idx_b)


def outline_only(c):
    """Outline am Ende (Sel-Out), liefert das Canvas zurueck"""
    c.outline()
    return c


# --------------------------------------------------------------------------- Boden-Kacheln (32 x 32 x 3)


def tile_deck(seed=4, tone=(3, 4)):
    """Schiffsplanken: senkrechte Bohlen, dunkle Fugen (Kalfaterung), versetzte Stoesse, Nagelkoepfe"""
    c = Canvas(32, 32)
    rnd = random.Random(seed)
    for col in range(4):
        x0 = col * 8
        y = -rnd.randint(0, 14)
        while y < 32:
            ln = rnd.randint(16, 28)
            t = rnd.choice(tone)
            for yy in range(ln):
                py = y + yy
                if not (0 <= py < 32):
                    continue
                for xx in range(8):
                    if xx == 7:
                        idx = 1
                    elif xx == 0:
                        idx = min(5, t + 1)
                    else:
                        idx = t
                        if xx in (3, 4) and texture_noise(col, (py // 3), seed) > 0.6:
                            idx = t - 1
                    if yy == ln - 1:
                        idx = 1
                    c.put_ramp(x0 + xx, py, 'wood', idx)
            for ny in (y + 2, y + ln - 4):
                if 0 <= ny < 32:
                    c.put_ramp(x0 + 3, ny, 'wood', 5)
                    c.put_ramp(x0 + 4, ny, 'wood', 5)
            y += ln
    return c.px[:, :, :3].copy()


def tile_checker(ramp_a, idx_a, ramp_b, idx_b, size=32, cell=8, seed=1, jitter=False):
    """Schachbrett-Boden (Marmor, Chaos-Fliesen ...)"""
    c = Canvas(size, size)
    rnd = random.Random(seed)
    n = size // cell
    pick = [[rnd.random() for _ in range(n)] for _ in range(n)]
    for gy in range(n):
        for gx in range(n):
            odd = (gx + gy) % 2 == 1
            ra, ia = (ramp_b, idx_b) if odd else (ramp_a, idx_a)
            for yy in range(cell):
                for xx in range(cell):
                    idx = ia
                    if xx == 0 or yy == 0:
                        idx = min(5, ia + 1)
                    elif xx == cell - 1 or yy == cell - 1:
                        idx = max(0, ia - 1)
                    elif (xx + yy) % 5 == 0 and texture_noise(gx * 9 + xx, gy * 7 + yy, seed) > 0.8:
                        idx = max(0, ia - 1)
                    c.put_ramp(gx * cell + xx, gy * cell + yy, ra, idx)
    return c.px[:, :, :3].copy()


# --------------------------------------------------------------------------- Welt-Helfer


def blit_world(world, spr, x, y, key=9000, flip=False):
    world.draw(spr, int(x), int(y), int(key), flip)


def soft_shadow(world, cx, cy, rx, ry):
    """grosser Schlagschatten (Schachbrett) auf dem Boden fuer Schwebendes"""
    shadow(world, cx, cy, rx, ry)


def glow_ring(world, cx, cy, r, ramp='gold', key=9400):
    """Heiligenschein: Ring aus Pixeln"""
    cv = Canvas(int(r * 2 + 4), int(r * 2 + 4))
    c0 = r + 1.5
    for a in range(0, 360, 6):
        x = c0 + math.cos(math.radians(a)) * r
        y = c0 + math.sin(math.radians(a)) * (r * 0.38)
        cv.put_ramp(int(x), int(y), ramp, 5 if a < 180 else 4)
    world.draw(cv, int(cx - c0), int(cy - c0 * 0.4), key)


def crop_pad(world, x0, y0, w=WIN_W, h=WIN_H):
    return crop_world(world, x0, y0, w, h)
