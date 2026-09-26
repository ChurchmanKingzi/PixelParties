# -*- coding: utf-8 -*-
"""Idle-Animation für Chaos-Diamond, the Cracked Keeper (48x55).

* Das zersplitterte Rubinauge pulsiert und glitzert (Lichtschimmer über die
  Facetten, Sternglitzer), die Risse bleiben schwarz.
* Die lila Kristalle glitzern: wandernder Schimmer + Sternglitzer an den Spitzen.
* Der erhobene Arm schwenkt eigenständig um die Schulter (langsames Drohen).
* Schweres Atmen des Körpers, die Füße bleiben stehen.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, step, sweep_level, sparkle_pixels, save_outputs

BASE = np.array(Image.open('src/chaos-diamond-the-cracked-keeper.png').convert('RGBA')).astype(int)
H, W = BASE.shape[:2]
N = 48
CLEAR = (0, 0, 0, 0)

PURPLE = [rgb(h) for h in ('28008c', '5629b0', '8a6dc5', 'ae9bd5', 'd4c8ed', 'ffffff')]
RUBY = [rgb(h) for h in ('5e0000', 'a40000', 'c34d4d', 'd07474', 'f2a8a8', 'ffffff')]
PURPLE_SET, RUBY_SET = set(PURPLE[:-1]), set(RUBY[:-1])

CRYSTAL_SPARKS = [(3, 5, 0), (9, 7, 6), (31, 7, 12), (44, 14, 18), (40, 20, 24),
                  (5, 33, 30), (40, 43, 36), (12, 48, 42), (27, 49, 9), (25, 8, 27),
                  (18, 29, 33), (35, 41, 15)]
RUBY_SPARKS = [(24, 14, 4), (21, 17, 20), (25, 21, 37)]


# ---------------------------------------------------------------- Arm
PIVOT = (35.0, 27.0)


def in_arm(x, y):
    return x >= 35 and y <= 27


def arm_angle(i):
    return 0.10 * wave(i, N, 0.4) + 0.03 * wave(i, N / 3, 1.0)


# ---------------------------------------------------------------- Körper
def breath(i, lag=0):
    t = (i - lag) % N
    return 1 if 14 <= t < 38 else 0


def ruby_glow(i):
    """Grundpuls des Rubins: -1 / 0 / +1."""
    return int(round(wave(i, N / 2, 0.0)))


def source(i):
    a = BASE.copy()
    g = ruby_glow(i)
    for y in range(H):
        for x in range(W):
            c = px(BASE, x, y)
            if c in RUBY_SET:
                lv = sweep_level(x, y, i, N / 2, speed=1.2, slope=0.8, offset=12) + g
                a[y, x] = step(RUBY, c, lv)
            elif c in PURPLE_SET:
                lv = sweep_level(x, y, i, N, speed=1.9, slope=0.7, offset=-12)
                if lv:
                    a[y, x] = step(PURPLE, c, lv)
    return a


def frame(i):
    s = source(i)
    out = np.zeros_like(s)
    ang = arm_angle(i)
    ca, sa = math.cos(ang), math.sin(ang)
    b = breath(i, 0)
    # Körper (ohne Arm)
    for y in range(H):
        for x in range(W):
            if y >= 45:
                dy = 0                                   # Füße stehen fest
            elif y <= 24:
                dy = breath(i, 1)                        # Kopf/Schultern verzögert
            else:
                dy = b
            sy = y - dy
            if 0 <= sy < H and not in_arm(x, sy) and s[sy, x, 3]:
                out[y, x] = s[sy, x]
    # Arm: um die Schulter drehen (Rückwärts-Mapping), folgt dem Atmen
    ad = breath(i, 1)
    for y in range(H):
        for x in range(W):
            rx, ry = x - PIVOT[0], y - ad - PIVOT[1]
            sx = int(round(PIVOT[0] + ca * rx + sa * ry))
            sy = int(round(PIVOT[1] - sa * rx + ca * ry))
            if 0 <= sx < W and 0 <= sy < H and in_arm(sx, sy) and s[sy, sx, 3]:
                out[y, x] = s[sy, sx]
    # Glitzer
    for (x, y), c in sparkle_pixels(i, N, CRYSTAL_SPARKS, rgb('d4c8ed'), rgb('ae9bd5')).items():
        yy = y + breath(i, 1)
        if 0 <= x < W and 0 <= yy < H:
            out[yy, x] = c
    for (x, y), c in sparkle_pixels(i, N, RUBY_SPARKS, rgb('f2a8a8'), rgb('d07474')).items():
        yy = y + breath(i, 1)
        if 0 <= x < W and 0 <= yy < H:
            out[yy, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'chaos_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=6)
