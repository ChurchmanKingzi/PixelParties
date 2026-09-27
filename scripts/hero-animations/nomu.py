# -*- coding: utf-8 -*-
"""Idle-Animation für Nomu, Wanderer of Worlds (MotiveBoons.xcf, Ebene „Nomu“).

* Lässiges Federn aus den Knien (Squash and Stretch, Füße fest).
* Er blinzelt einmal pro Loop; über das weiße Hutband läuft ein Glanz.
* Sternenstaub zwischen den Welten: kleine lila und weiße Funken kreisen
  auf einer schrägen Bahn um ihn und funkeln (vorne vor, hinten hinter ihm).
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, draw_bounce, BOUNCE12

SRC = np.array(Image.open('src/nomu-wanderer-of-worlds.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P = 6
H, W = SH + 2 * P, SW + 2 * P
N = 36
KNEE = 20
SKIN, LASH = rgb('b37929'), rgb('4a2a0e')
BLINK = {(6, 8): SKIN, (7, 8): SKIN, (10, 8): SKIN, (11, 8): SKIN,
         (6, 9): LASH, (7, 9): LASH, (10, 9): LASH, (11, 9): LASH}
BAND = [(x, 5) for x in range(4, 13) if SRC[5, x, 3] and SRC[5, x, :3].sum() > 600]
DUST = [rgb('c79bff'), rgb('ffffff'), rgb('8a5cff')]


def frame(i):
    s = SRC.copy()
    if i in (22, 23):
        for (x, y), c in BLINK.items():
            s[y, x] = c
    g = (i % 18) - 4                                  # Glanz übers Hutband
    for k, (x, y) in enumerate(BAND):
        if k == g:
            s[y, x] = rgb('ffffff')
        elif abs(k - g) == 1:
            s[y, x] = rgb('e8f4ff')
    back = np.zeros((H, W, 4), int)
    front = np.zeros((H, W, 4), int)
    for k in range(6):                                # Sternenstaub auf schräger Bahn
        a = 2 * math.pi * (i / N * 2 + k / 6)
        x = int(round(W / 2 + math.cos(a) * (SW / 2 + 3)))
        y = int(round(H / 2 + math.sin(a) * 4 - math.cos(a) * 3))
        c = DUST[k % 3] if (i + k) % 4 else rgb('ffffff')
        (front if math.sin(a) > 0 else back)[y, x] = c
    out = back
    draw_bounce(out, s, BOUNCE12[i % 12], KNEE, P, P)
    m = front[:, :, 3] > 0
    out[m] = front[m]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'nomu_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10,
                 check_edges=True)
