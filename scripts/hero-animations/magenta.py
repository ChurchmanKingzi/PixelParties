# -*- coding: utf-8 -*-
"""Idle-Animation für Cute Nerd Magenta (Sprite aus MotiveMoe.xcf).

Ebenen: Fledermausflügel („Magenta #2“) und Figur („Magenta“),
deckungsgleich in src/cute-nerd-magenta-{wings,body}.png.
* Fledermaus-Flügelschlag: die Flügel drehen sich um die Schultern
  (flap_common.rotate_part, Spitzen schwingen nach); sie schwebt dabei auf
  und ab.
* Nerd-Brille: ein Lichtreflex huscht über beide Gläser, am rechten Glas
  blitzt kurz ein Glanzstern auf.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import rotate_part, over

WINGS = np.array(Image.open('src/cute-nerd-magenta-wings.png').convert('RGBA')).astype(int)
BODY = np.array(Image.open('src/cute-nerd-magenta-body.png').convert('RGBA')).astype(int)
SH, SW = BODY.shape[:2]
P, PT, PB = 3, 10, 7
H, W = SH + PT + PB, SW + 2 * P
N = 32
FLAP = 16
MID_X = 29
PIVOTS = {-1: (25.0, 11.0), 1: (34.0, 11.0)}
UP, DOWN = 0.36, -0.30
LAG = 0.02
LENSES = [[(26, 11), (26, 10), (27, 11), (27, 10)], [(30, 11), (30, 10), (31, 11), (31, 10)]]
WHITE, SHINE = rgb('ffffff'), rgb('e8ffff')


def angle(i, r):
    p = 2 * math.pi * (i % FLAP) / FLAP - LAG * r
    s = math.sin(p)
    s = s * (1.2 if s < 0 else 0.9)
    return (UP + DOWN) / 2 + (UP - DOWN) / 2 * max(-1.0, min(1.0, s))


def body_dy(i):
    return int(round(-1.6 * math.sin(2 * math.pi * (i % FLAP) / FLAP - 2.2)))


def glint(s, i):
    """Reflex wandert von links unten nach rechts oben über beide Gläser."""
    t = i - 20
    if not 0 <= t < 8:
        return None
    seq = LENSES[0] + LENSES[1]
    for k, (x, y) in enumerate(seq):
        if k == t:
            s[y, x] = WHITE
        elif abs(k - t) == 1:
            s[y, x] = SHINE
    return (33, 8) if 5 <= t <= 7 else None


def frame(i):
    out = np.zeros((H, W, 4), int)
    oy = body_dy(i)
    cols = np.arange(SW)[None, :]
    for side in (-1, 1):
        m = (WINGS[:, :, 3] > 0) & ((cols < MID_X) if side < 0 else (cols >= MID_X))
        over(out, rotate_part(WINGS, m, PIVOTS[side], lambda r, s=side: s * angle(i, r),
                              (H, W), (P, PT + oy)))
    s = BODY.copy()
    star = glint(s, i)
    m = s[:, :, 3] > 0
    out[PT + oy:PT + oy + SH, P:P + SW][m] = s[m]
    if star:
        x, y = star[0] + P, star[1] + PT + oy
        arm = 1 if i - 20 != 6 else 2
        out[y, x] = WHITE
        for d in range(1, arm + 1):
            for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d)):
                out[y + dy, x + dx] = SHINE if d == 1 else rgb('9fe8ff')
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'magenta_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 70, scale=6, check_edges=True)
