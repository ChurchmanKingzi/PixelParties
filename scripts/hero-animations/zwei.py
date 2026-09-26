# -*- coding: utf-8 -*-
"""Idle-Animation für Zwei, the Lucky Thief (38x29 + 1 px oben = 38x30).

Idle in seiner Pose mit dem geklauten pinken Glas-Dreizack:
* Ruhiges Atmen: der ganze Oberkörper samt Dreizack hebt sich als Einheit,
  die Füße bleiben stehen (keine Nähte, die Brille oder Arme zerreißen).
* Windstöße: Haarsträhnen links/rechts und der Hoodie hinten wehen kurz mit.
* Glas-Dreizack: Lichtband wandert über das Glas, dazu Glitzersterne.
* Glanz huscht über die Brillengläser.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, sweep_level, sparkle_pixels, save_outputs

SRC = np.array(Image.open('src/zwei-the-lucky-thief.png').convert('RGBA')).astype(int)
PT = 1
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
def inhale(i):
    """Zwei Atemzüge pro Loop, ganzer Oberkörper hebt sich 1 px."""
    return 1 if 8 <= i % 24 < 19 else 0


def is_leg(x, oy):
    return oy >= 22 and 11 <= x <= 22


GUST = [(10, 15), (30, 35)]                 # Windstöße (Start, Ende)


def gust(i, lag=0):
    t = (i - lag) % N
    return any(a <= t < b for a, b in GUST)


def offset(x, y, i):
    """Rückwärts-Mapping: (dx, dy), um die out(x, y) verschoben ist."""
    oy = o(y)
    if is_leg(x, oy):
        return 0, 0                          # Füße bleiben stehen
    dx = 0
    if 4 <= oy <= 6 and x <= 10 and gust(i):            # Strähne links weht
        dx = -1
    elif 3 <= oy <= 7 and x >= 20 and x <= 23 and gust(i, 1):   # Strähne rechts
        dx = 1
    elif 15 <= oy <= 19 and x <= 11 and gust(i, 1) and not is_glass(x, y):
        dx = -1                              # Hoodie hinten weht
    return dx, -inhale(i)


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
    for y in range(H):
        for x in range(W):
            dx, dy = offset(x, y, i)
            sx, sy = x - dx, y - dy
            if 0 <= sx < W and 0 <= sy < H and s[sy, sx, 3]:
                out[y, x] = s[sy, sx]
    # Glitzersterne auf dem Glas (bewegen sich mit dem Oberkörper)
    up = inhale(i)
    for (x, y), c in sparkle_pixels(i, N, SPARKLES, GLASS[3], GLASS[4]).items():
        yy = y + PT - up
        if 0 <= x < W and 0 <= yy < H and (is_glass(x, y + PT) or out[yy, x, 3] == 0):
            out[yy, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'zwei_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10)
