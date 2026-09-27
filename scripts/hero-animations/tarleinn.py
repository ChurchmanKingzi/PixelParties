# -*- coding: utf-8 -*-
"""Idle-Animation für Tarleinn the Traveler (Sprite aus MotiveMoe.xcf).

Sie hört Pop-Musik (die Hände an den Ohren halten die lila Kopfhörer):
* Kopf wippt im Takt (Periode 8 Frames, ~115 BPM): auf jedem Schlag nickt
  der Kopf samt Händen 1 px nach unten, abwechselnd mit einer leichten
  Neigung nach links/rechts (die oberste Haarpartie folgt 1 px zur Seite).
* Die grünen Zöpfe federn einen Frame später nach (Zeile wird gedehnt –
  keine Lücke zum Kopf).
* Kleine Noten (♪) steigen aus den Kopfhörern auf, pendeln und verblassen.
"""
import math
import sys
from PIL import Image
import numpy as np
from anim_common import rgb, save_outputs

SRC = np.array(Image.open('src/tarleinn-the-traveler.png').convert('RGBA')).astype(int)
SH, SW = SRC.shape[:2]
PT, PL, PR = 8, 7, 7
H, W = SH + PT, SW + PL + PR
BEAT = 8
N = BEAT * 4

GREEN = {rgb(c) for c in ('294340', 'cbd397', '89b45b', '357f34')}


def is_head(x, y):
    return y <= 9 or (y <= 12 and 8 <= x <= 13)


def is_tail(x, y):
    return y >= 11 and SRC[y, x, 3] and tuple(SRC[y, x]) in GREEN and (x <= 4 or x >= 17)


def nod(i):
    return 1 if i % BEAT < 2 else 0


def tilt(i):
    """Neigung der obersten Haarpartie: jeder zweite Schlag andere Richtung."""
    if i % BEAT >= 4:
        return 0
    return 1 if (i // BEAT) % 2 == 0 else -1


def tail_bounce(i):
    return 1 if 1 <= i % BEAT < 3 else 0


NOTE_A = [(1, 0), (1, 1), (2, 1), (1, 2), (0, 3), (1, 3)]          # ♪
NOTE_B = [(1, 0), (1, 1), (0, 2), (1, 2)]                           # ♩
NOTE_COLS = [rgb('ff82c8'), rgb('78e6ff'), rgb('ffe36e'), rgb('b99bff')]
EARS = {-1: (3, 7), 1: (18, 7)}
LIFE = 16


def notes(out, i):
    for k in range(8):
        born = k * 4
        t = (i - born) % N
        if t >= LIFE:
            continue
        side = -1 if k % 2 == 0 else 1
        ex, ey = EARS[side]
        x = ex + PL + side * (3 + t * 0.3) + 0.9 * math.sin(t * 0.7 + k) - (2 if side < 0 else 0)
        y = ey + PT - 3 - t * 0.6
        glyph = NOTE_A if k % 3 else NOTE_B
        col = NOTE_COLS[k % 4]
        a = 255 if t < LIFE - 4 else int(255 * (LIFE - t) / 5)
        pts = [(int(round(x)) + dx, int(round(y)) + dy) for dx, dy in glyph]
        if any(not (0 <= xx < W and 0 <= yy < H) or out[yy, xx, 3] for xx, yy in pts):
            continue                                   # nur ganze Noten, nie angeschnitten
        for xx, yy in pts:
            out[yy, xx] = (*col[:3], a)


def frame(i):
    out = np.zeros((H, W, 4), int)
    n, tl, tb = nod(i), tilt(i), tail_bounce(i)
    # Körper (ohne Kopf und Zöpfe)
    for y in range(SH):
        for x in range(SW):
            if SRC[y, x, 3] and not is_head(x, y) and not is_tail(x, y):
                out[y + PT, x + PL] = SRC[y, x]
    # Zöpfe: ab Zeile 14 federn sie nach (Zeile 13 wird gedehnt)
    for y in range(SH):
        for x in range(SW):
            if is_tail(x, y):
                d = tb if y >= 14 else 0
                out[y + PT + d, x + PL] = SRC[y, x]
                if d and y == 13 + 1 and is_tail(x, 13):
                    out[14 + PT, x + PL] = SRC[13, x]
    # Kopf (nickt, oben leicht geneigt)
    for y in range(SH):
        for x in range(SW):
            if SRC[y, x, 3] and is_head(x, y):
                dx = tl if y <= 3 else 0
                out[y + PT + n, x + PL + dx] = SRC[y, x]
    notes(out, i)
    return out


if __name__ == '__main__':
    tag = sys.argv[1] if len(sys.argv) > 1 else 'v'
    frames = [frame(i) for i in range(N)]
    save_outputs(f'tarleinn_idle_{tag}', frames, int(sys.argv[2]) if len(sys.argv) > 2 else 65, scale=8)
