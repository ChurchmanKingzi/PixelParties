# -*- coding: utf-8 -*-
"""Idle-Animation für Rick, the Trigger Happy Undertaker (31x33 + 6 px oben = 31x39).

Basis ist die saubere Version (nur Schaufel), in die Leinwand der
Effekt-Version gesetzt (Versatz +5/+2). Effekte werden neu erzeugt:
* Raketenschaufel hämmert rasend schnell und erratisch (bis 5 px, seitliches
  Ruckeln) und zieht eine Bewegungsspur aus drei Nachbildern hinter sich her.
* Raketenflamme am Triebwerk (Griff) lodert prozedural und fährt mit.
* Massenhaft Erdbrocken (1-3 px) spritzen fächerförmig davon, dazu Krümelwolke.
* Rick wird von der Vibration durchgeschüttelt, grinst, die Augen blitzen.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, save_outputs

FX = np.array(Image.open('src/rick-the-trigger-happy-undertaker.png').convert('RGBA')).astype(int)     # mit Effekten
CLEAN = np.array(Image.open('src/rick-the-trigger-happy-undertaker-nur-schaufel.png').convert('RGBA')).astype(int)  # nur Schaufel
PAD_T = 6
H0, W = FX.shape[:2]
H = H0 + PAD_T
OX, OY = 5, 2 + PAD_T
N = 32
CLEAR = (0, 0, 0, 0)

BASE = np.zeros((H, W, 4), int)
for y in range(CLEAN.shape[0]):
    for x in range(CLEAN.shape[1]):
        if CLEAN[y, x, 3]:
            BASE[y + OY, x + OX] = CLEAN[y, x]


def is_shovel_src(x, y):
    """Schaufel in der sauberen Version (Triebwerk, Stiel, Hände, Blatt)."""
    if not CLEAN[y, x, 3]:
        return False
    return x <= 8 or (y >= 24 and x <= 10)


SHOVEL = [(x + OX, y + OY) for y in range(CLEAN.shape[0]) for x in range(CLEAN.shape[1])
          if is_shovel_src(x, y)]
SHOVEL_SET = set(SHOVEL)

# ---------------------------------------------------------------- Flamme
FIRE = [None, rgb('ca2c29'), rgb('f47b22'), rgb('f6e70e'), rgb('f7f5b8')]
HEAT_OF = {c: k for k, c in enumerate(FIRE) if c}
HEAT = {}
for y in range(0, 14):
    for x in range(4, 18):
        c = px(FX, x, y)
        if c in HEAT_OF:
            HEAT[(x, y + PAD_T)] = HEAT_OF[c]
FLAME_BASE = max(y for _, y in HEAT)
_rng = np.random.default_rng(9)
PH = _rng.random(W) * 2 * math.pi
_nz = _rng.random((32, W))
for _ in range(2):
    _nz = (np.roll(_nz, 1, 0) + 2 * _nz + np.roll(_nz, -1, 0)) / 4
NOISE = (_nz - _nz.min()) / (_nz.max() - _nz.min())


def flame(out, i, dy):
    t = 2 * math.pi * i / 8
    for x in range(3, 19):
        s = 1.0 + 0.22 * math.sin(t + PH[x]) + 0.1 * math.sin(2 * t + PH[x] * 2)
        for y in range(0, FLAME_BASE + 1):
            sy = int(round(FLAME_BASE - (FLAME_BASE - y) / s))
            h = HEAT.get((x, sy), 0)
            if not h:
                continue
            if h >= 2:
                n = NOISE[(y + i * 2) % 32, x]
                h = max(2, min(4, h + (1 if n > 0.72 else -1 if n < 0.28 else 0)))
            yy = y + dy
            if 0 <= yy < H and out[yy, x, 3] == 0:
                out[yy, x] = FIRE[h]


# ---------------------------------------------------------------- Bewegung
# rasender, erratischer Hämmer-Rhythmus (loopt über 32 Frames)
DIG = [0, -4, -1, -5, -2, 0, -3, -5, -1, -4, 0, -2, -5, -3, 0, -4,
       -1, -5, -2, -4, 0, -3, -1, -5, 0, -2, -4, -1, -5, -3, 0, -4]
DIG_DX = [0, 1, 0, -1, 1, 0, 0, -1, 1, 0, -1, 0, 1, 0, -1, 1,
          0, -1, 0, 1, 0, -1, 1, 0, 0, 1, -1, 0, 1, 0, -1, 0]


def dig(i):
    return DIG[i % len(DIG)]


def dig_dx(i):
    return DIG_DX[i % len(DIG_DX)]


def shake(i):
    """Vibration: Rick wird kräftig durchgeschüttelt."""
    sx = [0, 1, -1, 0, 1, 0, -1, 1][i % 8]
    sy = 1 if dig(i) == 0 else 0                 # beim Einschlag staucht er
    return sx, sy


DIRT = [rgb('ad7539'), rgb('7b5921'), rgb('5a3a14')]
BLADE_TIP = (8 + OX - 3, 28 + OY)     # Grabstelle (Blattspitze)
_drng = np.random.default_rng(21)
# viele Erdbrocken: (Startframe, vx, vy, Größe, Farbe)
CLODS = [(int(_drng.integers(0, N)), float(_drng.uniform(-2.4, 1.1)),
          float(_drng.uniform(-3.8, -1.6)), int(_drng.integers(1, 4)), int(_drng.integers(0, 3)))
         for _ in range(80)]
CLOD_LIFE = 11
CLOD_SHAPES = {1: [(0, 0)], 2: [(0, 0), (1, 0)], 3: [(0, 0), (1, 0), (0, 1)]}


def dirt(out, i):
    for start, vx, vy, size, col in CLODS:
        t = (i - start) % N
        if t >= CLOD_LIFE:
            continue
        x = BLADE_TIP[0] - 1 + vx * t
        y = BLADE_TIP[1] + vy * t + 0.42 * t * t
        xi, yi = int(round(x)), int(round(y))
        if yi > BLADE_TIP[1] + 2:
            continue                                   # wieder im Boden gelandet
        for cx, cy in CLOD_SHAPES[size]:
            xx, yy = xi + cx, yi + cy
            if 0 <= xx < W and 0 <= yy < H:
                out[yy, xx] = DIRT[(col + cx + cy) % 3]      # fliegt vorne vorbei
    # Staub- und Krümelwolke direkt an der Grabstelle
    for k in range(6):
        if (i + k) % 3 == 0:
            xx = BLADE_TIP[0] - 3 + (k * 2 + i) % 7
            yy = BLADE_TIP[1] + 1 - (k % 2)
            if 0 <= xx < W and 0 <= yy < H and out[yy, xx, 3] == 0:
                out[yy, xx] = DIRT[k % 3]


def draw_shovel(out, i, alpha=255, dy=0, dx=0):
    for x0, y in SHOVEL:
        x = x0 + dx
        if not 0 <= x < W:
            continue
        yy = y + dy
        if 0 <= yy < H:
            c = BASE[y, x0].copy()
            if alpha < 255:
                c[3] = alpha
                if out[yy, x, 3]:
                    continue
            out[yy, x] = c


def frame(i):
    out = np.zeros((H, W, 4), int)
    sx, sy = shake(i)
    # Rick (ohne Schaufel)
    for y in range(H):
        for x in range(W):
            ox, oy = x - sx, y - sy
            if y >= 30 + PAD_T - 3 and y >= H - 6:
                ox, oy = x, y                         # Füße stehen
            if 0 <= ox < W and 0 <= oy < H and BASE[oy, ox, 3] and (ox, oy) not in SHOVEL_SET:
                out[y, x] = BASE[oy, ox]
    d, ddx = dig(i), dig_dx(i)
    draw_shovel(out, i, 255, d, ddx)
    # Bewegungsspur: drei vorherige Positionen halbtransparent
    for k, al in ((1, 120), (2, 75), (3, 40)):
        td, tdx = dig(i - k), dig_dx(i - k)
        if (td, tdx) != (d, ddx):
            draw_shovel(out, i, al, td, tdx)
    flame(out, i, d)
    dirt(out, i)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'rick_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 60, scale=10)
