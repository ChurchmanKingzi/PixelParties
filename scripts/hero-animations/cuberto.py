# -*- coding: utf-8 -*-
"""Idle-Animationen für Cuberto, Supreme Lord of Edges (Hero, „Ebene #4“) und
den Skin Extra Edgy Cuberto („Ebene #5“), MotiveBoons.xcf – jeweils ohne den
Erdwürfel.

Aufruf: python3 cuberto.py <tag> [ms] [hero|edgy]

* Beide federn aus den Knien (Squash and Stretch, Füße fest).
* Hero: blinzelt; kleine Würfel (2x2, hellblau/weiß mit Kante) steigen
  kantig um ihn auf – der Herr der Kanten.
* Edgy: die roten Stacheln schlagen abwechselnd nach außen aus, die roten Augen
  glühen auf, rote Chaos-Funken knistern um ihn herum.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, draw_bounce, BOUNCE12

VARIANT = 'edgy' if 'edgy' in sys.argv[2:] else 'hero'
SLUG = {'hero': 'cuberto-supreme-lord-of-edges', 'edgy': 'extra-edgy-cuberto'}[VARIANT]
SRC = np.array(Image.open(f'src/{SLUG}.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P = 5
H, W = SH + 2 * P, SW + 2 * P
N = 36
KNEE = SH - 5
CUBE = [rgb('dff6ff'), rgb('8fd8ff'), rgb('3c7fb0')]
RED = {rgb('b80a09'), rgb('800000'), rgb('660000')}
EYE_RED = {rgb('3e0000'): rgb('ff3030'), rgb('7e0000'): rgb('ff4040')}
SPARK = [rgb('ffffff'), rgb('ff4a3a'), rgb('b00000')]


def rnd(k, i):
    v = math.sin(k * 12.9898 + i * 78.233) * 43758.5453
    return v - math.floor(v)


def quill_flare(out, s, i, b):
    """Edgy: die äußeren roten Stacheln schlagen abwechselnd links/rechts 1 px
    nach außen aus (äußerster Pixel wird verlängert – keine Lücken)."""
    side = -1 if (i // 3) % 2 == 0 else 1
    for y in range(6, 15):
        xs = [x for x in range(SW) if s[y, x, 3] and tuple(s[y, x]) in RED]
        if not xs:
            continue
        x0 = min(xs) if side < 0 else max(xs)
        if (side < 0 and x0 <= 2) or (side > 0 and x0 >= SW - 3):
            out[y + P + b, x0 + side + P] = s[y, x0]


def frame(i):
    s = SRC.copy()
    out = np.zeros((H, W, 4), int)
    if VARIANT == 'hero':
        if i in (20, 21):
            for x, y in ((6, 11), (7, 11), (10, 11), (11, 11)):
                s[y, x] = rgb('311800')
        for k in range(5):                            # Würfel steigen auf
            t = (i + k * 7) % 18
            if t >= 14:
                continue
            gen = ((i + k * 7) // 18) % (N // 18)
            side = -1 if k % 2 else 1
            x = int(round(W / 2 + side * (SW / 2 + 1 + rnd(k, gen) * 2)))
            y = H - 6 - t
            for dx, dy, c in ((0, 0, CUBE[0]), (1, 0, CUBE[1]), (0, 1, CUBE[1]), (1, 1, CUBE[2])):
                if 1 <= x + dx < W - 1 and 1 <= y + dy < H - 1:
                    out[y + dy, x + dx] = c
        draw_bounce(out, s, BOUNCE12[i % 12], KNEE, P, P)
    else:
        if (i // 6) % 2:                              # Augen glühen auf
            for y, x in zip(*np.nonzero(SRC[:, :, 3])):
                c = tuple(SRC[y, x])
                if c in EYE_RED:
                    s[y, x] = EYE_RED[c]
        draw_bounce(out, s, BOUNCE12[i % 12], KNEE, P, P)
        quill_flare(out, s, i, BOUNCE12[i % 12])
        for k in range(4):                            # Chaos-Funken (kurze Zickzacks)
            t = (i + k * 9) % 12
            if t >= 4:
                continue
            gen = ((i + k * 9) // 12) % (N // 12)
            ang = rnd(k, gen) * 2 * math.pi
            x0 = W / 2 + math.cos(ang) * (SW / 2 + 1)
            y0 = H / 2 + math.sin(ang) * (SH / 2 - 2)
            for j in range(4):
                x = int(round(x0 + j * math.cos(ang) + (1 if j % 2 else -1) * math.sin(ang) * 0.8))
                y = int(round(y0 + j * math.sin(ang) - (1 if j % 2 else -1) * math.cos(ang) * 0.8))
                if 1 <= x < W - 1 and 1 <= y < H - 1 and out[y, x, 3] == 0:
                    out[y, x] = SPARK[min(2, t)]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'cuberto_{VARIANT}_idle_{tag}', frames, ms, scale=8, check_edges=True)
