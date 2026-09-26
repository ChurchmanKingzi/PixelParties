# -*- coding: utf-8 -*-
"""Idle-Animation für Nao, the Barrier Priestess (35x32).

Entschlossene Abwehrhaltung, breitbeinig:
* Glanz läuft den goldenen Stab entlang, Glitzer am Ring (fest am Stab).
* Die weiten Ärmel und der Hakama wallen im Wind, die Haarspitzen wehen.
* Angespanntes Atmen (Füße bleiben fest), seltenes, entschlossenes Blinzeln.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, step, sweep_level, sparkle_pixels, save_outputs

BASE = np.array(Image.open('src/nao-the-barrier-priestess.png').convert('RGBA')).astype(int)
H, W = BASE.shape[:2]
N = 40

GOLD = [rgb('d5a500'), rgb('ffd900'), rgb('ffef93'), rgb('ffffff')]
GOLD_SET = set(GOLD[:-1])


def is_ring(x, y):
    return x <= 8 and 17 <= y <= 25 and px(BASE, x, y) in GOLD_SET and not y == 21


def breath(i, lag=0):
    t = (i - lag) % N
    return 1 if 10 <= t < 30 else 0


def offset(x, y, i):
    """(dx, dy) pro Ausgabepixel."""
    if y >= 25:
        return 0, 0                                   # Füße fest
    b = breath(i, 1 if y <= 15 else 0)
    dx = 0
    # Haarspitzen seitlich wehen
    if 8 <= y <= 15 and (x <= 14 or x >= 23):
        dx = int(round((y - 7) / 8 * wave(i, 16, 0.3 * y)))
    # Ärmelenden wallen
    if 16 <= y <= 22 and (9 <= x <= 11 or 25 <= x <= 28):
        dx = int(round(0.9 * wave(i, 12, 0.5 * y + (0 if x < 20 else 1.4))))
        b += int(round(0.6 * wave(i, 12, 0.4 * x)))
    # Hakama-Saum wallt
    if 22 <= y <= 24 and 9 <= x <= 27:
        dx = int(round((y - 21) / 3 * 0.9 * wave(i, 10, 0.35 * x)))
    return dx, b


EYES = [(16, 12), (16, 13), (21, 12), (21, 13)]
LID, SKIN = rgb('150000'), rgb('f6cd8b')
RING_PX = [(x, y) for y in range(H) for x in range(W) if is_ring(x, y)]
RING_SET = set(RING_PX)


def ring_offset(i):
    """Der Ring sitzt fest am Stab und bewegt sich nur mit ihm."""
    return 0, breath(i)


RING_SPARKS = [(5, 18, 0), (2, 22, 13), (7, 23, 26), (26, 21, 8), (15, 21, 31)]


def frame(i):
    s = BASE.copy()
    for y in range(H):
        for x in range(W):
            c = px(BASE, x, y)
            if c in GOLD_SET:
                lv = sweep_level(x, y, i, N, speed=1.3, slope=0.2, offset=-8)
                if lv:
                    s[y, x] = step(GOLD, c, lv)
    if i % N in (23, 24):                             # Blinzeln
        for x, y in EYES:
            s[y, x] = SKIN if y == 12 else LID
    out = np.zeros_like(s)
    for y in range(H):
        for x in range(W):
            dx, dy = offset(x, y, i)
            sx, sy = x - dx, y - dy
            if 0 <= sx < W and 0 <= sy < H and s[sy, sx, 3] and (sx, sy) not in RING_SET:
                out[y, x] = s[sy, sx]
    rdx, rdy = ring_offset(i)
    for x, y in RING_PX:
        if 0 <= x + rdx < W and 0 <= y + rdy < H:
            out[y + rdy, x + rdx] = s[y, x]
    for (x, y), c in sparkle_pixels(i, N, RING_SPARKS, rgb('ffef93'), rgb('ffd900')).items():
        if 0 <= x < W and 0 <= y < H:
            out[y, x] = c
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'nao_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 80, scale=10)
