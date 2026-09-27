# -*- coding: utf-8 -*-
"""Idle-Animation für den Skin „The Eye of Argos“ (MotiveBoons.xcf, Ebene „Sauron“).

* Die Flammenkrone lodert: die Flammenzungen oben züngeln pro Frame höher
  oder niedriger (Spalten gestreckt/gekappt), die Seitenflammen schlagen
  nach außen, die Flammenfarben flackern; Glutfunken steigen auf.
* Das Auge blinzelt: zwei Lider (Flammenhaut mit dunkler Lidkante) schließen
  sich langsam entlang der Mandelform von oben und unten, bleiben kurz zu
  und öffnen sich ebenso langsam wieder.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import fill_pinholes

SRC = np.array(Image.open('src/the-eye-of-argos.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
PT, P, PB = 6, 5, 2
H, W = SH + PT + PB, SW + 2 * P
N = 40
FLAME = [rgb('dd7011'), rgb('eca42b'), rgb('eec29f')]      # außen -> innen
EYE_COLS = {rgb(c) for c in ('752711', '8b351a', '000000', '4e240e', 'e2bf7b', '58290f', '772c15', '6c2a12')}
IS_EYE = np.array([[SRC[y, x, 3] > 0 and tuple(SRC[y, x]) in EYE_COLS for x in range(SW)] for y in range(SH)])
IS_FLAME = (SRC[:, :, 3] > 0) & ~IS_EYE
LID, LID_EDGE = rgb('eec29f'), rgb('4e240e')
EYE_COLS_X = {x: (min(np.nonzero(IS_EYE[:, x])[0]), max(np.nonzero(IS_EYE[:, x])[0]))
              for x in range(SW) if IS_EYE[:, x].any()}
MID_Y = 18
BLINK = {23: 0.2, 24: 0.4, 25: 0.6, 26: 0.8, 27: 1.0, 28: 1.0, 29: 1.0, 30: 0.8, 31: 0.6, 32: 0.4, 33: 0.2}


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def lids(s, f):
    for x, (y0, y1) in EYE_COLS_X.items():
        top_end = y0 + f * (MID_Y - y0)
        bot_start = y1 - f * (y1 - MID_Y)
        for y in range(y0, y1 + 1):
            if not IS_EYE[y, x]:
                continue
            if y <= top_end or y >= bot_start:
                edge = (y >= top_end - 0.5 and y <= top_end) or (y <= bot_start + 0.5 and y >= bot_start)
                s[y, x] = LID_EDGE if (edge or (f >= 1 and y == MID_Y)) else LID


def frame(i):
    s = SRC.copy()
    if i in BLINK:
        lids(s, BLINK[i])
    # Flammenfarben flackern
    for y, x in zip(*np.nonzero(IS_FLAME)):
        c = tuple(s[y, x])
        if c in FLAME and rnd(x * 7 + y * 13, i) > 0.8:
            k = FLAME.index(c)
            s[y, x] = FLAME[max(0, min(2, k + (1 if rnd(x, i + 3) > 0.5 else -1)))]
    out = np.zeros((H, W, 4), int)
    m = s[:, :, 3] > 0
    out[PT:PT + SH, P:P + SW][m] = s[m]
    # Flammenzungen oben: Spalten züngeln (bis 3 px höher oder 1 px kürzer)
    for x in range(SW):
        ys = np.nonzero(IS_FLAME[:14, x])[0]
        if not len(ys):
            continue
        top = ys.min()
        e = int(round(3.4 * (0.5 + 0.5 * math.sin(2 * math.pi * i / 10 + x * 0.9 + rnd(x, 0) * 6)) - 1))
        if e < 0:
            out[top + PT, x + P] = 0
        for k in range(1, e + 1):
            out[top - k + PT, x + P] = FLAME[0] if k == e else FLAME[1]
    # Seitenflammen schlagen nach außen
    for y in range(SH):
        xs = np.nonzero(IS_FLAME[y])[0]
        if not len(xs) or not 9 <= y <= 20:
            continue
        for side, x0 in ((-1, xs.min()), (1, xs.max())):
            e = int(round(2.2 * (0.5 + 0.5 * math.sin(2 * math.pi * i / 8 + y * 1.1 + side)) - 0.4))
            for k in range(1, e + 1):
                out[y + PT, x0 + side * k + P] = FLAME[0]
    fill_pinholes(out)
    # Glutfunken
    for k in range(6):
        t = (i + k * 7) % 20
        if t >= 12:
            continue
        gen = ((i + k * 7) // 20) % (N // 20)
        x = int(round(6 + rnd(k, gen) * (SW - 12))) + P
        y = PT + 6 - t
        if 1 <= y < H - 1 and out[y, x, 3] == 0:
            out[y, x] = FLAME[1] if t < 6 else FLAME[0]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'eye_of_argos_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=6,
                 check_edges=True)
