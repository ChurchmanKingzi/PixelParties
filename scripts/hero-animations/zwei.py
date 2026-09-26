# -*- coding: utf-8 -*-
"""Idle-Animation für Zwei, the Lucky Thief (38x29 + 2 px oben = 38x31).

Idle in seiner Pose mit dem geklauten pinken Glas-Dreizack:
* Er wippt deutlich mit dem ganzen Körper auf und ab (bis 2 px hoch, 1 px
  runter); die Füße bleiben am Boden, die Beine strecken bzw. stauchen sich.
  Kopf, Oberkörper und Dreizack bewegen sich als Einheit (keine Nähte).
* Windstöße von rechts: die Haarspitzen oben und die lose Strähne links
  wehen kurz nach links.
* Glas-Dreizack: Lichtband wandert über das Glas, dazu Glitzersterne.
* Glanz huscht über die Brillengläser.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, sweep_level, sparkle_pixels, save_outputs

SRC = np.array(Image.open('src/zwei-the-lucky-thief.png').convert('RGBA')).astype(int)
PT = 2
BASE = np.zeros((SRC.shape[0] + PT, SRC.shape[1], 4), int)
BASE[PT:] = SRC
H, W = BASE.shape[:2]
N = 48

GLASS = [rgb('e247e3'), rgb('fd51fe'), rgb('f7a5fe'), rgb('f9c0fe'), rgb('fbd8fe'), rgb('ffffff')]
GLASS_SET = set(GLASS[:-1])
LENS = [rgb('c2e4ff'), rgb('d5e9ff'), rgb('faffff'), rgb('ffffff')]
LENS_SET = set(LENS[:-1])


def o(y):
    return y - PT


def is_glass(x, y):
    return 0 <= x < W and 0 <= y < H and px(BASE, x, y) in GLASS_SET


# ---------------------------------------------------------------- Bewegung
# Körperversatz (negativ = hoch) – weiches Wippen, drei Mal pro Loop
BOB = [0, 0, -1, -1, -2, -2, -2, -2, -1, -1, 0, 0, 1, 1, 1, 0]


def bob(i):
    return BOB[i % len(BOB)]


def is_leg(x, oy):
    """Beine (Quellkoordinaten): bleiben am Boden."""
    return oy >= 22 and 11 <= x <= 22


GUST = [(18, 24), (40, 45)]                 # Windstöße (Start, Ende)


def gust(i):
    return any(a <= i % N < b for a, b in GUST)


def wind_dx(x, oy, i):
    """Wind von rechts: Haarspitzen oben und lose Strähne links wehen nach links."""
    if not gust(i):
        return 0
    if oy <= 2 or (4 <= oy <= 6 and x <= 10):
        return -1
    return 0


# ---------------------------------------------------------------- Glanz
SPARKLES = [(7, 20, 4), (31, 18, 18), (27, 20, 28), (31, 22, 40)]


def glass_level(x, y, i):
    """Ein langsames Lichtband pro Loop über den Dreizack (links -> rechts)."""
    return sweep_level(x, o(y), i, N, speed=1.6, slope=0.5, offset=-4)


def lens_level(x, y, i):
    t = i % N
    if not 20 <= t < 27:
        return 0
    pos = 11 + (t - 20) * 2
    d = abs(x + (o(y) - 10) * 0.6 - pos)
    return 2 if d < 0.8 else 1 if d < 1.8 else 0


def frame(i):
    s = BASE.copy()
    for y in range(H):
        for x in range(W):
            c = px(BASE, x, y)
            if c in GLASS_SET:
                lv = glass_level(x, y, i)
                if lv:
                    s[y, x] = GLASS[min(len(GLASS) - 1, GLASS.index(c) + lv)]
            elif c in LENS_SET:
                lv = lens_level(x, y, i)
                if lv:
                    s[y, x] = LENS[min(len(LENS) - 1, LENS.index(c) + lv + 1)]
    out = np.zeros_like(s)
    b = bob(i)
    # Beine: Füße fest; beim Hochwippen strecken sich die Hosenbeine (Zeile 22)
    for oy in range(22, SRC.shape[0]):
        for x in range(11, 23):
            if s[oy + PT, x, 3]:
                out[oy + PT, x] = s[oy + PT, x]
    for k in range(b, 0):
        for x in range(11, 23):
            if s[22 + PT, x, 3]:
                out[22 + k + PT, x] = s[22 + PT, x]
    # Oberkörper, Kopf und Dreizack als Einheit
    for y in range(H):
        for x in range(W):
            sy = y - b
            if not PT <= sy < H:
                continue
            sx = x - wind_dx(x, o(sy), i)
            if 0 <= sx < W and s[sy, sx, 3] and not is_leg(sx, o(sy)):
                out[y, x] = s[sy, sx]
    # Glitzersterne auf dem Glas (bewegen sich mit dem Oberkörper)
    for (x, y), c in sparkle_pixels(i, N, SPARKLES, GLASS[3], GLASS[4]).items():
        yy = y + PT + b
        if 0 <= x < W and 0 <= yy < H and (is_glass(x, y + PT) or out[yy, x, 3] == 0):
            out[yy, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'zwei_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10)
