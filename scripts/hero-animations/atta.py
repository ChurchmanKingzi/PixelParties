# -*- coding: utf-8 -*-
"""Idle-Animation für Atta, Speaker of Desires (MotiveArcanum.xcf, Ebene „Atta“;
für eine künftige Hero-Karte).

* Die abstehende Strähne oben rechts wippt (sie knickt abwechselnd an der
  Spitze und weiter unten ein und federt zurück).
* Sie blinzelt einmal pro Loop.
* Idle: ruhiges Atmen – Kopf und Schultern heben sich 1 px (die Zeile darunter
  wird gedehnt, keine Lücke), die Hände bleiben; die pinken Ornamente am
  Mantel glimmen im Atemrhythmus auf.
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
UPPER = 17                                          # Zeilen 0..17 atmen mit
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


def breath(i):
    return -1 if math.sin(2 * math.pi * i / 16) > 0.3 else 0


def frame(i):
    s = SRC.copy()
    if i in (13, 14):
        for (x, y), c in BLINK.items():
            s[y, x] = c
    b = breath(i)
    if b:
        for y in range(UPPER + 1, SH):
            for x in range(SW):
                if tuple(s[y, x]) in GLOW:
                    s[y, x] = GLOW[tuple(s[y, x])]
    out = np.zeros((H, W, 4), int)
    strand = set(STRAND)
    for y in range(SH):
        for x in range(SW):
            if not s[y, x, 3]:
                continue
            dy = b if y <= UPPER else 0
            if (x, y) in strand:
                dy += strand_dy(x, i)
            out[y + PT + dy, x + P] = s[y, x]
    if b:                                           # Zeile unter den Schultern dehnen
        for x in range(SW):
            if s[UPPER, x, 3] and not out[UPPER + PT, x + P, 3]:
                out[UPPER + PT, x + P] = s[UPPER, x]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'atta_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10,
                 check_edges=True)
