# -*- coding: utf-8 -*-
"""Idle-Animation für Rafflesia, the Poison Princess (46x39 + Rand = 50x46).

* Jede Ranke bewegt sich einzeln (eigene Welle, eigenes Tempo): zwei Arm-
  Ranken, zwei hängende Ranken, die Wurzeln unten.
* Das Kleid aus langen Blättern wallt (Welle läuft nach unten).
* Körper wiegt sich, die Blüte folgt verzögert.
* Aus der Mitte der Blüte steigt lila Giftgas auf.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, save_outputs

SRC = np.array(Image.open('src/rafflesia-the-poison-princess.png').convert('RGBA')).astype(int)
PL, PT, PR, PB = 2, 6, 2, 1
BASE = np.zeros((SRC.shape[0] + PT + PB, SRC.shape[1] + PL + PR, 4), int)
BASE[PT:PT + SRC.shape[0], PL:PL + SRC.shape[1]] = SRC
H, W = BASE.shape[:2]
N = 48


def o(x, y):
    return x - PL, y - PT


def green(c):
    return c[3] > 0 and c[1] > c[0] and c[1] > c[2]


def src_zone(x, y):
    ox, oy = o(x, y)
    c = px(BASE, x, y)
    if c[3] == 0:
        return None
    if green(c) and ox <= 13 and 19 <= oy <= 21:
        return 'TL'
    if green(c) and ox >= 34 and 19 <= oy <= 21:
        return 'TR'
    if green(c) and 14 <= ox <= 15 and 22 <= oy <= 27:
        return 'HL'
    if green(c) and 32 <= ox <= 33 and 22 <= oy <= 27:
        return 'HR'
    if oy >= 34:
        return 'ROOT'
    if 26 <= oy <= 33:
        return 'DRESS'
    if oy <= 16:
        return 'HEAD'
    return 'BODY'


ZONES = {}
for yy in range(H):
    for xx in range(W):
        z = src_zone(xx, yy)
        if z:
            ZONES.setdefault(z, []).append((xx, yy))
ZONE_OF = {p: z for z, pts in ZONES.items() for p in pts}


def sway(i, lag=0):
    """Körper wiegt sich: 0 / 1 (runter)."""
    t = (i - lag) % N
    return 1 if 12 <= t < 36 else 0


def zone_offset(z, ox, oy, i):
    if z == 'TL':
        u = (14 - ox) / 6
        return 0, int(round(1.8 * u ** 1.2 * wave(i, 16, -1.6 * u))) + sway(i)
    if z == 'TR':
        u = (ox - 33) / 6
        return 0, int(round(1.8 * u ** 1.2 * wave(i, 24, 2.0 - 1.6 * u))) + sway(i)
    if z == 'HL':
        u = (oy - 21) / 6
        return int(round(1.4 * u * wave(i, 12, 0.5 - 1.2 * u))), sway(i)
    if z == 'HR':
        u = (oy - 21) / 6
        return int(round(1.4 * u * wave(i, 16, 3.3 - 1.2 * u))), sway(i)
    if z == 'ROOT':
        return int(round(0.9 * wave(i, 12, ox * 0.9))), 0
    if z == 'DRESS':
        u = (oy - 25) / 8
        return int(round(1.3 * u * wave(i, 24, -0.7 * (oy - 26)))), sway(i)
    if z == 'HEAD':
        return 0, sway(i, 2)
    return 0, sway(i)


EYES = [(21, 19), (27, 19)]
LID = rgb('340000')


# ---------------------------------------------------------------- Gas
GAS = [(70, 20, 130), (118, 52, 196), (168, 118, 236)]
GAS_OUT = (62, 16, 118)
# Gas entsteht im orangen Zentrum der Blüte (Original ~ x23.5, y10)
PUFFS = [(23.5 + dx, 10.0, s) for dx, s in ((0, 0), (-1, 8), (1, 16), (0, 24), (-1, 32), (1, 40))]
PUFF_LIFE = 18


def gas(out, i):
    sway_head = sway(i, 2)
    for cx, cy, start in PUFFS:
        t = (i - start) % N
        if t >= PUFF_LIFE:
            continue
        f = t / PUFF_LIFE
        x0 = cx + PL + 1.2 * math.sin(t * 0.45 + cx) * min(1.0, t / 4)
        y0 = cy + PT - t * 0.65 + sway_head
        r = 0.5 + 2.2 * min(1.0, f * 1.4)
        a = 200 if f < 0.5 else int(200 * (1 - f) / 0.5)
        if a < 20:
            continue
        for y in range(int(y0 - r - 1), int(y0 + r + 2)):
            for x in range(int(x0 - r - 1), int(x0 + r + 2)):
                d = math.hypot(x - x0, y - y0)
                if d > r + 0.3 or not (0 <= x < W and 0 <= y < H):
                    continue
                col = GAS_OUT if d > r - 0.5 else GAS[2] if (x - x0) + (y - y0) < -0.4 else GAS[1]
                out[y, x] = (*col, a)


def frame(i):
    s = BASE.copy()
    out = np.zeros_like(s)
    # Blüte, Körper, Kleid: Rückwärts-Mapping (lückenlos; Grenzen dehnen/stauchen)
    big = {'HEAD', 'BODY', 'DRESS'}
    for y in range(H):
        for x in range(W):
            ox, oy = o(x, y)
            z = 'HEAD' if oy <= 16 else 'BODY' if oy <= 25 else 'DRESS' if oy <= 33 else None
            if z is None:
                continue
            dx, dy = zone_offset(z, ox, oy, i)
            sx, sy = x - dx, y - dy
            if 0 <= sx < W and 0 <= sy < H and ZONE_OF.get((sx, sy)) in big:
                out[y, x] = s[sy, sx]
    # Ranken und Wurzeln vorne (dünn, vorwärts gezeichnet)
    for z in ['ROOT', 'HL', 'HR', 'TL', 'TR']:
        for x, y in ZONES.get(z, []):
            ox, oy = o(x, y)
            dx, dy = zone_offset(z, ox, oy, i)
            if 0 <= x + dx < W and 0 <= y + dy < H:
                out[y + dy, x + dx] = s[y, x]
    # Gas steigt aus der Blütenmitte auf (vor der Blüte, halbtransparent)
    g = np.zeros_like(out)
    gas(g, i)
    img = Image.fromarray(out.astype(np.uint8))
    img.alpha_composite(Image.fromarray(g.astype(np.uint8)))
    return np.array(img).astype(int)


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'rafflesia_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=8)
