# -*- coding: utf-8 -*-
"""Idle-Animation für Alice, the Transfer Student (MotiveArcanum.xcf, „Transfer Alice“).

* Unheimlich ruhiges Atmen: Kopf und Oberkörper heben sich 1 px, der Rock
  bleibt stehen (Zeile darüber gedehnt).
* Die Spitzen ihrer lila Zöpfe wippen abwechselnd nach außen.
* Sie blinzelt einmal pro Loop.
* Dunkel-lila Schwebeteilchen steigen neben ihr auf und verblassen.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

SRC = np.array(Image.open('src/alice-the-transfer-student.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
PT, P = 6, 4
H, W = SH + PT + 1, SW + 2 * P
N = 40
UPPER = 12
TAIL = {rgb(c) for c in ('463578', '5f49a2', '2a2047')}
SKIN, LASH = rgb('f7bc97'), rgb('311800')
BLINK = {(5, 7): SKIN, (10, 7): SKIN, (5, 8): LASH, (6, 8): LASH, (9, 8): LASH, (10, 8): LASH}
MOTES = [rgb('8a6fd6', 200), rgb('5f49a2', 170), rgb('463578', 120)]


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def breath(i):
    return -1 if math.sin(2 * math.pi * i / 20) > 0.25 else 0


def tail_dx(x, y, i):
    if y > 1 or tuple(SRC[y, x]) not in TAIL:
        return 0
    side = -1 if x < SW / 2 else 1
    return side if (i // 4) % 2 == (0 if side < 0 else 1) else 0


def frame(i):
    s = SRC.copy()
    if i in (26, 27):
        for (x, y), c in BLINK.items():
            s[y, x] = c
    b = breath(i)
    out = np.zeros((H, W, 4), int)
    for y in range(SH):
        for x in range(SW):
            if s[y, x, 3]:
                out[y + PT + (b if y <= UPPER else 0), x + P + tail_dx(x, y, i)] = s[y, x]
    if b:
        for x in range(SW):
            if s[UPPER, x, 3] and not out[UPPER + PT, x + P, 3]:
                out[UPPER + PT, x + P] = s[UPPER, x]
    for m in range(6):                              # Schwebeteilchen
        t = (i + m * 7) % 20
        gen = ((i + m * 7) // 20) % (N // 20)
        side = -1 if m % 2 else 1
        x = int(round(W / 2 + side * (7 + rnd(m, gen) * 3) + math.sin(t * 0.5 + m)))
        y = int(round(H - 4 - t * 0.9))
        if t < 15 and 1 <= x < W - 1 and 1 <= y < H - 1 and out[y, x, 3] == 0:
            out[y, x] = MOTES[min(2, t // 5)]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'alice_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10,
                 check_edges=True)
