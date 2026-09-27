# -*- coding: utf-8 -*-
"""Idle-Animation für Lethe, the Forgetful Fixer und den Skin Reaping Lethe
(MotiveEgypt.xcf; Haar aus „Ebene #117“ ergänzt, Sense aus „Ebene #116“).

Aufruf: python3 lethe.py <tag> [ms] [hero|reaping]

Teile (deckungsgleich): src/<slug>-{scythe,hair,body}.png.
* Sie schwebt (sanftes Auf und Ab).
* Die weißen Haarspitzen wehen: eine Welle läuft von oben nach unten durch
  das Haar (jede Zeile verschiebt sich als Ganzes, benachbarte Zeilen um
  höchstens 1 px – so reißt nichts auf); der Ansatz bleibt.
* Die Schattententakel des Umhangs wogen unten genauso zeilenweise.
* Sie hebt die Sense zweimal pro Loop an und senkt sie wieder (die Hand geht
  mit, der Arm darunter wird gedehnt).
* Auf der Klinge glitzern nacheinander Sterne.
* Reaping Lethe: die roten Augen glühen auf und ab.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs, sparkle_pixels
from flap_common import fill_pinholes

VARIANTS = {'hero': ('lethe-the-forgetful-fixer', 'lethe'), 'reaping': ('reaping-lethe', 'reaping_lethe')}
VARIANT = next((v for v in sys.argv[2:] if v in VARIANTS), 'hero')
SLUG, PREFIX = VARIANTS[VARIANT]


def load(part):
    return np.array(Image.open(f'src/{SLUG}-{part}.png').convert('RGBA')).astype(int)


SCY, HAIR, BODY = load('scythe'), load('hair'), load('body')
FIG = HAIR.copy()                                    # Haar unter dem Körper
FIG[BODY[:, :, 3] > 0] = BODY[BODY[:, :, 3] > 0]
SH, SW = FIG.shape[:2]
P, PT, PB = 3, 5, 3
H, W = SH + PT + PB, SW + 2 * P
N = 48
HEM_Y = 32                                           # ab hier wogen die Tentakel
ARM = [(x, y) for y in range(14, 20) for x in range(0, 16) if FIG[y, x, 3]]
ARM_SET = set(ARM)
EYE = rgb('b30000')
EYE_GLOW = [rgb('b30000'), rgb('d41a1a'), rgb('ff3a3a'), rgb('d41a1a')]
BLADE_STARS = [(13, 2, 4), (8, 6, 20), (5, 10, 36)]  # (x, y, Startframe) auf der Klinge


def bob(i):
    return int(round(math.sin(2 * math.pi * i / 16)))


def lift(i):
    """Sense (und Hand) anheben: 0 .. -2 px, zweimal pro Loop."""
    return -int(round(1 - math.cos(2 * math.pi * i / 24)))


def row_dx(y, x, i):
    if y <= 10 and x >= 16:                          # Haar: Welle von oben nach unten
        s = math.sin(2 * math.pi * i / 12 - y * 0.4)
        if y <= 6:
            return int(round(1.3 * s))
        return 1 if s > 0.75 else (-1 if s < -0.75 else 0)
    if y >= HEM_Y and x >= 12:                       # Tentakel
        a = 1.2 * min(1.0, (y - HEM_Y + 1) / 4)
        return int(round(a * math.sin(2 * math.pi * i / 16 - (y - HEM_Y) * 0.5)))
    return 0


def frame(i):
    out = np.zeros((H, W, 4), int)
    oy = PT + bob(i)
    ly = lift(i)
    for y in range(SH):                              # Sense (unten)
        for x in range(SW):
            if SCY[y, x, 3]:
                out[y + oy + ly, x + P] = SCY[y, x]
    glow = EYE_GLOW[(i // 3) % 4]
    for y in range(SH):
        for x in range(SW):
            if not FIG[y, x, 3]:
                continue
            c = FIG[y, x]
            if VARIANT == 'reaping' and tuple(c) == EYE:
                c = glow
            if (x, y) in ARM_SET:
                out[y + oy + ly, x + P] = c
                continue
            out[y + oy, x + P + row_dx(y, x, i)] = c
    for y in range(20 + ly, 20):                     # Arm unter der gehobenen Hand dehnen
        for x in range(16):
            if FIG[19, x, 3] and not out[y + oy, x + P, 3]:
                out[y + oy, x + P] = FIG[19, x]
    fill_pinholes(out)
    for x, y, start in BLADE_STARS:                  # Glitzern auf der Klinge
        for (px_, py_), c in sparkle_pixels(i, N, [(x + P, y + oy + ly, start)],
                                            rgb('f0f0ff'), rgb('c8c8dc')).items():
            assert 1 <= px_ < W - 1 and 1 <= py_ < H - 1, 'Glitzerstern ragt an den Rand'
            out[py_, px_] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    ms = int(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2].isdigit() else 90
    save_outputs(f'{PREFIX}_idle_{tag}', frames, ms, scale=8, check_edges=True)
