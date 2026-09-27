# -*- coding: utf-8 -*-
"""Idle-Animation für Thalia, the Fun Fairy (MotiveArcanum.xcf: Thalia + Maske).

* Sie trägt ihre weiße Maske (Ebene „Thalia #1“) und flattert mit den
  Feenflügeln (spaltentreu geschert, flap_common.shear_flap), dabei schwebt
  sie sanft auf und ab.
* Feuerwerk: drei Raketen pro Loop steigen neben/über ihr auf und zerplatzen
  zu bunten Sternen (Farben wie das Feuerwerk der Karte); die Funken fliegen
  aus, sinken leicht und verglimmen. Alles liegt vollständig im Bild.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import shear_flap

BODY = np.array(Image.open('src/thalia-the-fun-fairy.png').convert('RGBA')).astype(int)   # inkl. Maske
SH, SW = BODY.shape[:2]
PX, PT, PB = 14, 16, 3
H, W = SH + PT + PB, SW + 2 * PX
N = 48
WING_COLS = {rgb('f6ffff'), rgb('b4f6ff'), rgb('6ac5ff')}
WING = np.array([[BODY[y, x, 3] > 0 and tuple(BODY[y, x]) in WING_COLS and (x <= 4 or x >= 12)
                  for x in range(SW)] for y in range(SH)])
FIG = BODY.copy()
FIG[WING] = 0
PIVOT = {-1: 5, 1: 12}

# (Startframe, Mitte x, Mitte y, Farbe hell, Farbe, Farbe dunkel)
BURSTS = [(0, 8, 10, 'ffd0d0', 'ff4a4a', 'b02020'),
          (16, 37, 9, 'd8ffc8', '7dff5a', '2fa020'),
          (32, 23, 7, 'e8d0ff', 'c07cff', '7040c0'),
          (8, 38, 24, 'fff0b0', 'ffb030', 'b06010'),
          (40, 7, 25, 'd0f8ff', '5ae0ff', '2080b0')]
RISE, LIFE = 5, 13


def bob(i):
    return -1 if math.sin(2 * math.pi * i / 16) > 0.2 else 0


def fireworks(out, i):
    for start, cx, cy, c0, c1, c2 in BURSTS:
        t = (i - start) % N
        if t >= RISE + LIFE:
            continue
        if t < RISE:                                     # Rakete steigt auf
            y = cy + 2 * (RISE - t)
            for k, c in ((0, rgb('fff6d0')), (1, rgb(c1, 200)), (2, rgb(c2, 120))):
                if out[y + k, cx, 3] == 0:
                    out[y + k, cx] = c
            continue
        u = t - RISE                                     # Explosion
        if u == 0:
            for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                out[cy + dy, cx + dx] = rgb('ffffff')
            continue
        r = min(6.0, 1.2 + u * 0.75)
        for k in range(12):
            a = 2 * math.pi * k / 12 + (0.26 if start % 16 else 0)
            for back, col in ((0, c0 if u < 4 else c1), (1, c1 if u < 6 else c2)):
                rr = r - back * 1.1
                if rr <= 0:
                    continue
                x = int(round(cx + math.cos(a) * rr))
                y = int(round(cy + math.sin(a) * rr + 0.045 * u * u))
                if u > 9 and (k + u) % 2:                # verglimmen: flackern
                    continue
                alpha = 255 if u < 9 else 150
                if out[y, x, 3] == 0:
                    out[y, x] = rgb(col, alpha)


def frame(i):
    out = np.zeros((H, W, 4), int)
    dy = bob(i)
    p = 2 * math.pi * i / 6
    lift, sq = 0.45 * math.sin(p), 0.78 + 0.22 * math.cos(p)
    cols = np.arange(SW)[None, :]
    for side in (-1, 1):
        m = WING & ((cols <= 8) if side < 0 else (cols >= 9))
        shear_flap(BODY, m, PIVOT[side], side, lift, sq, out, (PX, PT + dy), curve=1.0)
    m = FIG[:, :, 3] > 0
    out[PT + dy:PT + dy + SH, PX:PX + SW][m] = FIG[m]
    fireworks(out, i)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'thalia_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=8,
                 check_edges=True)
