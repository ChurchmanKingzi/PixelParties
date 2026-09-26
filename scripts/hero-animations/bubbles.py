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

# Variante: 'klein' (Hero-Größe, Standard) oder 'gross' (Original 120x125, nur
# zum Vergleich). Alle Zeilen/Spalten sind je Variante hinterlegt, damit beim
# Stauchen/Strecken nur ruhige Stellen verdoppelt bzw. entfernt werden.
VARIANTS = {
    'klein': dict(src='src/bubbles-the-bouncy-bunny.png', K=1,
                  ear=[8], head=[13], body=[20], paws=[30, 31],
                  cols=([7], [30]), tips=[(5, 1)], ear_split=18, ear_bottom=25),
    'gross': dict(src='src/bubbles-the-bouncy-bunny-original.png', K=3,
                  ear=[21, 22, 23], head=[49, 50, 51], body=[64, 65, 66, 67],
                  paws=[100, 101, 102, 103, 104, 105],
                  cols=([22, 23, 24], [91, 92, 93]),
                  tips=[(12, 3), (18, 2), (24, 1)], ear_split=58, ear_bottom=76),
}
VARIANT = 'gross' if 'gross' in sys.argv[1:] else 'klein'
V = VARIANTS[VARIANT]
K = V['K']
SRC = np.array(Image.open(V['src']).convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
PL, PT = 3 * K, 8 * K
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

    def dup(block):
        k = rows.index(block[-1]) + 1
        rows[k:k] = block

    def drop(block):
        for r in block:
            rows.remove(r)

    if ear > 0:
        dup(V['ear'])
    elif ear < 0:
        drop(V['ear'])
    if s >= 1:
        dup(V['body'])          # Bauch oben
    if s >= 2:
        dup(V['head'])          # Kopf
    if s <= -1:
        drop(V['head'])
    if s <= -2:
        drop(V['paws'])         # Pfoten (Naht bleibt gleichmäßig)
    return rows


def col_map(i):
    s = hop(i)[1]
    cols = list(range(SW))
    left, right = V['cols']

    def dup(block):
        k = cols.index(block[-1]) + 1
        cols[k:k] = block

    if s <= -1:                 # breiter: Pfoten verdoppeln Spalten
        dup(left)
        dup(right)
    if s <= -2:
        dup(left)
        dup(right)
    if s >= 2:
        for c in left + right:
            cols.remove(c)
    return cols


def tip_shift(sy):
    for limit, d in V['tips']:
        if sy <= limit:
            return d
    return 0


DUST = [rgb('ffffff', 210), rgb('dcdce6', 160), rgb('b4b4c8', 100)]


def frame(i):
    h, s = hop(i)
    rows, cols = row_map(i), col_map(i)
    out = np.zeros((H, W, 4), int)
    y0 = PT + SH - len(rows) - h * K
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
            if tips and sy < V['ear_bottom']:          # Ohrspitzen nach außen
                d = tip_shift(sy)
                x += -d if sx <= V['ear_split'] else d
            out[y, x] = c
    # Staubwölkchen beim Aufsetzen
    if h == 0 and s <= -1:
        t = 0 if s <= -2 and hop(i - 1)[0] > 0 else 1
        by = PT + SH - 1 - K
        for side in (-1, 1):
            bx = (x0 + K) if side < 0 else (x0 + len(cols) - 1 - K)
            for k, (dx, dy) in enumerate(((0, 0), (1, -1), (2, 0))):
                for u in range(K):
                    for v in range(K):
                        xx = bx + side * ((dx + 1 + t) * K + u)
                        yy = by + (dy - t) * K + v
                        if 0 <= xx < W and 0 <= yy < H and out[yy, xx, 3] == 0:
                            out[yy, xx] = DUST[min(2, k + t)]
    return out


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != 'gross']
    tag = args[0] if args else 'v'
    frames = [frame(i) for i in range(N)]
    name = f'bubbles_idle_{tag}' + ('_gross' if VARIANT == 'gross' else '')
    save_outputs(name, frames, int(args[1]) if len(args) > 1 else 70, scale=8 if K == 1 else 3)
