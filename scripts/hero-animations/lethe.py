# -*- coding: utf-8 -*-
"""Idle-Animation für Lethe, the Forgetful Fixer und den Skin Reaping Lethe
(MotiveEgypt.xcf; Haar aus „Ebene #117“ ergänzt, Sense aus „Ebene #116“).

Aufruf: python3 lethe.py <tag> [ms] [hero|reaping]

* Sie schwebt (sanftes Auf und Ab, Sense inklusive).
* Die weißen Haarspitzen wehen: eine Welle läuft durch die Strähnen, die
  Spitzen schwingen 1 px, die Mitte nur im Umkehrpunkt, der Ansatz bleibt.
* Der zerfetzte Umhang flattert unten (je tiefer, desto stärker).
* Reaping Lethe: die roten Augen glühen auf und ab.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs
from flap_common import fill_pinholes

VARIANTS = {'hero': ('lethe-the-forgetful-fixer', 'lethe'), 'reaping': ('reaping-lethe', 'reaping_lethe')}
VARIANT = next((v for v in sys.argv[2:] if v in VARIANTS), 'hero')
SLUG, PREFIX = VARIANTS[VARIANT]
SRC = np.array(Image.open(f'src/{SLUG}.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
P, PT, PB = 3, 3, 4
H, W = SH + PT + PB, SW + 2 * P
N = 48
HAIR_X, HAIR_Y = 22, 13                              # Haar: rechts der Sense, oberhalb der Kapuze
HEM_Y = 32                                           # ab hier flattert der Umhang
EYE = rgb('b30000')
EYE_GLOW = [rgb('b30000'), rgb('d41a1a'), rgb('ff3a3a'), rgb('d41a1a')]


def bob(i):
    return int(round(math.sin(2 * math.pi * i / 16)))


def hair_dx(x, y, i):
    s = math.sin(2 * math.pi * i / 12 - 0.35 * x)
    if y <= 6:
        return int(round(1.3 * s))
    if y <= 10:
        return 1 if s > 0.75 else (-1 if s < -0.75 else 0)
    return 0


def hem_dx(x, y, i):
    if y < HEM_Y or x < 8:
        return 0
    return int(round(math.sin(2 * math.pi * i / 16 + x * 0.45) * (y - HEM_Y + 1) / 5))


def frame(i):
    out = np.zeros((H, W, 4), int)
    oy = PT + bob(i)
    glow = EYE_GLOW[(i // 3) % 4]
    for y in range(SH):
        for x in range(SW):
            if not SRC[y, x, 3]:
                continue
            c = SRC[y, x]
            if VARIANT == 'reaping' and tuple(c) == EYE:
                c = glow
            dx = hair_dx(x, y, i) if (x >= HAIR_X and y <= HAIR_Y) else hem_dx(x, y, i)
            out[y + oy, x + P + dx] = c
    fill_pinholes(out)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{PREFIX}_idle_{tag}', frames, ms, scale=8, check_edges=True)
