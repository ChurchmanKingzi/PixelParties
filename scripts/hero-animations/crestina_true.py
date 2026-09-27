# -*- coding: utf-8 -*-
"""Idle-Animation für True Fairy Crestina, the Primordial Goddess.

Figur aus „Ascended Crestina“ (MotiveMoe.xcf); ihre acht übertriebenen
Strahlen-Flügel sind durch neu gezeichnete Feenflügel ersetzt
(crestina_wings.py). Weil die Flügel prozedural sind, werden sie pro Frame
neu gerastert:
* Flügelschlag: alle acht Flügel schwingen gemeinsam hoch und runter
  (die oberen stärker als die unteren) und werden dabei leicht angelegt.
* Ein Lichtschimmer läuft von der Wurzel zu den Spitzen.
* Sie schwebt sanft; um sie blitzen helle Glitzersterne auf.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, sparkle_pixels
from crestina_wings import compose_true_crestina

FIG = np.array(Image.open('src/true-fairy-crestina-the-primordial-goddess-figure.png').convert('RGBA'))
N = 24


def frame_raw(i):
    p = 2 * math.pi * i / 12
    flap = 9.0 * math.sin(p)                         # Grad
    spread = 0.95 + 0.05 * math.cos(p)
    shimmer = (i % 12) / 11 * 1.2 - 0.1
    fig_dy = int(round(-1.0 * math.sin(p - 2.0)))
    return compose_true_crestina(FIG, flap, spread, shimmer, fig_dy + 1).astype(int)


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    raw = [frame_raw(i) for i in range(N)]
    alpha = np.any([f[:, :, 3] > 0 for f in raw], axis=0)
    ys, xs = np.nonzero(alpha)
    y0, y1, x0, x1 = ys.min() - 3, ys.max() + 3, xs.min() - 3, xs.max() + 3
    frames = []
    for i, f in enumerate(raw):
        pad = np.zeros((f.shape[0] + 6, f.shape[1] + 6, 4), int)
        pad[3:-3, 3:-3] = f
        c = pad[y0 + 3:y1 + 4, x0 + 3:x1 + 4].copy()
        h, w = c.shape[:2]
        sp = [(1, h // 3, 0), (w - 2, h // 4, 6), (2, h - 4, 12), (w - 3, h - 6, 18), (w // 2, 1, 9)]
        for (x, y), col in sparkle_pixels(i, N, sp, rgb('ffffa2'), rgb('b4f6ff')).items():
            if 0 <= x < w and 0 <= y < h and c[y, x, 3] == 0:
                c[y, x] = col
        frames.append(c)
    print('Größe', frames[0].shape[1], 'x', frames[0].shape[0])
    save_outputs(f'crestina_true_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=6)
