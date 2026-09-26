# -*- coding: utf-8 -*-
"""Idle-Animation für Damus, the Prophet of Apocalypse (20x29).

* Das Schild ist ein bemaltes Schild: sein Inferno-Bild bleibt unverändert
  und bewegt sich nur mit dem Körper mit.
* Verrückter Prophet: Augen huschen hin und her, der Mund plappert, die
  Haarspitzen zucken.
* Er wippt aufgeregt auf den Zehenspitzen (Füße bleiben am Boden, darüber
  blitzen die dürren Beine hervor).
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, save_outputs

BASE = np.array(Image.open('src/damus-the-prophet-of-apocalypse.png').convert('RGBA')).astype(int)
H, W = BASE.shape[:2]
N = 40
CLEAR = (0, 0, 0, 0)

# ---------------------------------------------------------------- Gesicht
EYE_ROW = 11
DARK = rgb('414141')
IRIS_L, IRIS_R = rgb('6f0000'), rgb('710000')


def eyes(a, i):
    t = i % N
    seq = [(0, 'mitte'), (6, 'links'), (9, 'mitte'), (17, 'rechts'), (19, 'links'),
           (21, 'mitte'), (30, 'links'), (32, 'rechts'), (35, 'mitte')]
    state = 'mitte'
    for s0, st in seq:
        if t >= s0:
            state = st
    # 'mitte' = Original (Pupillen schielen nach innen)
    if state == 'links':                    # beide Pupillen nach links
        a[EYE_ROW, 7], a[EYE_ROW, 8] = IRIS_L, DARK
        a[EYE_ROW, 11], a[EYE_ROW, 12] = IRIS_R, DARK
    elif state == 'rechts':                 # beide nach rechts
        a[EYE_ROW, 7], a[EYE_ROW, 8] = DARK, IRIS_L
        a[EYE_ROW, 11], a[EYE_ROW, 12] = DARK, IRIS_R


MOUTH_OPEN = [rgb('310800'), rgb('6f0000')]


def mouth(a, i):
    """Plappern: Mund geht unregelmäßig auf und zu."""
    pattern = [0, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0]
    if pattern[i % len(pattern)] and (i % N) < 36:
        a[13, 9] = MOUTH_OPEN[0]
        a[13, 10] = MOUTH_OPEN[0]


HAIR_TIPS = [(6, 4), (9, 4), (13, 4), (7, 5), (12, 5), (5, 6), (14, 7)]


def hair_jitter(a, i):
    for k, (x, y) in enumerate(HAIR_TIPS):
        if ((i + k * 3) % 7) in (0, 1):
            c = a[y, x].copy()
            a[y, x] = CLEAR
            nx = x + (1 if k % 2 else -1)
            if a[y, nx, 3] == 0:
                a[y, nx] = c
            else:
                a[y - 1, x] = c


# ---------------------------------------------------------------- Körper
LEG = rgb('f6bd7b')
LEG_SH = rgb('d5a462')


def hop(i):
    """Aufgeregtes Wippen auf den Zehen: 0 oder -1 (hoch)."""
    t = i % 10
    return -1 if t in (2, 3, 4, 7, 8) else 0


def frame(i):
    s = BASE.copy()
    eyes(s, i)
    mouth(s, i)
    hair_jitter(s, i)
    out = np.zeros_like(s)
    d = hop(i)
    head_d = hop(i - 1)
    for y in range(H):
        for x in range(W):
            if y >= 28:
                dy = 0                                   # Füße bleiben am Boden
            elif y <= 14:
                dy = head_d
            else:
                dy = d
            sy = y - dy
            if 0 <= sy < H and s[sy, x, 3]:
                if y >= 28 or sy < 28:
                    out[y, x] = s[sy, x]
    if d < 0:                                            # dürre Beine über den Füßen
        for x in (6, 7, 12, 13):
            out[27, x] = LEG if x in (6, 12) else LEG_SH
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'damus_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=12)
