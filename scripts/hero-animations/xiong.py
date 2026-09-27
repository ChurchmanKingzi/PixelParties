# -*- coding: utf-8 -*-
"""Idle-Animation für Xiong, the Bamboo Guardian (MotiveChina.xcf: „Xiong“).

* Er federt in den Knien (die Füße bleiben stehen).
* Er schwingt seinen Bambusstab: der Stab kippt in seinen Händen wie eine
  Wippe – das linke Ende senkt sich, während das rechte steigt, und umgekehrt
  (spaltenweise verschoben, zu den Enden hin stärker; die Hände bleiben).
* Er blinzelt zweimal pro Loop (geschlossen: 2 px breite schwarze Striche).
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, BOUNCE12
from flap_common import fill_pinholes

SRC = np.array(Image.open('src/xiong-the-bamboo-guardian.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 3, 4, 2
H, W = SH + PT + PB, SW + 2 * P
N = 48
KNEE = 23
BLACK = (0, 0, 0, 255)
LID = rgb('a16033')
BLINK = {14: 'halb', 15: 'zu', 16: 'zu', 17: 'halb', 38: 'halb', 39: 'zu', 40: 'zu', 41: 'halb'}
WHITES = [(12, 10), (19, 10)]                        # helles Fell neben den Augen
LINE = [(12, 10), (13, 10), (18, 10), (19, 10)]
# Stabenden außerhalb der Hände
STAFF_L = {(x, y) for y in range(16, 19) for x in range(0, 6) if SRC[y, x, 3]}
STAFF_R = {(x, y) for y in range(11, 16) for x in range(26, SW) if SRC[y, x, 3]}


def tilt(i):
    """Kippen des Stabs an den Enden (-2..2), Frame 0 = Ruhelage."""
    return 1.8 * math.sin(2 * math.pi * i / 24)


def frame(i):
    s = SRC.copy()
    st = BLINK.get(i)
    if st:
        for x, y in WHITES:
            s[y, x] = LID
        if st == 'zu':
            for x, y in LINE:
                s[y, x] = BLACK
    out = np.zeros((H, W, 4), int)
    b = BOUNCE12[i % 12]
    t = tilt(i)
    for y in range(SH):
        for x in range(SW):
            if not s[y, x, 3]:
                continue
            dy = b if y < KNEE else 0
            if (x, y) in STAFF_L:
                dy += int(round(t * (6 - x) / 6))
            elif (x, y) in STAFF_R:
                dy -= int(round(t * (x - 25) / (SW - 26)))
            out[y + PT + dy, x + P] = s[y, x]
    if b < 0:                                        # Zeile über dem Knie dehnen
        y = KNEE - 1
        for x in range(SW):
            if s[y, x, 3] and not out[y + PT, x + P, 3]:
                out[y + PT, x + P] = s[y, x]
    fill_pinholes(out)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'xiong_idle_{tag}', frames, ms, scale=8, check_edges=True)
