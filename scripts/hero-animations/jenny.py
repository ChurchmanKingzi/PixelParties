# -*- coding: utf-8 -*-
"""Idle-Animation für Jenny, the Class Fairy (Ebene „Jenny new“, MotiveMoe.xcf).

Gleiches Grundgerüst wie Fairy Queen Crestina, in Gelb:
* Schweben: Figur samt gelber Aura wippt sanft 1 px auf und ab.
* Die Flügelchen schimmern (heller Streifen läuft nach oben), die Aura
  pulsiert wellenförmig, gelbe Glitzersterne blitzen um sie herum auf.
* Ihre fröhlichen ^-Augen bleiben; einmal pro Loop kichert sie – der Kopf
  wippt kurz zweimal.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, sparkle_pixels, wave

SRC = np.array(Image.open('src/jenny-the-class-fairy.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P = 4
H, W = SH + 2 * P, SW + 2 * P
N = 32
WING = {rgb('f6ffff'), rgb('b4f6ff'), rgb('6ac5ff')}
AURA, AURA_HI = rgb('fffd99'), rgb('ffffd6')
SPARKLES = [(2, 7, 0), (SW + 5, 10, 9), (1, 19, 17), (SW + 6, 21, 25), (SW // 2 + P, 1, 13)]
HEAD_MAX_Y = 13


def bob(i):
    return int(round(wave(i, 16) * 0.6))


def giggle(i):
    return 1 if i in (20, 21, 24, 25) else 0


def frame(i):
    s = SRC.copy()
    band = SH - 1 - (i * 2) % (SH + 8)
    for y in range(SH):
        for x in range(SW):
            c = tuple(s[y, x])
            if c in WING and (x <= 4 or x >= 13):
                if abs(y - band) <= 1:
                    s[y, x] = rgb('ffffff')
            elif c == AURA and wave(i, 16, 0.5 * (x + y)) > 0.75:
                s[y, x] = AURA_HI
    out = np.zeros((H, W, 4), int)
    dy = bob(i)
    g = giggle(i)
    for y in range(SH):
        for x in range(SW):
            if s[y, x, 3]:
                head = y <= HEAD_MAX_Y and 5 <= x <= 12
                out[P + dy + y + (g if head else 0), P + x] = s[y, x]
    for (x, y), c in sparkle_pixels(i, N, SPARKLES, rgb('fff27a'), rgb('e6d21e')).items():
        if 0 <= x < W and 0 <= y < H and out[y, x, 3] == 0:
            out[y, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'jenny_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=8)
