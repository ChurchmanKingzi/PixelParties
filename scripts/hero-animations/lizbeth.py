# -*- coding: utf-8 -*-
"""Idle-Animation für den Skin Lizbeth the Hunter of Souls (MotiveBoons.xcf,
„Ebene #16“).

* Ruhiges Atmen (Oberkörper samt Sense 1 px hoch, Beine fest), Blinzeln.
* Über die rote Sensenklinge läuft ein kalter Glanz von der Spitze zum Stiel.
* Seelenlichter: blasse, blaugrüne Irrlichter steigen neben ihr auf,
  wabern und verblassen.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, draw_bounce

SRC = np.array(Image.open('src/lizbeth-the-hunter-of-souls.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT = 5, 4
H, W = SH + PT + 1, SW + 2 * P
N = 36
KNEE = 27
SKIN, LASH = rgb('f6bd98'), rgb('301c00')
BLINK = {(4, 16): SKIN, (5, 16): SKIN, (8, 16): SKIN, (9, 16): SKIN,
         (4, 17): LASH, (5, 17): LASH, (8, 17): LASH, (9, 17): LASH}
BLADE = sorted([(x, y) for y in range(0, 10) for x in range(SW)
                if SRC[y, x, 3] and SRC[y, x, 0] > 180 and SRC[y, x, 1] < 110], key=lambda p: -p[0] + p[1])
SOUL = [rgb('e8fff8', 230), rgb('9fe8d8', 200), rgb('5fb8b0', 150)]


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def breath(i):
    return -1 if (i % 18) in range(4, 12) else 0


def frame(i):
    s = SRC.copy()
    if i in (26, 27):
        for (x, y), c in BLINK.items():
            s[y, x] = c
    g = (i % 12) * len(BLADE) / 8.0                   # Glanz Spitze -> Stiel
    for k, (x, y) in enumerate(BLADE):
        if abs(k - g) < 1:
            s[y, x] = rgb('ffe0e0')
        elif abs(k - g) < 2.2:
            s[y, x] = rgb('ff8a8a')
    out = np.zeros((H, W, 4), int)
    draw_bounce(out, s, breath(i), KNEE, PT, P)
    for k in range(5):                                # Seelenlichter
        t = (i + k * 7) % 18
        if t >= 14:
            continue
        gen = ((i + k * 7) // 18) % (N // 18)
        side = -1 if k % 2 else 1
        x = int(round(W / 2 + side * (SW / 2 + 1 + rnd(k, gen) * 2) + math.sin(t * 0.6 + k)))
        y = int(round(H - 6 - t * 1.3))
        for dy, c in ((0, SOUL[min(2, t // 5)]), (1, SOUL[min(2, t // 5 + 1)])):
            if 1 <= x < W - 1 and 1 <= y + dy < H - 1 and out[y + dy, x, 3] == 0:
                out[y + dy, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'lizbeth_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=8,
                 check_edges=True)
