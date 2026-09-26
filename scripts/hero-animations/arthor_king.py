# -*- coding: utf-8 -*-
"""Idle-Animation für Arthor, the King of Blackport (18x25).

Der alte König blickt nach vorne und hebt periodisch den Kopf zum Himmel:
* Ruhepose „nach vorne“: der Kopf ist leicht nach vorne geneigt – man sieht
  eine Haarzeile mehr vom Scheitel (nicht die Brauen), Augen, Nase und Mund
  sitzen 1 px tiefer und das Kinn zieht sich zusammen (eine Bartzeile
  weniger). Der Umriss des Kopfes bleibt gleich.
* Periodisch neigt er den Kopf zurück und starrt nach oben (Original-Pose),
  dann blickt er wieder nach vorne.
* Er blinzelt ab und zu; ruhiges Atmen, die Füße stehen fest.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

SRC = np.array(Image.open('src/arthor-the-king-of-blackport.png').convert('RGBA')).astype(int)
H, W = SRC.shape[:2]
N = 48

HEAD_BOTTOM = 10                  # Bart endet in Zeile 10
EYES = [(6, 4), (7, 4), (10, 4), (11, 4), (7, 5), (10, 5)]
LID = rgb('b47b31')
BROW = rgb('ece9d2')

# Kopfzeilen je Pose (Quellzeile für Zielzeile 0..10)
POSES = {
    'vorne': [0, 1, 1, 2, 3, 4, 5, 6, 7, 8, 10],       # Scheitelzeile doppelt, Bartzeile 9 fällt weg
    'hoch': list(range(HEAD_BOTTOM + 1)),             # Original: Blick schräg nach oben
}


def pose(i):
    return 'hoch' if 20 <= i % N < 36 else 'vorne'


def breath(i):
    return -1 if 4 <= i % 24 < 13 else 0


def blinking(i):
    return i % N in (8, 9, 42)


def frame(i):
    s = SRC.copy()
    if blinking(i):                                  # Augen zu (Lid unter den Brauen)
        for x, y in EYES:
            s[y, x] = LID if y == 5 else BROW
    out = np.zeros_like(s)
    b = breath(i)
    # Körper (ab Zeile 11): atmet, Füße (ab Zeile 22) fest
    for y in range(HEAD_BOTTOM + 1, H):
        for x in range(W):
            if s[y, x, 3]:
                out[y + (b if y < 22 else 0), x] = s[y, x]
    if b < 0:                                        # Beine strecken sich
        for x in range(W):
            if s[21, x, 3] and not out[21, x, 3]:
                out[21, x] = s[21, x]
    # Kopf: Zeilen je Pose
    for ty, sy in enumerate(POSES[pose(i)]):
        yy = ty + b
        if not 0 <= yy < H:
            continue
        for x in range(W):
            if s[sy, x, 3]:
                out[yy, x] = s[sy, x]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'arthor_king_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=12)
