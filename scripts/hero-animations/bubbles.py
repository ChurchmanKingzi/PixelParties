# -*- coding: utf-8 -*-
"""Idle-Animation für Bubbles, the Bouncy Bunny (verkleinert 40x42 + Rand = 46x50).

Das Sprite wurde vorher mit bubbles_downscale.py auf Hero-Größe gebracht.
* Er hüpft weich und plüschig – ein großer und ein kleiner Hüpfer pro Loop.
* Squash & Stretch ohne Pixelmatsch: beim Landen fallen Zeilen aus dem
  Körper weg und Spalten in den Pfoten werden verdoppelt (er wird breit,
  der Kopf bleibt gleich), beim Abheben umgekehrt.
* Die Ohren schlackern hinterher: beim Steigen gestaucht, beim Fallen
  gestreckt, beim Landen klappen die Spitzen nach außen.
* Staubwölkchen beim Aufsetzen.
"""
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

SRC = np.array(Image.open('src/bubbles-the-bouncy-bunny.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
PL, PT = 3, 8
H, W = SH + PT, SW + 2 * PL
N = 32

# (Höhe über dem Boden, Squash-Stufe -2 = platt ... +2 = gestreckt)
BIG = [(0, -2), (0, -1), (0, 0), (0, 0), (0, 0), (0, -1), (0, -2),
       (1, 2), (3, 2), (5, 1), (6, 0), (7, 0), (7, 0), (6, 0), (5, 1), (3, 1), (1, 2)]
SMALL = [(0, -2), (0, -1), (0, 0), (0, 0), (0, -1),
         (1, 1), (2, 1), (3, 0), (3, 0), (2, 0), (1, 1)]
HOP = BIG + SMALL + [(0, 0)] * (N - len(BIG) - len(SMALL))
assert len(HOP) == N


def hop(i):
    return HOP[i % N]


def ear_state(i):
    """-1: Ohren gestaucht (steigt / landet), +1: gestreckt (fällt)."""
    h, s = hop(i)
    v = h - hop(i - 1)[0]
    if v > 0 or s <= -2:
        return -1
    if v < 0:
        return 1
    return 0


def tips_out(i):
    """Ohrspitzen klappen beim Landen (und einen Frame danach) nach außen."""
    return hop(i)[1] <= -2 or hop(i - 1)[1] <= -2


def row_map(i):
    """Quellzeilen von oben nach unten (unten bündig)."""
    s = hop(i)[1]
    ear = ear_state(i)
    rows = list(range(SH))

    def dup(r):
        rows.insert(rows.index(r), r)

    def drop(r):
        rows.remove(r)

    if ear > 0:
        dup(8)
    elif ear < 0:
        drop(8)
    if s >= 1:
        dup(20)                 # Bauch oben
    if s >= 2:
        dup(13)                 # Kopf
    if s <= -1:
        drop(13)
    if s <= -2:
        drop(30)                # Pfoten (Naht bleibt gestrichelt)
        drop(31)
    return rows


def col_map(i):
    s = hop(i)[1]
    cols = list(range(SW))
    if s <= -1:                 # breiter: Pfoten verdoppeln Spalten
        cols.insert(cols.index(7), 7)
        cols.insert(cols.index(30), 30)
    if s <= -2:
        cols.insert(cols.index(7), 7)
        cols.insert(cols.index(30), 30)
    if s >= 2:
        cols.remove(7)
        cols.remove(30)
    return cols


DUST = [rgb('ffffff', 210), rgb('dcdce6', 160), rgb('b4b4c8', 100)]


def frame(i):
    h, s = hop(i)
    rows, cols = row_map(i), col_map(i)
    out = np.zeros((H, W, 4), int)
    y0 = PT + SH - len(rows) - h
    x0 = PL + (SW - len(cols)) // 2
    tips = tips_out(i)
    for k, sy in enumerate(rows):
        y = y0 + k
        if not 0 <= y < H:
            continue
        for j, sx in enumerate(cols):
            c = SRC[sy, sx]
            if c[3] == 0:
                continue
            x = x0 + j
            if tips and sy <= 5 and sx <= 25:          # Ohrspitzen nach außen
                x += -1 if sx <= 18 else 1
            out[y, x] = c
    # Staubwölkchen beim Aufsetzen
    if h == 0 and s <= -1:
        t = 0 if s <= -2 and hop(i - 1)[0] > 0 else 1
        by = PT + SH - 2
        for side in (-1, 1):
            bx = (x0 + 1) if side < 0 else (x0 + len(cols) - 2)
            for k, (dx, dy) in enumerate(((0, 0), (1, -1), (2, 0))):
                xx, yy = bx + side * (dx + 1 + t), by + dy - t
                if 0 <= xx < W and 0 <= yy < H and out[yy, xx, 3] == 0:
                    out[yy, xx] = DUST[min(2, k + t)]
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'bubbles_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 70, scale=8)
