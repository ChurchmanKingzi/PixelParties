# -*- coding: utf-8 -*-
"""Idle-Animation für Kasparov, the King of Kings [B] und [W] (21x35 + 2 px links = 23x35).

Aufruf: python3 kasparov.py <tag> [ms] b|w  (b = schwarz, w = weiß; gleiche Geometrie)
* Die Figur wippt sanft (Robe dehnt sich 1 px, der Sockel steht fest).
* Die beiden Zipfel der Narrenkappe schlackern mit ihren Glöckchen hin und her
  (Spitze am stärksten).
* Zweimal pro Loop stößt er das Zepter auf den Boden: alle Glöckchen
  (Kappe, Kragen, Zepter) bimmeln und kleine Klang-Funken blitzen auf.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, sparkle_pixels, save_outputs

VARIANT = 'w' if 'w' in sys.argv[1:] else 'b'
SLUG = {'b': 'kasparov-the-king-of-kings-b', 'w': 'kasparov-the-king-of-kings-w'}[VARIANT]
SRC = np.array(Image.open(f'src/{SLUG}.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
PL = 2
BASE = np.zeros((SH, SW + PL, 4), int)
BASE[:, PL:] = SRC
H, W = BASE.shape[:2]
N = 48


def P(x, y):
    """Originalkoordinate -> Leinwand."""
    return x + PL, y


# ---------------------------------------------------------------- Zonen (Originalkoordinaten)
def tip_side(x, y):
    """Kappenzipfel: 'L' / 'R' / None."""
    if 8 <= y <= 12 and x <= 3:
        return 'L'
    if 8 <= y <= 12 and x >= 14:
        return 'R'
    return None


def is_scepter(x, y):
    if 13 <= y <= 21:
        return x >= 14
    return 22 <= y and x >= 16


BELLS = [(0, 11), (17, 11), (2, 19), (5, 21), (11, 21), (14, 18), (19, 18)]
BELL_PX = {(bx + dx, by + dy) for bx, by in BELLS for dx in (0, 1) for dy in (0, 1)}


# ---------------------------------------------------------------- Timing
def bob(i):
    return -1 if 6 <= i % 24 < 15 else 0


TIP_W = {8: 0.25, 9: 0.5, 10: 0.75, 11: 1.0, 12: 1.0}


def tip_dx(y, i):
    return int(round(2.0 * TIP_W[y] * wave(i, 24, 0.4)))


TAPS = (30, 6)                                # Zepterstöße: Start, Dauer
TAP = [-1, -1, 0, -1, -1, 0]                  # anheben, aufstoßen, nochmal


def scepter_dy(i):
    t = (i - TAPS[0]) % N
    return TAP[t] if t < len(TAP) else 0


def ringing(i):
    t = (i - TAPS[0]) % N
    return 2 <= t < 10


SPARKS = [(13, 15, 32), (21, 21, 33), (12, 12, 35), (21, 16, 36)]


def frame(i):
    s = BASE.copy()
    if ringing(i) and i % 2 == 0:                          # Glöckchen kippen hin und her
        for bx, by in BELLS:
            x0, y0 = P(bx, by)
            blk = s[y0:y0 + 2, x0:x0 + 2].copy()
            s[y0:y0 + 2, x0:x0 + 2] = blk[:, ::-1]
    out = np.zeros_like(s)
    b = bob(i)
    # Figur (ohne Zipfel und Zepter): bis Zeile 26 wippt sie, darunter fester Sockel
    for y in range(H):
        for x in range(W):
            sy = y - b if y <= 26 else y
            ox = x - PL
            if 0 <= sy < H and s[sy, x, 3] and not tip_side(ox, sy) and not is_scepter(ox, sy):
                out[y, x] = s[sy, x]
    # Kappenzipfel schlackern (zeilenweise verschoben, Spitze am stärksten)
    for y in range(8, 13):
        for x in range(W):
            if s[y, x, 3] and tip_side(x - PL, y):
                tx = x + tip_dx(y, i)
                if 0 <= tx < W:
                    out[y + b, tx] = s[y, x]
    # Zepter: wippt mit, wird beim Aufstoßen kurz angehoben
    dz = b + scepter_dy(i)
    for y in range(H):
        for x in range(W):
            if s[y, x, 3] and is_scepter(x - PL, y):
                ty = y + (dz if y <= 26 else scepter_dy(i))
                if 0 <= ty < H:
                    out[ty, x] = s[y, x]
    # Lücke im Schaft (oberer Teil wippt höher als der untere): Zeile 26 doppeln
    for gy in range(26 + dz + 1, 27 + scepter_dy(i)):
        for x in range(W):
            if s[26, x, 3] and is_scepter(x - PL, 26):
                out[gy, x] = s[26, x]
    # Klang-Funken
    for (x, y), c in sparkle_pixels(i, N, SPARKS, rgb('f2e525'), rgb('fff6a0')).items():
        tx, ty = x + PL, y + b
        if 0 <= tx < W and 0 <= ty < H and out[ty, tx, 3] == 0:
            out[ty, tx] = c
    return out


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a not in ('b', 'w')]
    tag = args[0] if args else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'kasparov_{VARIANT}_idle_{tag}', frames, int(args[1]) if len(args) > 1 else 90, scale=12)
