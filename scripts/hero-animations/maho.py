# -*- coding: utf-8 -*-
"""Idle-Animation für Maho, the Cute Magical Girl (MotiveArcanum.xcf,
rechte Figur aus „Ebene #49“, gespiegelt).

* Das Herzchen in ihrem Haar ploppt auf, löst sich, steigt wackelnd auf und
  verblasst – wie bei Lilly (darunter werden Haar und Kontur ergänzt).
* Sie wippt fröhlich (Füße bleiben stehen, die Zeile darüber wird gedehnt).
* Ihre großen roten Schleifen flattern abwechselnd nach außen.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import fill_pinholes

SRC = np.array(Image.open('src/maho-the-cute-magical-girl.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
PT, P = 10, 2
H, W = SH + PT + 1, SW + 2 * P
N = 48
FEET = 19
OUTL = rgb('311800')
HEART_PX = {(14, 5): OUTL, (16, 5): OUTL, (14, 6): OUTL, (15, 6): rgb('f6bd98'), (16, 6): OUTL,
            (15, 7): rgb('bd5a39')}                   # was unter dem Herzchen liegt
RIBBON = {rgb(c) for c in ('c3071f', 'd25261', 'ca1e2c', 'd14043')}
PINK, PINK_HI, PINK_DK = rgb('ff4dc5'), rgb('ff8eda'), rgb('c6188e')
HEART = [(-2, 0, PINK_DK), (-1, 0, PINK_HI), (1, 0, PINK_DK), (2, 0, PINK_DK),
         (-2, 1, PINK), (-1, 1, PINK_DK), (0, 1, PINK_DK), (1, 1, PINK), (2, 1, PINK),
         (-1, 2, PINK), (0, 2, PINK), (1, 2, PINK), (0, 3, PINK)]
SMALL_HEART = [(-1, 0, PINK), (1, 0, PINK_HI), (-1, 1, PINK_DK), (0, 1, PINK), (1, 1, PINK), (0, 2, PINK_DK)]


def bob(i):
    return -1 if (i % 12) in (3, 4, 5, 6, 7) else 0


def ribbon_dx(x, y, i):
    if y > 3 or tuple(SRC[y, x]) not in RIBBON or 4 <= x <= 17:
        return 0                                       # nur die äußeren Schleifenspitzen
    side = -1 if x < SW / 2 else 1
    return side if ((i // 3) % 2 == (0 if side < 0 else 1)) else 0


def draw_heart(out, cx, cy, shape, alpha):
    pts = [(cx + dx, cy + dy, c) for dx, dy, c in shape]
    if any(not (1 <= x < W - 1 and 1 <= y < H - 1) for x, y, _ in pts):
        return
    for x, y, c in pts:
        if alpha >= 250 or out[y, x, 3] == 0:
            out[y, x] = (*c[:3], alpha)


def hearts(out, i, b):
    t = i % 24
    hx = 15 + P
    if t < 3:                                         # neues Herz ploppt am Haar auf
        draw_heart(out, hx, 5 + PT + b, SMALL_HEART, 255)
    elif t < 20:                                      # steigt wackelnd auf
        k = t - 3
        cx = hx + int(round(1.2 * math.sin(k * 0.7)))
        cy = 4 + PT - k // 2 + b
        a = 255 if k < 11 else int(255 * (17 - k) / 6)
        draw_heart(out, cx, cy, HEART, max(0, a))


def frame(i):
    s = SRC.copy()
    for (x, y), c in HEART_PX.items():               # Herz vom Haar lösen
        s[y, x] = c
    out = np.zeros((H, W, 4), int)
    b = bob(i)
    for y in range(SH):
        for x in range(SW):
            if s[y, x, 3]:
                out[y + PT + (b if y < FEET else 0), x + P + ribbon_dx(x, y, i)] = s[y, x]
    if b:
        y = FEET - 1
        for x in range(SW):
            if s[y, x, 3] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = s[y, x]
    fill_pinholes(out)                                # Schleifen-Flattern: keine Löcher
    hearts(out, i, b)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'maho_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10,
                 check_edges=True)
