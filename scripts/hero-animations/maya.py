# -*- coding: utf-8 -*-
"""Idle-Animation für Maya, the Nature Fairy (MotiveSteamDwarfs.xcf, mittlere
Figur mit weißen Flügeln aus „Maya #5“).

* Sie flattert: die weißen Flügelchen schlagen schnell (spaltentreu geschert,
  zwölf Schläge pro Loop).
* Sie schwebt (sanftes Auf und Ab).
* Um sie tanzen kleine grüne Blattfunken (nur ganz, nur neben der Figur).
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import shear_flap, fill_pinholes

SRC = np.array(Image.open('src/maya-the-nature-fairy.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 4, 5, 4
H, W = SH + PT + PB, SW + 2 * P
N = 48
WING_COLS = {rgb(c) for c in ('fafcfd', 'dbeaf3', '8ebfd9')}
_xs = np.arange(SW)[None, :].repeat(SH, 0)
_w = np.array([[bool(SRC[y, x, 3]) and tuple(SRC[y, x]) in WING_COLS for x in range(SW)] for y in range(SH)])
WING_L = _w & (_xs <= 6)
WING_R = _w & (_xs >= 15)
BODY = SRC.copy()
BODY[WING_L | WING_R] = 0
LEAF = [rgb('7fd35a'), rgb('3fae3a'), rgb('c6f28a')]
LEAVES = [(-3, 4, 0), (SW + 2, 9, 12), (-2, 15, 24), (SW + 1, 2, 36)]   # (x, y, Startframe)


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def frame(i):
    out = np.zeros((H, W, 4), int)
    oy = PT + int(round(math.sin(2 * math.pi * i / 16)))
    ph = 2 * math.pi * i / 4
    lift, sq = 0.45 * math.sin(ph), 0.8 + 0.2 * math.cos(ph)
    shear_flap(SRC, WING_L, 6.5, -1, lift, sq, out, (P, oy))
    shear_flap(SRC, WING_R, 14.5, 1, lift, sq, out, (P, oy))
    for y in range(SH):
        for x in range(SW):
            if BODY[y, x, 3]:
                out[y + oy, x + P] = BODY[y, x]
    fill_pinholes(out)
    for k, (lx, ly, t0) in enumerate(LEAVES):        # Blattfunken steigen auf
        t = (i - t0) % N
        if t >= 10:
            continue
        x = lx + P + int(round(math.sin(t * 0.8 + k)))
        y = ly + PT - t // 2
        if 1 <= x < W - 1 and 1 <= y < H - 1 and not out[y - 1:y + 2, x - 1:x + 2, 3].any():
            out[y, x] = LEAF[k % 3] if t < 8 else (*LEAF[k % 3][:3], 140)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'maya_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10,
                 check_edges=True)
