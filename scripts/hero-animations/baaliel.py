# -*- coding: utf-8 -*-
"""Idle-Animation für Baaliel, the Demon General (30x32 + 3 px oben = 30x35).

Stolze Pose – "Hier bin ich, jetzt stirb!":
* Tiefes, selbstsicheres Atmen: er reckt sich (Kopf verzögert), Füße fest.
* Die ausgestreckten Arme spannen sich an, die Fäuste heben sich und glühen.
* Drohmoment: Augen verengen sich zu glühenden Schlitzen, das Grinsen wird
  breiter und zeigt mehr Zähne.
* Höllische Glut steigt um ihn herum auf.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, save_outputs

SRC = np.array(Image.open('src/baaliel-the-demon-general.png').convert('RGBA')).astype(int)
PT = 3
BASE = np.zeros((SRC.shape[0] + PT, SRC.shape[1], 4), int)
BASE[PT:] = SRC
H, W = BASE.shape[:2]
N = 40

FIST, FIST_HOT = rgb('cc5f5c'), rgb('f08a6e')
TEETH, MOUTH = rgb('ffebd6'), rgb('410000')
BROW = rgb('590304')
EYE_GLOW = rgb('ffd0c0')


def inhale(i, lag=0):
    """0 / 1: eingeatmet (reckt sich hoch), zweimal pro Loop."""
    t = (i - lag) % 20
    return 1 if 4 <= t < 13 else 0


def flex(i):
    """Arme spannen sich stufenweise an (0..1)."""
    return max(0.0, wave(i, 20, -0.9))


def menace(i):
    return 22 <= i % N < 32


def is_arm(x, oy):
    """Ausgestreckte Arme (ohne Schulter)."""
    return 17 <= oy <= 20 and (x <= 8 or x >= 20)


def arm_lift(x, i):
    """Hubhöhe pro Spalte: Schulter 0, Oberarm halb, die ganze Faust gleichmäßig
    (sonst ragen einzelne Randspalten wie Finger nach oben)."""
    full = int(round(2.0 * flex(i)))
    if x <= 7 or x >= 21:
        return full
    return (full + 1) // 2                               # x8 / x20: Übergang


def offset(x, y, i):
    oy = y - PT
    if oy >= 26:
        return 0, 0                                        # breitbeinig, fest
    return 0, -inhale(i, 1 if oy <= 15 else 0)


def face(a, i):
    if menace(i):
        for x in (11, 16):                                 # verengte, glühende Augen
            a[11 + PT, x] = EYE_GLOW
            a[12 + PT, x] = BROW
        a[15 + PT, 13] = TEETH                            # breiteres Grinsen
        a[15 + PT, 14] = TEETH
        a[14 + PT, 12] = TEETH
        a[14 + PT, 15] = TEETH
    if flex(i) > 0.6:                                     # Fäuste glühen beim Anspannen
        for x in (5, 6, 21, 22):
            a[18 + PT, x] = FIST_HOT


EMBERS = [(3, 30, 0), (26, 28, 4), (6, 24, 8), (24, 22, 12), (1, 20, 16), (28, 31, 20),
          (4, 27, 24), (25, 30, 28), (2, 23, 32), (27, 25, 36)]
EMBER_COL = [rgb('ffd27a'), rgb('ff8a2a'), rgb('d8321e'), rgb('7a1410')]


def embers(out, i):
    for x0, y0, start in EMBERS:
        t = (i - start) % N
        if t >= 12:
            continue
        x = x0 + int(round(0.8 * np.sin(t * 0.7 + x0)))
        y = y0 + PT - t
        if 0 <= x < W and 0 <= y < H and out[y, x, 3] == 0:
            out[y, x] = EMBER_COL[min(3, t // 3)]


def frame(i):
    s = BASE.copy()
    face(s, i)
    out = np.zeros_like(s)
    for y in range(H):
        for x in range(W):
            dx, dy = offset(x, y, i)
            sx, sy = x - dx, y - dy
            if 0 <= sx < W and 0 <= sy < H and s[sy, sx, 3] and not is_arm(sx, sy - PT):
                out[y, x] = s[sy, sx]
    # Arme als Ganzes verschieben (Vorwärts-Mapping), damit nichts abgeschnitten wird
    up = inhale(i)
    for y in range(PT + 17, PT + 21):
        for x in range(W):
            if is_arm(x, y - PT) and s[y, x, 3]:
                ty = y - up - arm_lift(x, i)
                out[ty, x] = s[y, x]
    embers(out, i)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'baaliel_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10)
