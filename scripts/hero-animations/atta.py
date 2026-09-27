# -*- coding: utf-8 -*-
"""Idle-Animation für Atta, Speaker of Desires (MotiveArcanum.xcf, Ebene „Atta“;
für eine künftige Hero-Karte).

* Die abstehende Strähne oben rechts wippt (sie knickt abwechselnd an der
  Spitze und weiter unten ein und federt zurück).
* Sie blinzelt einmal pro Loop.
* Idle mit Squash and Stretch aus den Beinen: alles über dem Mantelsaum
  (samt Händen) federt 1 px hoch (Zeile gedehnt) und 1 px tief (gestaucht),
  die Füße bleiben stehen; die pinken Ornamente glimmen beim Strecken auf.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

SRC = np.array(Image.open('src/atta-speaker-of-desires.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
PT, P = 2, 1
H, W = SH + PT + 1, SW + 2 * P
N = 32
STRAND = [(15, 1), (16, 1), (17, 0), (18, 0), (19, 1), (20, 2), (20, 3)]
KNEE = 22                                           # ab hier stehen Saum und Füße
FACE, LASH = rgb('eeeeee'), rgb('878787')
BLINK = {(7, 8): FACE, (8, 8): FACE, (11, 8): FACE, (12, 8): FACE,
         (7, 9): LASH, (8, 9): LASH, (11, 9): LASH, (12, 9): LASH}
GLOW = {rgb('f30ab3'): rgb('ff66d6'), rgb('fe9373'): rgb('ffc2ae')}


def strand_dy(x, i):
    pose = [0, 1, 2, 1][(i // 2) % 4]               # 0 = Original, 1 = Spitze, 2 = ganz
    if pose == 1:
        return 1 if x >= 19 else 0
    if pose == 2:
        return 1 if x >= 17 else 0
    return 0


def bounce(i):
    """-1 = gestreckt (hoch), +1 = gestaucht (tief)."""
    return [0, 0, -1, -1, -1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0][i % 16]


def frame(i):
    s = SRC.copy()
    if i in (13, 14):
        for (x, y), c in BLINK.items():
            s[y, x] = c
    b = bounce(i)
    if b < 0:
        for y in range(0, SH):
            for x in range(SW):
                if tuple(s[y, x]) in GLOW:
                    s[y, x] = GLOW[tuple(s[y, x])]
    out = np.zeros((H, W, 4), int)
    strand = set(STRAND)
    for y in range(SH):
        for x in range(SW):
            if not s[y, x, 3]:
                continue
            dy = b if y < KNEE else 0
            if (x, y) in strand:
                dy += strand_dy(x, i)
            out[y + PT + dy, x + P] = s[y, x]
    if b < 0:                                       # gestreckt: Zeile über dem Saum dehnen
        y = KNEE - 1
        for x in range(SW):
            if s[y, x, 3] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = s[y, x]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'atta_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10,
                 check_edges=True)
