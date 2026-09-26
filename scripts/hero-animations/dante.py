# -*- coding: utf-8 -*-
"""Idle-Animation für Dante, the Wanderer of Hell (23x31 + Rand = 25x32).

Er liest eine Landkarte:
* Die Augen folgen den Zeilen (links -> rechts, springen zurück), er blinzelt
  und nickt ab und zu nachdenklich.
* Die Karte wippt leicht in den Händen (Inhalt bleibt unverändert).
* Blonde Haarspitzen und der rote Umhang wehen im Wind; ruhiges Atmen,
  die Füße bleiben stehen.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, save_outputs

SRC = np.array(Image.open('src/dante-the-wanderer-of-hell.png').convert('RGBA')).astype(int)
PL, PT = 1, 1
BASE = np.zeros((SRC.shape[0] + PT, SRC.shape[1] + 2 * PL, 4), int)
BASE[PT:, PL:PL + SRC.shape[1]] = SRC
H, W = BASE.shape[:2]
N = 48

WHITE, IRIS = rgb('f2ffff'), rgb('00be00')
BROW, SKIN = rgb('000200'), rgb('f5ce88')


def o(x, y):
    return x - PL, y - PT


def gaze(i):
    """-1 links, +1 rechts: Lesen in Zeilen, Rücksprung am Zeilenende."""
    seq = [-1, -1, -1, 0, 0, 0, 1, 1, 1, 1, -1, -1, -1, 0, 0, 1, 1, 1, 1, 1,
           -1, -1, 0, 0, 0, 0, 1, 1, 1, -1, -1, -1, 0, 0, 1, 1, 1, 1, 1, 1,
           0, 0, 0, 0, 0, 0, 0, 0]
    return seq[i % N]


def face(a, i):
    g = gaze(i)
    left = {(-1): (IRIS, WHITE), 0: (WHITE, IRIS), 1: (WHITE, IRIS)}[g]
    right = {(-1): (IRIS, WHITE), 0: (IRIS, WHITE), 1: (WHITE, IRIS)}[g]
    y = 13 + PT
    a[y, 9 + PL], a[y, 10 + PL] = left
    a[y, 13 + PL], a[y, 14 + PL] = right
    if i % N in (16, 17, 44):                      # blinzeln
        for x in (9, 10, 13, 14):
            a[y, x + PL] = SKIN
            a[y - 1, x + PL] = BROW


def breath(i, lag=0):
    t = (i - lag) % N
    return 1 if 12 <= t < 36 else 0


def nod(i):
    """Nachdenkliches Nicken ('hmm')."""
    return 1 if i % N in (38, 39, 40, 41) else 0


def offset(ox, oy, i):
    if oy >= 26:
        return 0, 0                                  # Füße
    b = breath(i)
    dx = 0
    if oy <= 14:                                     # Kopf + Haare
        b = breath(i, 1) + nod(i)
        if oy <= 8:
            dx = int(round((9 - oy) / 5 * wave(i, 16, 0.4 * ox)))
    elif 15 <= oy <= 22 and 7 <= ox <= 15:           # Karte in den Händen
        b = breath(i, 1) + (1 if (i % 24) in range(6, 12) else 0)
    elif ox <= 7 or ox >= 16:                        # Umhang weht
        u = max(0.0, (oy - 15) / 11)
        dx = int(round(1.2 * u * wave(i, 16, -0.7 * oy + (0 if ox < 11 else 1.6))))
    return dx, b


def frame(i):
    s = BASE.copy()
    face(s, i)
    out = np.zeros_like(s)
    for y in range(H):
        for x in range(W):
            ox, oy = o(x, y)
            dx, dy = offset(ox, oy, i)
            sx, sy = x - dx, y - dy
            if 0 <= sx < W and 0 <= sy < H and s[sy, sx, 3]:
                out[y, x] = s[sy, sx]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'dante_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=12)
