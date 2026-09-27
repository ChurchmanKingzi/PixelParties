# -*- coding: utf-8 -*-
"""Idle-Animation für Jenny, the Class Fairy (Ebene „Jenny new“, MotiveMoe.xcf).

* Die Flügelchen flattern ununterbrochen (schnell, spaltentreu geschert
  und gestaucht – flap_common.shear_flap).
* Die gelbe Aura umgibt sie immer exakt: sie ist im Original genau der
  1-px-Rand (8er-Nachbarschaft) um Figur und Flügel und wird deshalb in jedem
  Frame neu um die aktuelle Silhouette gelegt; dazu pulsiert sie wellenförmig.
* Schweben: sie wippt sanft 1 px auf und ab; einmal pro Loop kichert sie
  (Kopf wippt kurz zweimal). Gelbe Glitzersterne blitzen um sie herum auf.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, draw_sparkles, wave, ring8
from flap_common import shear_flap

SRC = np.array(Image.open('src/jenny-the-class-fairy.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P = 5
H, W = SH + 2 * P, SW + 2 * P
N = 32
AURA, AURA_HI = rgb('fffd99'), rgb('ffffd6')
WING_COLS = {rgb('f6ffff'), rgb('b4f6ff'), rgb('6ac5ff')}
IS_AURA = np.array([[tuple(SRC[y, x]) == AURA and SRC[y, x, 3] > 0 for x in range(SW)] for y in range(SH)])
IS_WING = np.array([[SRC[y, x, 3] > 0 and tuple(SRC[y, x]) in WING_COLS and (x <= 4 or x >= 13)
                     for x in range(SW)] for y in range(SH)])
BODY = SRC.copy()
BODY[IS_AURA | IS_WING] = 0
PIVOT = {-1: 5, 1: 12}
FLUTTER = 4                                       # Frames pro Flügelschlag
SPARKLES = [(3, 4, 0), (SW + 6, 5, 9), (3, SH + 2, 17), (SW + 6, SH + 3, 25), (3, SH // 2, 13)]
HEAD_MAX_Y = 13


def bob(i):
    return int(round(wave(i, 16) * 0.6))


def giggle(i):
    return 1 if i in (20, 21, 24, 25) else 0


def frame(i):
    out = np.zeros((H, W, 4), int)
    dy = bob(i)
    # Flügel flattern
    p = 2 * math.pi * i / FLUTTER
    lift, sq = 0.4 * math.sin(p), 0.8 + 0.2 * math.cos(p)
    cols = np.arange(SW)[None, :]
    band = SH - 1 - (i * 2) % (SH + 8)
    wings = SRC.copy()
    for y in range(SH):
        for x in range(SW):
            if IS_WING[y, x] and abs(y - band) <= 1:
                wings[y, x] = rgb('ffffff')          # Schimmer läuft nach oben
    for side in (-1, 1):
        m = IS_WING & ((cols <= 8) if side < 0 else (cols >= 9))
        shear_flap(wings, m, PIVOT[side], side, lift, sq, out, (P, P + dy), curve=1.0)
    # Körper (Kopf kichert)
    g = giggle(i)
    for y in range(SH):
        for x in range(SW):
            if BODY[y, x, 3]:
                head = y <= HEAD_MAX_Y and 5 <= x <= 12
                out[P + dy + y + (g if head else 0), P + x] = BODY[y, x]
    # Aura: exakt 1 px um die aktuelle Silhouette
    for y, x in zip(*np.nonzero(ring8(out[:, :, 3] > 0))):
        out[y, x] = AURA_HI if wave(i, 16, 0.5 * (x + y)) > 0.75 else AURA
    draw_sparkles(out, i, N, SPARKLES, rgb('fff27a'), rgb('e6d21e'))
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'jenny_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=8, check_edges=True)
