# -*- coding: utf-8 -*-
"""Idle-Animation für Ghazma, the Worm Feeder (29x30).

Ein Amalgam aus fetten Würmern und Egeln in einer Kutte, mit Hörnern:
* Die Wurmmasse (Kopf und Arme) kriecht: Hell-Dunkel-Wellen laufen durch die
  Wurmsegmente (Peristaltik).
* Die drei Egelmäuler (Kopf, beide Hände) schnappen versetzt auf und zu.
* Ab und zu fällt ein Wurm aus einem Handmaul und windet sich am Boden.
* Das zackige, helle Horn knistert (Licht wandert hindurch), das rote Auge
  am dunklen Horn glüht auf.
* Schweres Atmen der Kutte, die Füße stehen fest.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, px, wave, save_outputs

SRC = np.array(Image.open('src/ghazma-the-worm-feeder.png').convert('RGBA')).astype(int)
H, W = SRC.shape[:2]
N = 48

WORM = [rgb('525252'), rgb('767676'), rgb('c3c3c3')]
WORM_SET = set(WORM)
FLESH = {rgb('482c2e'), rgb('885f5d')}
MOUTH_DARK, FLESH_M = rgb('030101'), rgb('482c2e')
HORN = [rgb('ffffaa'), rgb('ffffff')]
EYE = [rgb('880000'), rgb('c01010'), rgb('ff3a2a')]


def is_worm_zone(x, y):
    return (9 <= y <= 14 and 8 <= x <= 17) or (16 <= y <= 23 and (x <= 9 or x >= 19))


# (Mitte, Phasenversatz)
MOUTHS = [((10, 11), 0), ((5, 20), 4), ((25, 20), 8)]
BITE = ['zu', 'zu', 'normal', 'auf', 'auf', 'auf', 'normal', 'zu', 'normal', 'normal', 'zu', 'zu']


def mouths(a, i):
    for (cx, cy), off in MOUTHS:
        st = BITE[(i + off) % len(BITE)]
        if st == 'zu':
            a[cy, cx] = FLESH_M
        elif st == 'auf':
            for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                if px(SRC, cx + dx, cy + dy) in FLESH or (dx, dy) == (0, 0):
                    a[cy + dy, cx + dx] = MOUTH_DARK


def crawl(a, i):
    for y in range(H):
        for x in range(W):
            c = px(SRC, x, y)
            if c in WORM_SET and is_worm_zone(x, y):
                d = int(round(1.1 * wave(i, 16, -(x * 0.8 + y * 0.45))))
                a[y, x] = WORM[max(0, min(2, WORM.index(c) + d))]


def horn(a, i):
    """Licht wandert das zackige Horn hinab (von oben nach unten)."""
    pos = (i % 16) * 1.0
    for y in range(0, 14):
        for x in range(17, 25):
            c = px(SRC, x, y)
            if c in HORN:
                near = abs(y - pos) < 1.5
                a[y, x] = HORN[1] if near else HORN[0] if c == HORN[1] and (x + y + i // 2) % 3 == 0 else c
    lv = max(0, min(2, int(round(1 + 1.2 * wave(i, 24, 0.5)))))
    for x, y in ((12, 2), (19, 4)):                   # rote Augen an den Hörnern
        a[y, x] = EYE[lv]


def breath(i):
    return -1 if 8 <= i % 24 < 18 else 0


# Würmer, die aus den Handmäulern fallen: (x, Startframe)
DROPS = [(4, 6), (25, 30)]
WORM_COLS = [rgb('c38a88'), rgb('885f5d'), rgb('482c2e')]  # fette, fleischige Würmer


def drop_worms(out, i):
    for x0, start in DROPS:
        t = (i - start) % N
        if t < 5:                                          # fällt
            y = 23 + t
            for k, c in enumerate(WORM_COLS):
                yy = y - k
                if 0 <= yy < H and out[yy, x0, 3] == 0:
                    out[yy, x0] = c
        elif t < 16:                                       # windet sich am Boden
            wig = [(0, 0), (1, 0), (2, 0)] if (t // 2) % 2 == 0 else [(0, 0), (1, -1), (2, 0)]
            fade = 255 if t < 13 else 255 - (t - 12) * 70
            for k, (dx, dy) in enumerate(wig):
                xx, yy = x0 + dx + (t - 5) // 4 * (1 if x0 > 14 else -1), 27 + dy
                if 0 <= xx < W and 0 <= yy < H and out[yy, xx, 3] == 0:
                    out[yy, xx] = (*WORM_COLS[k][:3], fade)


def frame(i):
    s = SRC.copy()
    crawl(s, i)
    mouths(s, i)
    horn(s, i)
    out = np.zeros_like(s)
    b = breath(i)
    for y in range(H):
        for x in range(W):
            sy = y - b if y <= 24 else y                      # Füße fest
            if 0 <= sy < H and s[sy, x, 3]:
                out[y, x] = s[sy, x]
    drop_worms(out, i)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'ghazma_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 90, scale=10)
