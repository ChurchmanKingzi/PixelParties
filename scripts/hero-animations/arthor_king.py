# -*- coding: utf-8 -*-
"""Idle-Animation für Arthor, the King of Blackport (18x25).

Der alte König starrt zum Himmel:
* Meist blickt er nach oben (Original). Periodisch senkt er langsam den Kopf:
  der Kopf rutscht nach unten, man sieht mehr vom Scheitel, der Bart legt
  sich auf die Brust – dann hebt er ihn wieder.
* Mit gesenktem Kopf schließt er kurz die Augen (seufzt).
* Ruhiges Atmen des Oberkörpers, die Füße stehen fest.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

SRC = np.array(Image.open('src/arthor-the-king-of-blackport.png').convert('RGBA')).astype(int)
H, W = SRC.shape[:2]
N = 48

HEAD_BOTTOM = 10                  # Bart endet in Zeile 10
HAIR_BOTTOM = 3                   # Scheitel/Haar bis Zeile 3
EYES = [(6, 4), (7, 4), (10, 4), (11, 4)]
LID = rgb('b47b31')


def bow(i):
    """0 = Blick nach oben, 1 = halb gesenkt, 2 = Kopf gesenkt."""
    t = i % N
    if 16 <= t < 18 or 30 <= t < 32:
        return 1
    if 18 <= t < 30:
        return 2
    return 0


def breath(i):
    return -1 if 4 <= i % 24 < 13 else 0


def head_rows(level):
    """Quellzeilen des Kopfes von oben nach unten und ihre Zielzeilen."""
    rows = list(range(HEAD_BOTTOM + 1))
    if level == 2:                                   # mehr Scheitel sichtbar
        k = rows.index(HAIR_BOTTOM) + 1
        rows[k:k] = [HAIR_BOTTOM]
    top = {0: 0, 1: 1, 2: 1}[level]
    return [(sy, top + n) for n, sy in enumerate(rows)]


def frame(i):
    s = SRC.copy()
    lv = bow(i)
    if lv == 2 and 22 <= i % N < 25:                 # Augen zu
        for x, y in EYES:
            s[y, x] = LID
    out = np.zeros_like(s)
    b = breath(i)
    # Körper (ab Zeile 11): atmet, Füße (ab Zeile 22) fest
    for y in range(HEAD_BOTTOM + 1, H):
        for x in range(W):
            if s[y, x, 3]:
                ty = y + (b if y < 22 else 0)
                out[ty, x] = s[y, x]
    if b < 0:                                        # Beine strecken sich
        for x in range(W):
            if s[21, x, 3] and not out[21, x, 3]:
                out[21, x] = s[21, x]
    # Kopf darüber (Bart legt sich beim Senken auf die Brust)
    for sy, ty in head_rows(lv):
        ty += b
        if not 0 <= ty < H:
            continue
        for x in range(W):
            if s[sy, x, 3]:
                out[ty, x] = s[sy, x]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'arthor_king_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=12)
