# -*- coding: utf-8 -*-
"""Idle-Animation für Lilly, the Charming Infiltrator (20x27 + 8 px oben = 20x35).

Süße Neck-Geste („Bäh!“):
* Sie streckt die Zunge raus – im Takt weiter raus und wieder ein Stück rein,
  die Zungenspitze wackelt hin und her.
* Das Unterlid unter dem Auge wird im selben Takt weiter heruntergezogen
  (mehr rosa Innenlid sichtbar).
* Sie wippt frech mit (Füße fest).
* Das Herzchen steigt wackelnd auf und verblasst; ein neues ploppt am Kopf auf.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, save_outputs

SRC = np.array(Image.open('src/lilly-the-charming-infiltrator.png').convert('RGBA')).astype(int)
PT = 8
BASE = np.zeros((SRC.shape[0] + PT, SRC.shape[1], 4), int)
BASE[PT:] = SRC
H, W = BASE.shape[:2]
N = 48

HEART_PX = {(14, 7), (16, 7), (14, 8), (15, 8), (16, 8), (15, 9)}
HEART_FILL = {(14, 7): rgb('ffbe4a'), (14, 8): rgb('ffdb52'),    # Haar/Kontur hinter dem Herzchen
              (15, 8): rgb('312408'), (15, 9): rgb('312408')}
PINK, PINK_HI, PINK_DK = rgb('ff00ff'), rgb('ffb3ff'), rgb('ff60ff')
TONGUE, TONGUE_HI, TONGUE_DK = rgb('e30000'), rgb('ff4c4c'), rgb('a40000')
LID_PINK = rgb('ff9c9c')

# großes Herz (5x4) zum Aufsteigen: (dx, dy, Farbe) relativ zur Mitte oben
HEART = [(-2, 0, PINK_DK), (-1, 0, PINK_HI), (1, 0, PINK_DK), (2, 0, PINK_DK),
         (-2, 1, PINK), (-1, 1, PINK_DK), (0, 1, PINK_DK), (1, 1, PINK), (2, 1, PINK),
         (-1, 2, PINK), (0, 2, PINK), (1, 2, PINK), (0, 3, PINK)]
SMALL_HEART = [(-1, 0, PINK_HI), (1, 0, PINK_DK), (-1, 1, PINK), (0, 1, PINK), (1, 1, PINK), (0, 2, PINK)]


def beat(i):
    """Neck-Takt: 1 = voll raus (Zunge weit, Lid weit runter)."""
    return 1 if (i % 12) in (2, 3, 4, 5, 6) else 0


def bob(i):
    return -1 if (i % 12) in (3, 4, 5) else 0


def face(a, i):
    y = PT
    if beat(i):
        a[16 + y, 9] = TONGUE                             # Zunge weiter raus
        a[16 + y, 10] = TONGUE_DK
        tip = 9 if (i // 2) % 2 == 0 else 10               # Spitze wackelt
        a[17 + y, tip] = TONGUE_HI
        a[12 + y, 8] = LID_PINK                           # Lid weiter runter
        a[13 + y, 7] = LID_PINK


def draw_heart(out, cx, cy, shape, alpha):
    for dx, dy, c in shape:
        x, y = cx + dx, cy + dy
        if 0 <= x < W and 0 <= y < H:
            if alpha >= 250 or out[y, x, 3] == 0:
                out[y, x] = (*c[:3], alpha)


def hearts(out, i, b):
    t = i % 24
    if t < 3:                                             # neues Herz ploppt auf
        draw_heart(out, 15, 7 + PT + b, SMALL_HEART, 255)
    elif t < 20:                                          # steigt wackelnd auf
        k = t - 3
        cx = 15 + int(round(1.2 * math.sin(k * 0.7)))
        cy = 6 + PT - k // 2 + b
        a = 255 if k < 11 else int(255 * (17 - k) / 6)
        draw_heart(out, cx, cy, HEART, max(0, a))


def frame(i):
    s = BASE.copy()
    for x, y in HEART_PX:                                 # Herz vom Kopf lösen
        s[y + PT, x] = HEART_FILL[(x, y)] if (x, y) in HEART_FILL else (0, 0, 0, 0)
    face(s, i)
    out = np.zeros_like(s)
    b = bob(i)
    feet = 24
    for y in range(H):
        for x in range(W):
            if not s[y, x, 3]:
                continue
            oy = y - PT
            out[y + (b if oy < feet else 0), x] = s[y, x]
    if b < 0:
        for x in range(W):
            if s[feet - 1 + PT, x, 3] and not out[feet - 1 + PT, x, 3]:
                out[feet - 1 + PT, x] = s[feet - 1 + PT, x]
    hearts(out, i, b)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'lilly_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=12)
