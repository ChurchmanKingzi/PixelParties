# -*- coding: utf-8 -*-
"""Idle-Animation für Sett, the Adept of Necromancy (24x29 + Rand = 27x31).

* Er schwebt: sanftes Auf und Ab, Kapuzenspitze schwingt nach.
* Die Kutte fließt und mündet unten in wabernde Tentakel: Wellen laufen
  nach unten, Auslenkung wächst zu den Spitzen, stetig über die Breite.
* Das rote Auge glimmt, die Hände heben und senken sich leicht verzögert.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, save_outputs

SRC = np.array(Image.open('src/sett-the-adept-of-necromancy.png').convert('RGBA')).astype(int)
PL, PT, PR, PB = 1, 1, 2, 1
BASE = np.zeros((SRC.shape[0] + PT + PB, SRC.shape[1] + PL + PR, 4), int)
BASE[PT:PT + SRC.shape[0], PL:PL + SRC.shape[1]] = SRC
H, W = BASE.shape[:2]
N = 40


def o(x, y):
    return x - PL, y - PT


ROBE_TOP = 20                                  # ab hier (Original) wabert die Kutte
def tentacle_dx(ox, oy, i):
    """Wabern: stetige Welle (über Breite und Höhe), wächst zu den Spitzen."""
    if oy < ROBE_TOP:
        return 0
    u = min(1.0, (oy - ROBE_TOP + 1) / 7)
    v = 1.6 * u ** 1.2 * wave(i, 20, 0.22 * ox - 0.5 * (oy - ROBE_TOP))
    return int(round(v))


def tentacle_dy(ox, oy, i):
    """Spitzen heben und senken sich leicht."""
    if oy < ROBE_TOP + 3:
        return 0
    return 0                                   # (vertikal: zerreißt den Saum)


def float_dy(i, lag=0):
    return int(round(1.2 * wave(i - lag, N)))


def hood_dx(ox, oy, i):
    if oy <= 6:
        return int(round((7 - oy) / 6 * 1.0 * wave(i, N, -1.2)))
    return 0


def hands_dy(ox, oy, i):
    if 16 <= oy <= 19 and (5 <= ox <= 8 or 15 <= ox <= 18):
        return int(round(0.8 * wave(i, 20, 1.5 if ox < 12 else 0.4)))
    return 0


EYE = (10, 13)
EYE_GLOW = [rgb('9a0000'), rgb('ff0000'), rgb('ff7a6a')]


def frame(i):
    s = BASE.copy()
    lv = int(round(1 + wave(i, 20)))
    s[EYE[1] + PT, EYE[0] + PL] = EYE_GLOW[lv]
    out = np.zeros_like(s)
    for y in range(H):
        for x in range(W):
            ox, oy = o(x, y)
            lag = 2 if oy >= ROBE_TOP else (1 if oy <= 8 else 0)
            dy = float_dy(i, lag) + hands_dy(ox, oy, i) + tentacle_dy(ox, oy, i)
            dx = tentacle_dx(ox, oy - float_dy(i, lag), i) + hood_dx(ox, oy, i)
            sx, sy = x - dx, y - dy
            if 0 <= sx < W and 0 <= sy < H and s[sy, sx, 3]:
                out[y, x] = s[sy, sx]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'sett_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=12)
