# -*- coding: utf-8 -*-
"""Idle-Animation für Nomu, Wanderer of Worlds (MotiveBoons.xcf, Ebene „Nomu“).

* Lässiges Federn aus den Knien (Squash and Stretch, Füße fest).
* Er blinzelt einmal pro Loop; über das weiße Hutband läuft ein Glanz.
* Hinter ihm schwebt sein Weltenportal (Ebene „Nomu #1“, verkleinert auf
  rund drei Viertel): es pulsiert sanft, und ein heller Schimmer kreist auf
  seinem Rand.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, draw_bounce, BOUNCE12

SRC = np.array(Image.open('src/nomu-wanderer-of-worlds.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P = 9
PORTAL = Image.open('src/nomu-wanderer-of-worlds-portal.png').convert('RGBa')   # vormultipliziert
PORTAL_C = (-12 + PORTAL.width / 2, -4 + PORTAL.height / 2)                   # Mitte relativ zu Nomu
H, W = SH + 2 * P, SW + 2 * P
N = 36
KNEE = 20
SKIN, LASH = rgb('b37929'), rgb('4a2a0e')
BLINK = {(6, 8): SKIN, (7, 8): SKIN, (10, 8): SKIN, (11, 8): SKIN,
         (6, 9): LASH, (7, 9): LASH, (10, 9): LASH, (11, 9): LASH}
BAND = [(x, 5) for x in range(4, 13) if SRC[5, x, 3] and SRC[5, x, :3].sum() > 600]


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
    out = np.zeros((H, W, 4), int)
    k = 0.72 + 0.04 * math.sin(2 * math.pi * i / 18)          # Portal pulsiert
    pw, ph = round(PORTAL.width * k), round(PORTAL.height * k)
    por = np.array(PORTAL.resize((pw, ph), Image.LANCZOS).convert('RGBA')).astype(int)
    por[por[:, :, 3] < 24] = 0                                    # fast unsichtbaren Saum weg
    px0 = int(round(P + PORTAL_C[0] - pw / 2))
    py0 = int(round(P + PORTAL_C[1] - ph / 2))
    out[py0:py0 + ph, px0:px0 + pw] = por
    rr = min(pw, ph) / 2 - 1.2                                   # Schimmer auf dem Rand
    for j in range(3):
        a = 2 * math.pi * (i / N * 2) + j * 0.35
        x = int(round(px0 + pw / 2 + math.cos(a) * rr))
        y = int(round(py0 + ph / 2 + math.sin(a) * rr))
        out[y, x] = (216, 176, 255, 230 - j * 60)
    draw_bounce(out, s, BOUNCE12[i % 12], KNEE, P, P)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'nomu_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10,
                 check_edges=True)
