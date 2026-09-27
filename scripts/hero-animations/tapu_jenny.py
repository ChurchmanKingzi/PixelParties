# -*- coding: utf-8 -*-
"""Idle-Animation für den Skin Tapu Jenny (MotiveMoe.xcf: nur die Fee aus
„Tapu Koko“, ohne den Gitarrenspieler).

* Die Fee schwebt (sanftes Auf und Ab).
* Ihre gelben Muster glimmen elektrisch auf (wandernde Leuchtwelle).
* Kleine gelbe Blitzfunken zucken um sie herum (nur ganz und nur im Bild).
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

SRC = np.array(Image.open('src/tapu-jenny.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P = 6
H, W = SH + 2 * P, SW + 2 * P
N = 32
YELLOW = [(y, x) for y, x in zip(*np.nonzero(SRC[:, :, 3]))
          if SRC[y, x, 0] > 200 and SRC[y, x, 1] > 180 and SRC[y, x, 2] < 120]
GLOW = rgb('fff6b0')
SPARK = [rgb('ffffff'), rgb('fff04a'), rgb('e8c020')]


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def frame(i):
    out = np.zeros((H, W, 4), int)
    dy = int(round(math.sin(2 * math.pi * i / 16)))
    s = SRC.copy()
    wave = (i % 16) * 2 - 4                            # Leuchtwelle von oben nach unten
    for y, x in YELLOW:
        if abs(y - wave) <= 1:
            s[y, x] = GLOW
    for y in range(SH):
        for x in range(SW):
            if s[y, x, 3]:
                out[y + P + dy, x + P] = s[y, x]
    for k in range(3):                                 # Blitzfunken
        t = (i + k * 5) % 16
        if t >= 3:
            continue
        gen = ((i + k * 5) // 16) % (N // 16)
        ang = rnd(k, gen) * 2 * math.pi
        x0 = W / 2 + math.cos(ang) * (SW / 2 + 2)
        y0 = H / 2 + math.sin(ang) * (SH / 2 - 1)
        pts = []
        for j in range(4):
            pts.append((int(round(x0 + j * math.cos(ang) + (1 if j % 2 else -1) * math.sin(ang) * 0.8)),
                        int(round(y0 + j * math.sin(ang) - (1 if j % 2 else -1) * math.cos(ang) * 0.8))))
        if any(not (1 <= x < W - 1 and 1 <= y < H - 1) or out[y, x, 3] for x, y in pts):
            continue
        for x, y in pts:
            out[y, x] = SPARK[t]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'tapu_jenny_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=8,
                 check_edges=True)
