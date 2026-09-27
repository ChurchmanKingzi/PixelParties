# -*- coding: utf-8 -*-
"""Idle-Animation für Fairy Queen Crestina, the Creation Fairy (MotiveMoe.xcf).

* Sie lächelt mit ^-förmigen Augen (geschlossene, fröhliche Augen); kurz
  zu Beginn des Loops sind die Augen offen.
* Schweben: die ganze Figur samt Aura wippt sanft 1 px auf und ab.
* Die weiß-blauen Flügelchen schimmern (heller Streifen läuft nach oben),
  die lila Aura pulsiert, kleine Glitzersterne blitzen um sie herum auf.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, draw_sparkles, wave

SRC = np.array(Image.open('src/fairy-queen-crestina-the-creation-fairy.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P = 5
H, W = SH + 2 * P, SW + 2 * P
N = 32

D, S, S2 = rgb('311800'), rgb('ffd5a4'), rgb('ee9c7b')
SMILE = [((7, 10), D), ((10, 10), D), ((6, 11), D), ((11, 11), D),      # ^ ^
         ((8, 11), S2), ((9, 11), S2), ((7, 11), S), ((10, 11), S)]
WING_W, WING_C = rgb('f6ffff'), rgb('b4f6ff')
AURA, AURA_HI = rgb('bb99ff'), rgb('d9c8ff')
SPARKLES = [(3, 4, 0), (SW + 6, 5, 9), (3, SH + 2, 17), (SW + 6, SH + 3, 25), (SW + 6, SH // 2 - 2, 13)]


def smiling(i):
    return not (i % N < 5)


def bob(i):
    return int(round(wave(i, 16) * 0.6))                  # -1..1


def frame(i):
    s = SRC.copy()
    if smiling(i):
        for (x, y), c in SMILE:
            s[y, x] = c
    band = SH - 1 - (i * 2) % (SH + 8)                     # Schimmer läuft nach oben
    for y in range(SH):
        for x in range(SW):
            c = tuple(s[y, x])
            if c in (WING_W, WING_C) and (x <= 4 or x >= 13):
                if abs(y - band) <= 1:
                    s[y, x] = rgb('ffffff')
            elif c == AURA:
                if wave(i, 16, 0.5 * (x + y)) > 0.75:     # Aura pulsiert wellenförmig
                    s[y, x] = AURA_HI
    out = np.zeros((H, W, 4), int)
    dy = bob(i)
    m = s[:, :, 3] > 0
    out[P + dy:P + dy + SH, P:P + SW][m] = s[m]
    draw_sparkles(out, i, N, SPARKLES, rgb('d9c8ff'), rgb('bb99ff'))
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'crestina_fq_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=8, check_edges=True)
