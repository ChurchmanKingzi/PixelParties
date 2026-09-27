# -*- coding: utf-8 -*-
"""Idle-Animation für Lord Mithuru, the Rotten Mastermind (MotiveArcanum.xcf:
Mithuru + Weinglas aus „Ebene #29“/„Ebene #30“).

* Er hält sein Weinglas: der Wein schwenkt darin hin und her (die Oberfläche
  kippt, der Glanz wandert mit), das Glas atmet mit der Hand mit.
* Ruhiges, überhebliches Atmen: Oberkörper samt Armen und Glas hebt sich
  1 px, die Beine bleiben stehen (Zeile darüber gedehnt).
* Über seine Brillengläser huscht einmal pro Loop ein Lichtreflex.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

BODY = np.array(Image.open('src/lord-mithuru-the-rotten-mastermind-body.png').convert('RGBA')).astype(int)
GLASS = np.array(Image.open('src/lord-mithuru-the-rotten-mastermind-glass.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
PT, P = 2, 1
H, W = SH + PT + 1, SW + 2 * P
N = 32
LEGS = 22
WINE, WINE_HI = (229, 90, 90, 245), (244, 103, 101, 245)
RIM = [(11, 15), (12, 15), (13, 15)]
SURF = [(11, 16), (12, 16), (13, 16)]
LENS = [(5, 9), (5, 10), (9, 9), (10, 9), (9, 10), (10, 10)]
WHITE, SHINE = rgb('ffffff'), rgb('e8f6ff')


def breath(i):
    return -1 if math.sin(2 * math.pi * i / 16) > 0.2 else 0


def slosh(g, i):
    """Wein kippt: links hoch – eben – rechts hoch – eben (Glanz wandert mit)."""
    phase = (i // 3) % 4
    for x, y in SURF:
        g[y, x] = WINE
    hi = [11, 12, 13, 12][phase]
    g[16, hi] = WINE_HI
    if phase == 0:                                   # links hochgeschwappt
        g[15, 11] = WINE
        g[16, 13] = GLASS[17, 12]
    elif phase == 2:                                 # rechts hochgeschwappt
        g[15, 13] = WINE
        g[16, 11] = GLASS[17, 12]


def glint(s, i):
    t = i - 22
    if not 0 <= t < 6:
        return
    for k, (x, y) in enumerate(LENS):
        if k == t:
            s[y, x] = WHITE
        elif abs(k - t) == 1:
            s[y, x] = SHINE


def frame(i):
    s = BODY.copy()
    glint(s, i)
    g = GLASS.copy()
    slosh(g, i)
    b = breath(i)
    out = np.zeros((H, W, 4), int)
    for src in (s, g):
        for y in range(SH):
            for x in range(SW):
                if src[y, x, 3]:
                    c = src[y, x]
                    oy, ox = y + PT + (b if y < LEGS else 0), x + P
                    if c[3] < 255 and out[oy, ox, 3]:        # halbtransparentes Glas mischen
                        f = c[3] / 255
                        c = (*[int(round(f * c[k] + (1 - f) * out[oy, ox, k])) for k in range(3)], 255)
                    out[oy, ox] = c
    if b:
        y = LEGS - 1
        for x in range(SW):
            if s[y, x, 3] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = s[y, x]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'mithuru_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10,
                 check_edges=True)
