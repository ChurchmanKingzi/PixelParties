# -*- coding: utf-8 -*-
"""Flug-Animation für Cute Ditz Monami (Sprite aus MotiveMoe.xcf).

Ebenen: Flügelpaar („Monami #1“ – links lavendel, rechts grau) und Figur
(rechte Figur aus „Monami“ samt Fragezeichen), deckungsgleich in
src/cute-ditz-monami-{wings,body}.png.
* Flügelschlag wie bei Mary: jeder Flügel dreht sich um sein
  Schultergelenk (flap_common.rotate_part, 3x3-Mehrheit, Spitzen schwingen
  nach), kräftiger Abschlag, ruhiger Aufschlag; Monami wird beim Abschlag
  angehoben.
* Das Fragezeichen über ihrem Kopf (sie ist verwirrt) hüpft verzögert mit
  und kippt abwechselnd leicht zur Seite.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import save_outputs
from flap_common import rotate_part, over

WINGS = np.array(Image.open('src/cute-ditz-monami-wings.png').convert('RGBA')).astype(int)
BODY = np.array(Image.open('src/cute-ditz-monami-body.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
PL = PR = 6
PT, PB = 12, 6
H, W = SH + PT + PB, SW + PL + PR
N = 32
FLAP = 16
MID_X = 40
PIVOTS = {-1: (36.0, 32.0), 1: (43.0, 31.0)}
UP, DOWN = 0.30, -0.24
LAG = 0.012
QMARK_MAX_Y = 23                                   # Fragezeichen: Zeilen 0..23


def angle(i, r):
    p = 2 * math.pi * (i % FLAP) / FLAP - LAG * r
    s = math.sin(p)
    s = s * (1.25 if s < 0 else 0.85)
    return (UP + DOWN) / 2 + (UP - DOWN) / 2 * max(-1.0, min(1.0, s))


def body_dy(i):
    return int(round(-2.0 * math.sin(2 * math.pi * (i % FLAP) / FLAP - 2.2) - 0.3))


def frame(i):
    out = np.zeros((H, W, 4), int)
    oy = body_dy(i)
    cols = np.arange(SW)[None, :]
    for side in (-1, 1):
        m = (WINGS[:, :, 3] > 0) & ((cols < MID_X) if side < 0 else (cols >= MID_X))
        over(out, rotate_part(WINGS, m, PIVOTS[side], lambda r, s=side: s * angle(i, r),
                              (H, W), (PL, PT + oy)))
    # Figur
    q_dy = body_dy(i - 2)                              # Fragezeichen hängt nach
    q_tilt = 1 if (i // 8) % 2 == 0 else -1
    for y in range(SH):
        for x in range(SW):
            if not BODY[y, x, 3]:
                continue
            if y <= QMARK_MAX_Y:
                dx = q_tilt if y <= 14 else 0          # oberer Bogen kippt
                out[y + PT + q_dy, x + PL + dx] = BODY[y, x]
            else:
                out[y + PT + oy, x + PL] = BODY[y, x]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'monami_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 70, scale=4)
