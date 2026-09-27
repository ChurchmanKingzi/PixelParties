# -*- coding: utf-8 -*-
"""Idle-Animation für Cool Rescuer Monia (Sprite aus MotiveMoe.xcf).

Ebenen: Körper („Monia“ ohne das alte Düsenfeuer) und das Jetpack-Feuer aus
„Monia #2“, deckungsgleich in src/cool-rescuer-monia-{body,flames}.png.
* Sie schwebt auf ihrem Jetpack: sanftes Auf und Ab (0..2 px).
* Das Düsenfeuer lodert: jede Spalte der Flamme wird pro Frame zufällig
  gestreckt/gestaucht (Spitzen züngeln), der helle Kern flackert, beim
  Aufsteigen ist das Feuer länger.
* Die weiße Haarspange funkelt ab und zu.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, sparkle_pixels

BODY = np.array(Image.open('src/cool-rescuer-monia-body.png').convert('RGBA')).astype(int)
FIRE = np.array(Image.open('src/cool-rescuer-monia-flames.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
P, PT, PB = 3, 3, 8
H, W = SH + PT + PB, SW + 2 * P
N = 32
CORE = [rgb('f7f5b8'), rgb('f6e70e'), rgb('f47b22'), rgb('ca2c29')]
FIRE_TOP = int(np.nonzero(FIRE[:, :, 3])[0].min())


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def hover(i):
    return int(round(1 - math.cos(2 * math.pi * i / 16)))       # 0..2 (nach oben)


def frame(i):
    out = np.zeros((H, W, 4), int)
    up = hover(i)
    rising = math.sin(2 * math.pi * i / 16) > 0
    oy = PT - up + 2
    # Feuer (hinter dem Körper): spaltenweise gestreckt
    for x in range(SW):
        col = [y for y in range(SH) if FIRE[y, x, 3]]
        if not col:
            continue
        y0, y1 = min(col), max(col)
        n = y1 - y0 + 1
        grow = 1.0 + 0.25 * rnd(x, i) + (0.3 if rising else 0.0) - 0.12 * rnd(x + 40, i)
        m = max(1, int(round(n * grow)))
        for j in range(m):
            sy = y0 + min(n - 1, int(j * n / m))
            if not FIRE[sy, x, 3]:
                continue
            c = tuple(FIRE[sy, x])
            if c in CORE[:3] and rnd(x * 13 + sy, i) > 0.7:          # Kern flackert
                c = CORE[max(0, CORE.index(c) - 1)] if rnd(x, i + 9) > 0.5 else CORE[CORE.index(c) + 1]
            yy = y0 + j + oy
            if 0 <= yy < H:
                out[yy, x + P] = c
    # Körper
    m = BODY[:, :, 3] > 0
    out[oy:oy + SH, P:P + SW][m] = BODY[m]
    # Haarspange funkelt
    for (x, y), c in sparkle_pixels(i, N, [(20 + P, 8 + oy, 5), (20 + P, 8 + oy, 21)],
                                    rgb('ffffff'), rgb('b4f6ff')).items():
        if 0 <= x < W and 0 <= y < H and (out[y, x, 3] == 0 or (x, y) == (20 + P, 8 + oy)):
            out[y, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'monia_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 70, scale=8)
