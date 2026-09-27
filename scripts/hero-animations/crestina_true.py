# -*- coding: utf-8 -*-
"""Idle-Animation für True Fairy Crestina, the Primordial Goddess.

Figur aus „Ascended Crestina“ (MotiveMoe.xcf); ihre acht übertriebenen
Strahlen-Flügel sind durch neu gezeichnete Feenflügel ersetzt
(crestina_wings.py). Weil die Flügel prozedural sind, werden sie pro Frame
neu gerastert:
* Flügelschlag: alle acht Flügel schwingen gemeinsam hoch und runter
  (die oberen stärker als die unteren) und werden dabei leicht angelegt.
* Ein Lichtschimmer läuft von der Wurzel zu den Spitzen.
* Halbtransparentes Leuchten: ein weicher, 3 px breiter Lichtsaum um Flügel
  und Figur plus ein schwacher Schein hinter ihr, beides pulsiert.
* Sie schwebt sanft; um sie blitzen helle Glitzersterne auf.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, draw_sparkles, ring8
from crestina_wings import compose_true_crestina, PAD_X, PAD_Y

FIG = np.array(Image.open('src/true-fairy-crestina-the-primordial-goddess-figure.png').convert('RGBA'))
N = 24
GLOW = (255, 255, 200)
GLOW_A = [120, 70, 32]                           # Deckkraft des Saums je Abstand


def frame_raw(i):
    p = 2 * math.pi * i / 12
    flap = 9.0 * math.sin(p)                     # Grad
    spread = 0.95 + 0.05 * math.cos(p)
    shimmer = (i % 12) / 11 * 1.2 - 0.1
    fig_dy = int(round(-1.0 * math.sin(p - 2.0)))
    return compose_true_crestina(FIG, flap, spread, shimmer, fig_dy + 1).astype(int)


def add_glow(f, i):
    pulse = 0.75 + 0.25 * math.sin(2 * math.pi * i / N * 2)
    h, w = f.shape[:2]
    solid = f[:, :, 3] > 0
    alpha = np.zeros((h, w))
    m = solid.copy()
    for a in GLOW_A:                             # Saum um die Silhouette
        r = ring8(m)
        alpha[r] = np.maximum(alpha[r], a * pulse)
        m |= r
    cx, cy = PAD_X + FIG.shape[1] / 2, PAD_Y + FIG.shape[0] / 2
    yy, xx = np.mgrid[0:h, 0:w]
    rad = np.hypot(xx - cx, (yy - cy) * 1.1)
    bloom = np.clip(1 - rad / 16, 0, 1) * 60 * pulse   # Schein hinter ihr
    alpha = np.maximum(alpha, bloom)
    g = (~solid) & (alpha >= 8)
    f[g] = np.stack([np.full(g.sum(), GLOW[0]), np.full(g.sum(), GLOW[1]),
                     np.full(g.sum(), GLOW[2]), alpha[g].round()], axis=1).astype(int)
    return f


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    raw = [add_glow(frame_raw(i), i) for i in range(N)]
    alpha = np.any([f[:, :, 3] > 0 for f in raw], axis=0)
    ys, xs = np.nonzero(alpha)
    y0, y1, x0, x1 = ys.min() - 5, ys.max() + 5, xs.min() - 5, xs.max() + 5
    frames = []
    for i, f in enumerate(raw):
        pad = np.zeros((f.shape[0] + 10, f.shape[1] + 10, 4), int)
        pad[5:-5, 5:-5] = f
        c = pad[y0 + 5:y1 + 6, x0 + 5:x1 + 6].copy()
        h, w = c.shape[:2]
        sp = [(3, 3, 0), (w - 4, 4, 6), (3, h - 4, 12), (w - 4, h - 4, 18), (w // 2, 3, 9)]
        draw_sparkles(c, i, N, sp, rgb('ffffa2'), rgb('b4f6ff'))
        frames.append(c)
    print('Größe', frames[0].shape[1], 'x', frames[0].shape[0])
    save_outputs(f'crestina_true_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=6,
                 check_edges=True)
